import http.server
import json
import os
import sys
import threading
import time
import urllib.request
from typing import Any, Optional
from backend.api import Api

DEFAULT_PORT = 54321
HEARTBEAT_TIMEOUT_SECONDS = 25
LAST_HEARTBEAT = time.time()
SERVER_START_TIME = time.time()
SERVER_INSTANCE: Optional[http.server.ThreadingHTTPServer] = None
ENABLE_WATCHDOG = False


def is_server_already_running(port: int = DEFAULT_PORT) -> bool:
    """Verifica se já existe uma instância do servidor HTTP ativa na porta local."""
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/ping",
            headers={"User-Agent": "CotacaoApp-InstanceChecker"},
        )
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("sucesso", False) or data.get("status") == "online"
    except Exception:
        pass
    return False


def get_dist_directory() -> str:
    """Retorna o caminho absoluto do diretório estático frontend/dist."""
    if getattr(sys, "frozen", False):
        base_dir = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, "frontend", "dist")


class CotacaoHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Manipulador HTTP para servir o frontend estático e rotear chamadas de API."""

    api_instance: Api = None
    modo_execucao: str = "navegador"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        dist_dir = get_dist_directory()
        super().__init__(*args, directory=dist_dir, **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        """Suprime logs excessivos no console em produção."""
        if "--debug" in sys.argv:
            super().log_message(format, *args)

    def end_headers(self) -> None:
        # Previne cache de respostas de API e garante suporte a CORS local
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.end_headers()

    def do_GET(self) -> None:
        global LAST_HEARTBEAT
        if self.path == "/api/ping" or self.path.startswith("/api/ping?"):
            LAST_HEARTBEAT = time.time()
            self._send_json({
                "sucesso": True,
                "status": "online",
                "modo": self.modo_execucao,
                "timestamp": time.time(),
            })
            return

        # Roteamento SPA: se o arquivo não existir fisicamente, serve o index.html
        dist_dir = get_dist_directory()
        req_path = self.path.split("?")[0].lstrip("/")
        full_path = os.path.join(dist_dir, req_path)

        if not os.path.exists(full_path) or os.path.isdir(full_path) or req_path == "":
            index_path = os.path.join(dist_dir, "index.html")
            if os.path.exists(index_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                with open(index_path, "rb") as f:
                    content = f.read()
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        return super().do_GET()

    def do_POST(self) -> None:
        global LAST_HEARTBEAT
        LAST_HEARTBEAT = time.time()

        if self.path == "/api/ping":
            self._send_json({"sucesso": True, "status": "online", "modo": self.modo_execucao})
            return

        if self.path.startswith("/api/"):
            metodo_nome = self.path[5:].split("?")[0]
            metodo = getattr(self.api_instance, metodo_nome, None)

            if not callable(metodo):
                self._send_json(
                    {"sucesso": False, "erro": f"Método '{metodo_nome}' não encontrado na API."},
                    status=404,
                )
                return

            try:
                content_length = int(self.headers.get("Content-Length", 0))
                if content_length > 0:
                    raw_body = self.rfile.read(content_length).decode("utf-8")
                    payload = json.loads(raw_body) if raw_body else {}
                else:
                    payload = {}

                args = payload.get("args", [])
                kwargs = payload.get("kwargs", {})

                if isinstance(args, list) and isinstance(kwargs, dict):
                    resultado = metodo(*args, **kwargs)
                elif isinstance(args, list):
                    resultado = metodo(*args)
                else:
                    resultado = metodo()

                self._send_json(resultado)
            except Exception as e:
                self._send_json({"sucesso": False, "erro": str(e)}, status=500)
            return

        self.send_response(404)
        self.end_headers()

    def _send_json(self, data: Any, status: int = 200) -> None:
        """Auxiliar para enviar respostas JSON codificadas em UTF-8."""
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            pass


def _heartbeat_watchdog_loop() -> None:
    """Monitora a inatividade e encerra o processo se todas as abas forem fechadas."""
    time.sleep(15)  # Período de carência inicial para o navegador abrir e carregar
    while ENABLE_WATCHDOG:
        time.sleep(5)
        inatividade = time.time() - LAST_HEARTBEAT
        if inatividade > HEARTBEAT_TIMEOUT_SECONDS:
            print(f"[Watchdog] Nenhuma aba ativa há {int(inatividade)}s. Encerrando servidor local.")
            os._exit(0)


def start_http_server(
    port: int = DEFAULT_PORT,
    api_instance: Optional[Api] = None,
    modo_execucao: str = "navegador",
    enable_watchdog: bool = True,
) -> http.server.ThreadingHTTPServer:
    """Inicia o servidor HTTP local em uma thread dedicada."""
    global SERVER_INSTANCE, ENABLE_WATCHDOG, LAST_HEARTBEAT, SERVER_START_TIME

    if api_instance is None:
        api_instance = Api()

    CotacaoHTTPRequestHandler.api_instance = api_instance
    CotacaoHTTPRequestHandler.modo_execucao = modo_execucao

    LAST_HEARTBEAT = time.time()
    SERVER_START_TIME = time.time()
    ENABLE_WATCHDOG = enable_watchdog and (modo_execucao == "navegador")

    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), CotacaoHTTPRequestHandler)
    SERVER_INSTANCE = server

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    if ENABLE_WATCHDOG:
        watchdog_thread = threading.Thread(target=_heartbeat_watchdog_loop, daemon=True)
        watchdog_thread.start()

    return server
