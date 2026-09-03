import os
import sys
from typing import Optional, List, Dict, Any


def select_save_file_dialog(
    default_filename: str, file_types: List[str] = ("Todos os Arquivos (*.*)",)
) -> Optional[str]:
    """Abre diálogo para salvar arquivo via pywebview se disponível."""
    try:
        import webview
        windows = getattr(webview, "windows", [])
        if windows and len(windows) > 0:
            window = windows[0]
            result = window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=default_filename,
                file_types=file_types,
            )
            if result:
                return result[0] if isinstance(result, (list, tuple)) else str(result)
            return ""  # Usuário cancelou
    except Exception as e:
        print(f"Aviso ao abrir diálogo de salvamento: {e}")
    return None  # Webview não disponível


def select_directory_dialog(title: str = "Selecione uma Pasta") -> Dict[str, Any]:
    """Abre diálogo para seleção de pasta via pywebview ou fallback para tkinter."""
    pasta_selecionada = None

    # 1. Tenta via pywebview
    try:
        import webview
        windows = getattr(webview, "windows", [])
        if windows and len(windows) > 0:
            window = windows[0]
            caminhos = window.create_file_dialog(webview.FOLDER_DIALOG)
            if caminhos:
                if isinstance(caminhos, (list, tuple)) and len(caminhos) > 0:
                    pasta_selecionada = caminhos[0]
                elif isinstance(caminhos, str):
                    pasta_selecionada = caminhos
            else:
                return {"sucesso": False, "cancelado": True, "caminho": ""}
    except Exception as e:
        print(f"Aviso ao abrir diálogo de pasta nativo: {e}")

    # 2. Fallback para tkinter
    if not pasta_selecionada:
        try:
            import tkinter as tk
            from tkinter import filedialog

            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            pasta = filedialog.askdirectory(title=title)
            root.destroy()

            if pasta:
                pasta_selecionada = pasta
            else:
                return {"sucesso": False, "cancelado": True, "caminho": ""}
        except Exception as e:
            return {
                "sucesso": False,
                "cancelado": False,
                "caminho": "",
                "mensagem": f"Não foi possível abrir o seletor de pastas: {e}",
            }

    if not pasta_selecionada or not str(pasta_selecionada).strip():
        return {"sucesso": False, "cancelado": True, "caminho": ""}

    pasta_limpa = os.path.abspath(str(pasta_selecionada).strip())

    # Testa permissão de escrita
    try:
        os.makedirs(pasta_limpa, exist_ok=True)
        teste_arq = os.path.join(pasta_limpa, ".write_test_cotacao.tmp")
        with open(teste_arq, "w", encoding="utf-8") as f:
            f.write("test")
        os.remove(teste_arq)
    except Exception as e:
        return {
            "sucesso": False,
            "cancelado": False,
            "caminho": pasta_limpa,
            "mensagem": f"Sem permissão de escrita no diretório selecionado: {e}",
        }

    return {"sucesso": True, "cancelado": False, "caminho": pasta_limpa}
