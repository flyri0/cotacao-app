import os
import sqlite3
from typing import Optional

from backend.core.config import get_db_path


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Retorna uma conexão com o banco SQLite configurada com suporte a chaves estrangeiras e alta performance."""
    if db_path is None:
        db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    if db_path != ":memory:":
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")
        except Exception:
            pass
    conn.execute("PRAGMA cache_size = -64000;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    return conn


class DatabaseLock:
    """Mantém o arquivo SQLite aberto em modo r+b exclusivo para bloquear deleção/renomeação no Windows Explorer."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._file_handle = None

    def acquire(self) -> None:
        if self.db_path != ":memory:" and os.path.exists(self.db_path):
            try:
                if self._file_handle is None:
                    self._file_handle = open(self.db_path, "r+b")
            except Exception as e:
                print(f"Aviso ao adquirir lock de arquivo do banco: {e}")

    def release(self) -> None:
        if self._file_handle is not None:
            try:
                self._file_handle.close()
            except Exception:
                pass
            finally:
                self._file_handle = None
