import os
import sys
import webview
from api import Api
from db import init_db

DEV_URL = "http://localhost:5173"


def is_dev() -> bool:
    """Retorna True se estiver em modo desenvolvimento (apontando pro Vite dev server)."""
    if getattr(sys, "frozen", False):
        return False
    if "--prod" in sys.argv or os.environ.get("ENV") == "production":
        return False
    if "--dev" in sys.argv:
        return True
    return True


def get_entry_url() -> str:
    """Retorna a URL ou caminho do index.html para carregar na janela pywebview."""
    if is_dev():
        return DEV_URL

    # Em modo empacotado (PyInstaller), os assets ficam embutidos em sys._MEIPASS
    base_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    dist_file = os.path.join(base_dir, "frontend", "dist", "index.html")
    return dist_file


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


def main() -> None:
    # Instancia a API que será exposta para o frontend (window.pywebview.api)
    api = Api()

    url = get_entry_url()

    window = webview.create_window(
        title="Mapa Comparativo de Cotações",
        url=url,
        width=1280,
        height=850,
        min_size=(900, 600),
        js_api=api,
    )

    window.events.closing += confirm_closing

    webview.start(debug=is_dev())


if __name__ == "__main__":
    main()
