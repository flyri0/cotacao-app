import os
import sys
import time
import webbrowser
from typing import Optional
from backend.api import Api
from backend.core.schema import init_db
from backend.server import DEFAULT_PORT, is_server_already_running, start_http_server

DEV_URL = "http://localhost:5173"


def is_dev() -> bool:
    """Retorna True se estiver em modo desenvolvimento (apontando pro Vite dev server)."""
    if getattr(sys, "frozen", False):
        return False
    if "--prod" in sys.argv or os.environ.get("ENV") == "production":
        return False
    if "--dev" in sys.argv:
        return True
    # Se não houver build gerado em frontend/dist, assume modo dev
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_index = os.path.join(base_dir, "frontend", "dist", "index.html")
    return not os.path.exists(dist_index)


def get_entry_url(port: int = DEFAULT_PORT) -> str:
    """Retorna a URL do aplicativo para carregar no navegador ou na janela pywebview."""
    if is_dev():
        return DEV_URL
    return f"http://127.0.0.1:{port}"


def confirm_closing() -> bool:
    """Exibe confirmação nativa do Windows ao tentar fechar o aplicativo."""
    try:
        import ctypes

        MB_YESNO = 0x00000004
        MB_ICONQUESTION = 0x00000020
        IDYES = 6

        res = ctypes.windll.user32.MessageBoxW(
            0,
            "Deseja realmente sair do Mapa de Cotações?",
            "Confirmar Saída - Mapa de Cotações",
            MB_YESNO | MB_ICONQUESTION,
        )
        return res == IDYES
    except Exception:
        return True


def parse_port() -> int:
    """Obtém a porta a partir dos argumentos da linha de comando, se informada."""
    for i, arg in enumerate(sys.argv):
        if arg in ("--port", "-p") and i + 1 < len(sys.argv):
            try:
                return int(sys.argv[i + 1])
            except ValueError:
                pass
    return DEFAULT_PORT


def main() -> None:
    port = parse_port()
    api = Api()

    # Executa verificação de backup automático na abertura se configurado
    api.check_auto_backup_trigger("abertura")

    # 1. CONTROLE DE INSTÂNCIA ÚNICA (SINGLE INSTANCE)
    if is_server_already_running(port):
        url = get_entry_url(port)
        print(f"[Instância Ativa] O Mapa de Cotações já está em execução. Reabrindo no navegador: {url}")
        webbrowser.open(url)
        sys.exit(0)

    # 2. DETERMINAÇÃO DO MODO DE EXECUÇÃO (JANELA vs NAVEGADOR)
    if "--browser" in sys.argv:
        modo = "navegador"
    elif "--window" in sys.argv:
        modo = "janela"
    else:
        try:
            configs = api.get_settings()
            modo = configs.get("app_modo_execucao", "janela")
        except Exception:
            modo = "janela"

    # Inicia o micro-servidor HTTP local em background
    start_http_server(
        port=port,
        api_instance=api,
        modo_execucao=modo,
        enable_watchdog=(modo == "navegador"),
    )

    url = get_entry_url(port)

    # 3. EXECUÇÃO EM MODO NAVEGADOR
    if modo == "navegador":
        print(f"[Servidor Local] Iniciado com sucesso em {url}. Abrindo navegador padrão...")
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[Servidor Local] Encerrado pelo usuário.")
            sys.exit(0)
        return

    # 4. EXECUÇÃO EM MODO JANELA NATIVA (COM FALLBACK AUTOMÁTICO PARA O NAVEGADOR)
    try:
        import webview

        # No pywebview, em modo empacotado podemos carregar diretamente o arquivo local ou a URL local
        window_url = url if is_dev() else os.path.join(
            getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__))),
            "frontend", "dist", "index.html"
        )
        if not os.path.exists(window_url):
            window_url = url

        window = webview.create_window(
            title="Mapa Comparativo de Cotações",
            url=window_url,
            width=1280,
            height=850,
            min_size=(900, 600),
            js_api=api,
        )

        window.events.closing += confirm_closing
        webview.start(debug=is_dev())
    except Exception as e:
        print(f"[Aviso] Falha ao iniciar janela nativa ({e}). Executando fallback automático para o navegador padrão...")
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[Servidor Local] Encerrado.")
            sys.exit(0)


if __name__ == "__main__":
    main()
