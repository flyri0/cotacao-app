import json
import os
import sys
from typing import Optional

CONFIG_FILE_NAME = "app_config.json"
DEFAULT_DB_NAME = "cotacao.db"


def get_project_root() -> str:
    """Retorna o diretório raiz do projeto ou o diretório do executável congelado."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    # backend/core/config.py -> backend/core -> backend -> root
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_app_config_path() -> str:
    """Retorna o caminho absoluto do arquivo app_config.json que armazena o local do último banco usado."""
    return os.path.join(get_project_root(), "app_config.json")


def get_default_db_path() -> str:
    """Retorna o caminho padrão para o arquivo cotacao.db no diretório da aplicação."""
    return os.path.join(get_project_root(), "cotacao.db")


def get_last_db_path() -> Optional[str]:
    """
    Retorna o caminho do último banco de dados utilizado registrado em app_config.json.
    Retorna None se a configuração não existir ou se o arquivo físico não for encontrado no disco.
    """
    db_mod = sys.modules.get("backend.db") or sys.modules.get("backend.core.config") or sys.modules.get("db")
    get_cfg_fn = getattr(db_mod, "get_app_config_path", get_app_config_path)
    config_file = get_cfg_fn()
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                path = data.get("ultimo_banco_path")
                if path and os.path.exists(path):
                    return os.path.abspath(path)
        except Exception as e:
            print(f"Aviso ao ler app_config.json: {e}")
    return None


def set_last_db_path(db_path: str) -> None:
    """Registra o caminho do banco ativo no arquivo app_config.json."""
    if not db_path or db_path == ":memory:":
        return
    db_mod = sys.modules.get("backend.db") or sys.modules.get("backend.core.config") or sys.modules.get("db")
    get_cfg_fn = getattr(db_mod, "get_app_config_path", get_app_config_path)
    config_file = get_cfg_fn()
    try:
        data = {}
        if os.path.exists(config_file):
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        data["ultimo_banco_path"] = os.path.abspath(db_path)
        pasta = os.path.dirname(os.path.abspath(config_file))
        if pasta and not os.path.exists(pasta):
            os.makedirs(pasta, exist_ok=True)
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Aviso ao salvar app_config.json: {e}")


def get_db_path() -> str:
    """Retorna o caminho do banco SQLite ativo (último salvo se existir no disco, ou padrão)."""
    db_mod = sys.modules.get("backend.db") or sys.modules.get("db") or sys.modules.get("backend.core.config")
    get_last_fn = getattr(db_mod, "get_last_db_path", get_last_db_path)
    get_def_fn = getattr(db_mod, "get_default_db_path", get_default_db_path)

    last = get_last_fn()
    if last and os.path.exists(last):
        return last
    return get_def_fn()


DB_PATH = get_db_path()
