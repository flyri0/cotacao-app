import json
import os
import socket
import tempfile
import unittest
import urllib.request
from api import Api
from db import init_db
from server import start_http_server, is_server_already_running


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
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                self.fail("Deveria ter retornado HTTP 404")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 404)
            data = json.loads(e.read().decode("utf-8"))
            self.assertFalse(data.get("sucesso"))


if __name__ == "__main__":
    unittest.main()
