import json
import os
import socket
import tempfile
import unittest
import urllib.request

from backend.api import Api
from backend.db import init_db
from backend.server import is_server_already_running, start_http_server


def get_free_port() -> int:
    """Encontra uma porta TCP livre no sistema para testes."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class TestHttpServer(unittest.TestCase):
    """Testes unitários para o micro-servidor HTTP local e roteamento da API."""

    @classmethod
    def setUpClass(cls):
        cls.port = get_free_port()
        # Cria um banco de dados temporário em arquivo
        cls.tmp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        cls.tmp_file.close()
        cls.db_path = cls.tmp_file.name

        init_db(cls.db_path)
        cls.api = Api(db_path=cls.db_path)
        cls.server = start_http_server(
            port=cls.port,
            api_instance=cls.api,
            modo_execucao="navegador",
            enable_watchdog=False,
        )

    @classmethod
    def tearDownClass(cls):
        try:
            cls.server.shutdown()
            cls.server.server_close()
        except Exception:
            pass

        if os.path.exists(cls.db_path):
            try:
                os.remove(cls.db_path)
            except Exception:
                pass

    def test_is_server_already_running(self):
        """Valida que is_server_already_running detecta a porta ativa e rejeita portas inativas."""
        self.assertTrue(is_server_already_running(self.port))
        self.assertFalse(is_server_already_running(self.port + 100))

    def test_ping_endpoint_get_and_post(self):
        """Valida a rota /api/ping via GET e POST."""
        # Teste GET
        url = f"http://127.0.0.1:{self.port}/api/ping"
        with urllib.request.urlopen(url, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("sucesso"))
            self.assertEqual(data.get("status"), "online")

        # Teste POST
        req = urllib.request.Request(url, data=b"", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("sucesso"))

    def test_api_post_method_execution(self):
        """Valida execução dinâmica de métodos da API via HTTP POST."""
        url = f"http://127.0.0.1:{self.port}/api/get_settings"
        req = urllib.request.Request(
            url,
            data=json.dumps({"args": []}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("app_nome", data)
            self.assertIn("app_modo_execucao", data)

    def test_api_method_with_arguments(self):
        """Valida execução de método com passagem de argumentos."""
        # Cria um produto via API HTTP
        url_criar = f"http://127.0.0.1:{self.port}/api/create_product"
        payload = {"args": ["Produto Teste HTTP", "Alimentos"]}
        req = urllib.request.Request(
            url_criar,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data.get("nome"), "Produto Teste HTTP")
            self.assertEqual(data.get("categoria"), "Alimentos")
            self.assertIsNotNone(data.get("id"))

    def test_api_method_not_found(self):
        """Valida retorno 404 quando o método solicitado não existe."""
        url = f"http://127.0.0.1:{self.port}/api/metodo_totalmente_inexistente_xyz"
        req = urllib.request.Request(
            url,
            data=json.dumps({"args": []}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=2.0):
                self.fail("Deveria ter retornado HTTP 404")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 404)
            data = json.loads(e.read().decode("utf-8"))
            self.assertFalse(data.get("sucesso"))

    def test_options_cors_preflight(self):
        """Valida que requisições OPTIONS retornam 200 com cabeçalhos CORS."""
        url = f"http://127.0.0.1:{self.port}/api/ping"
        req = urllib.request.Request(url, method="OPTIONS")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "*")
            self.assertIn("GET, POST, OPTIONS", resp.headers.get("Access-Control-Allow-Methods", ""))

    def test_spa_routing_get_index(self):
        """Valida que rotas desconhecidas via GET retornam o index.html da SPA."""
        url = f"http://127.0.0.1:{self.port}/comparacao"
        with urllib.request.urlopen(url, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn("text/html", resp.headers.get("Content-Type", ""))

    def test_post_payload_variations_and_errors(self):
        """Valida diferentes formatos de payload POST, erro 500 e rota fora de /api/."""
        # 1. POST com Content-Length 0 (linha 123)
        url_ping = f"http://127.0.0.1:{self.port}/api/get_settings"
        req_vazio = urllib.request.Request(url_ping, data=b"", headers={"Content-Length": "0"})
        with urllib.request.urlopen(req_vazio, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)

        # 2. POST com payload kwargs inválido (linhas 130-131: apenas args lista)
        req_args_only = urllib.request.Request(
            url_ping,
            data=json.dumps({"args": [], "kwargs": "nao_dicionario"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req_args_only, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)

        # 3. POST com args não lista (linhas 132-133)
        req_no_args = urllib.request.Request(
            url_ping,
            data=json.dumps({"args": "nao_lista"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req_no_args, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)

        # 4. POST causando erro 500 no método (linhas 136-137)
        url_err = f"http://127.0.0.1:{self.port}/api/create_product"
        req_500 = urllib.request.Request(
            url_err,
            data=json.dumps({"args": [""]}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req_500, timeout=2.0) as resp:
                self.fail("Deveria retornar 500")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 500)
            data = json.loads(e.read().decode("utf-8"))
            self.assertFalse(data.get("sucesso"))

        # 5. POST fora de /api/ -> 404 (linhas 140-141)
        url_fora = f"http://127.0.0.1:{self.port}/outra_rota"
        req_fora = urllib.request.Request(url_fora, data=b"{}", headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req_fora, timeout=2.0) as resp:
                self.fail("Deveria retornar 404")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 404)

    def test_send_json_serialization_error_and_logging(self):
        """Valida fallback de erro de serialização em _send_json e flag --debug."""
        import sys
        from unittest.mock import patch

        from backend.server import CotacaoHTTPRequestHandler

        class DummyCotacaoHandler(CotacaoHTTPRequestHandler):
            def __init__(self):
                pass

        dh = DummyCotacaoHandler()
        CotacaoHTTPRequestHandler._send_json(dh, {"objeto": object()})

        # Testar log_message com --debug (linha 54)
        with patch.object(sys, "argv", ["app.py", "--debug"]):
            with patch("http.server.SimpleHTTPRequestHandler.log_message") as mock_super_log:
                dh.log_message("Teste %s", "debug")
                mock_super_log.assert_called_once()

    def test_server_startup_options_and_watchdog(self):
        """Valida inicialização do servidor com api_instance=None e o loop do watchdog."""
        import time
        from unittest.mock import patch

        import backend.server as server
        from backend.server import _heartbeat_watchdog_loop, start_http_server

        # Testar _heartbeat_watchdog_loop expirado acionando os._exit (linhas 158-164)
        server.ENABLE_WATCHDOG = True
        server.LAST_HEARTBEAT = time.time() - (server.HEARTBEAT_TIMEOUT_SECONDS + 50)
        try:
            with patch("time.sleep"), patch("os._exit", side_effect=SystemExit(0)) as mock_exit:
                try:
                    _heartbeat_watchdog_loop()
                except SystemExit:
                    pass
                mock_exit.assert_called_once_with(0)
        finally:
            server.ENABLE_WATCHDOG = False

        # Testar start_http_server com api_instance=None e enable_watchdog=True (linhas 177, 193-194)
        porta_temp = get_free_port()
        with patch.object(server, "_heartbeat_watchdog_loop"):
            srv = start_http_server(
                port=porta_temp,
                api_instance=None,
                modo_execucao="navegador",
                enable_watchdog=True,
            )
            try:
                self.assertIsNotNone(srv)
            finally:
                srv.shutdown()
                srv.server_close()


if __name__ == "__main__":
    unittest.main()
