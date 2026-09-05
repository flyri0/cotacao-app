import os
import sys
import unittest
from unittest.mock import MagicMock, patch

from app import DEFAULT_PORT, DEV_URL, confirm_closing, get_entry_url, is_dev, main, parse_port


class TestApp(unittest.TestCase):
    """Testes unitários para o launcher da aplicação app.py."""

    def test_is_dev_scenarios(self) -> None:
        """Valida detecção de ambiente de desenvolvimento vs produção."""
        # 1. sys.frozen = True
        with patch.object(sys, "frozen", True, create=True):
            self.assertFalse(is_dev())

        # 2. Flag --prod
        with patch.object(sys, "frozen", False, create=True), patch.object(sys, "argv", ["app.py", "--prod"]):
            self.assertFalse(is_dev())

        # 3. Variável de ambiente ENV=production
        with patch.object(sys, "frozen", False, create=True), patch.dict(os.environ, {"ENV": "production"}):
            self.assertFalse(is_dev())

        # 4. Flag --dev
        with patch.object(sys, "frozen", False, create=True), patch.object(sys, "argv", ["app.py", "--dev"]):
            self.assertTrue(is_dev())

        # 5. Ausência de dist/index.html
        with patch.object(sys, "frozen", False, create=True), patch.object(sys, "argv", ["app.py"]), patch(
            "os.path.exists", return_value=False
        ):
            self.assertTrue(is_dev())

    def test_get_entry_url(self) -> None:
        """Valida URL gerada para dev e porta configurada."""
        with patch("app.is_dev", return_value=True):
            self.assertEqual(get_entry_url(54321), DEV_URL)

        with patch("app.is_dev", return_value=False):
            self.assertEqual(get_entry_url(8080), "http://127.0.0.1:8080")

    def test_parse_port(self) -> None:
        """Valida parsing de portas passadas via linha de comando."""
        with patch.object(sys, "argv", ["app.py", "--port", "9090"]):
            self.assertEqual(parse_port(), 9090)

        with patch.object(sys, "argv", ["app.py", "-p", "7070"]):
            self.assertEqual(parse_port(), 7070)

        with patch.object(sys, "argv", ["app.py", "--port", "invalido"]):
            self.assertEqual(parse_port(), DEFAULT_PORT)

        with patch.object(sys, "argv", ["app.py"]):
            self.assertEqual(parse_port(), DEFAULT_PORT)

    def test_confirm_closing(self) -> None:
        """Valida diálogo nativo de confirmação de encerramento."""
        # Sucesso: Usuário clica em 'Sim' (IDYES = 6)
        mock_user32 = MagicMock()
        mock_user32.MessageBoxW.return_value = 6
        with patch("ctypes.windll.user32", mock_user32):
            self.assertTrue(confirm_closing())

        # Usuário clica em 'Não' (IDNO = 7)
        mock_user32.MessageBoxW.return_value = 7
        with patch("ctypes.windll.user32", mock_user32):
            self.assertFalse(confirm_closing())

        # Exceção no ctypes -> fallback True
        with patch("ctypes.windll.user32.MessageBoxW", side_effect=RuntimeError("Dialog error")):
            self.assertTrue(confirm_closing())

    def test_main_single_instance_active(self) -> None:
        """Valida comportamento quando o servidor já está ativo (Single Instance)."""
        with patch("app.is_server_already_running", return_value=True):
            with patch("webbrowser.open") as mock_open:
                with patch("app.Api") as mock_api:
                    mock_api_inst = MagicMock()
                    mock_api.return_value = mock_api_inst
                    with self.assertRaises(SystemExit) as cm:
                        main()
                    self.assertEqual(cm.exception.code, 0)
                    mock_open.assert_called_once()

    def test_main_browser_mode(self) -> None:
        """Valida execução em modo navegador."""
        with patch("app.is_server_already_running", return_value=False):
            with patch.object(sys, "argv", ["app.py", "--browser"]):
                with patch("app.start_http_server") as mock_start_srv:
                    with patch("webbrowser.open") as mock_open:
                        with patch("time.sleep", side_effect=KeyboardInterrupt):
                            with patch("app.Api") as mock_api:
                                mock_api.return_value = MagicMock()
                                with self.assertRaises(SystemExit) as cm:
                                    main()
                                self.assertEqual(cm.exception.code, 0)
                                mock_start_srv.assert_called_once()
                                mock_open.assert_called_once()

    def test_main_window_mode_success(self) -> None:
        """Valida execução em modo janela nativa com pywebview."""
        mock_win = MagicMock()
        mock_wv = MagicMock()
        mock_wv.create_window.return_value = mock_win

        with patch("app.is_server_already_running", return_value=False):
            with patch.object(sys, "argv", ["app.py", "--window"]):
                with patch("app.start_http_server"):
                    with patch.dict(sys.modules, {"webview": mock_wv}):
                        with patch("app.Api") as mock_api:
                            mock_api.return_value = MagicMock()
                            with patch("os.path.exists", return_value=True):
                                main()
                                mock_wv.create_window.assert_called_once()
                                mock_wv.start.assert_called_once()

    def test_main_window_mode_fallback_to_browser(self) -> None:
        """Valida fallback para o navegador quando o pywebview falha."""
        mock_wv = MagicMock()
        mock_wv.create_window.side_effect = RuntimeError("WebView2 ausente")

        with patch("app.is_server_already_running", return_value=False):
            with patch.object(sys, "argv", ["app.py", "--window"]):
                with patch("app.start_http_server"):
                    with patch.dict(sys.modules, {"webview": mock_wv}):
                        with patch("webbrowser.open") as mock_open:
                            with patch("time.sleep", side_effect=KeyboardInterrupt):
                                with patch("app.Api") as mock_api:
                                    mock_api.return_value = MagicMock()
                                    with self.assertRaises(SystemExit) as cm:
                                        main()
                                    self.assertEqual(cm.exception.code, 0)
                                    mock_open.assert_called_once()


if __name__ == "__main__":
    unittest.main()
