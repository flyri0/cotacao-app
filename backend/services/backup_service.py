import base64
import os
import shutil
import sqlite3
import threading
import time
from datetime import datetime
from typing import Dict, Any, Optional, Callable


class BackupManager:
    """Gerenciador central de backups automáticos atômicos, rotação, exportação e restauração."""

    def __init__(self, api_instance):
        self.api = api_instance
        self._worker_started = False

    def export_database(self) -> Dict[str, Any]:
        """Exporta o arquivo do banco SQLite codificado em base64 para download/backup."""
        db_path = self.api.db_path
        if not os.path.exists(db_path):
            raise FileNotFoundError("Arquivo de banco de dados não encontrado.")

        with open(db_path, "rb") as f:
            conteudo = f.read()
            encoded = base64.b64encode(conteudo).decode("utf-8")

        nome_arquivo = f"backup_cotacao_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        return {"sucesso": True, "nome_arquivo": nome_arquivo, "conteudo_base64": encoded}

    def salvar_backup_em_caminho(self, caminho_destino: str) -> Dict[str, Any]:
        """Copia atomicamente o arquivo SQLite local para o caminho de destino."""
        caminho_destino = str(caminho_destino).strip() if caminho_destino else ""
        if not caminho_destino:
            raise ValueError("O caminho de destino do backup não pode ser vazio.")

        db_path = self.api.db_path
        if not os.path.exists(db_path):
            raise FileNotFoundError("Arquivo de banco de dados original não encontrado.")

        pasta = os.path.dirname(os.path.abspath(caminho_destino))
        os.makedirs(pasta, exist_ok=True)
        shutil.copy2(db_path, caminho_destino)

        tamanho = os.path.getsize(caminho_destino)
        return {
            "sucesso": True,
            "cancelado": False,
            "caminho": os.path.abspath(caminho_destino),
            "nome_arquivo": os.path.basename(caminho_destino),
            "tamanho_bytes": tamanho,
            "mensagem": f"Backup salvo com sucesso em {caminho_destino}.",
        }

    def execute_auto_backup(self, origem_gatilho: str = "manual") -> Dict[str, Any]:
        """Executa a cópia atômica do SQLite para a pasta configurada com rotação."""
        configs = self.api.get_settings()
        diretorio = configs.get("backup_auto_diretorio", "").strip()
        if not diretorio:
            msg = "Nenhum diretório de backup configurado."
            self._registrar_status("Falha: diretório não configurado")
            raise ValueError(msg)

        try:
            max_arquivos = int(configs.get("backup_auto_max_arquivos", "10"))
            if max_arquivos < 1:
                max_arquivos = 10
        except (ValueError, TypeError):
            max_arquivos = 10

        try:
            os.makedirs(diretorio, exist_ok=True)
        except Exception as e:
            msg = f"Não foi possível acessar ou criar a pasta de backup: {e}"
            self._registrar_status(f"Falha: {msg}")
            raise PermissionError(msg)

        try:
            teste_arq = os.path.join(diretorio, ".write_test_cotacao.tmp")
            with open(teste_arq, "w", encoding="utf-8") as f:
                f.write("test")
            os.remove(teste_arq)
        except Exception as e:
            msg = f"Sem permissão de escrita no diretório '{diretorio}': {e}"
            self._registrar_status("Falha: sem permissão de escrita")
            raise PermissionError(msg)

        agora = datetime.now()
        timestamp_str = agora.strftime("%Y%m%d_%H%M%S")
        data_hora_legivel = agora.strftime("%d/%m/%Y %H:%M:%S")
        nome_arquivo = f"backup_auto_cotacao_{timestamp_str}.db"
        caminho_destino = os.path.join(diretorio, nome_arquivo)

        # Cópia atômica segura usando self.api._get_connection()
        try:
            with self.api._get_connection() as src_conn:
                dest_conn = sqlite3.connect(caminho_destino)
                try:
                    src_conn.backup(dest_conn)
                finally:
                    dest_conn.close()
        except Exception as e:
            msg = f"Falha durante a cópia atômica do banco: {e}"
            self._registrar_status(f"Falha: {msg}")
            raise RuntimeError(msg)

        tamanho = os.path.getsize(caminho_destino) if os.path.exists(caminho_destino) else 0

        # Rotação de arquivos excedentes
        removidos_count = 0
        try:
            arquivos_backup = []
            for item in os.listdir(diretorio):
                if item.startswith("backup_auto_cotacao_") and item.endswith(".db"):
                    caminho_item = os.path.join(diretorio, item)
                    if os.path.isfile(caminho_item):
                        arquivos_backup.append((os.path.getmtime(caminho_item), caminho_item))

            arquivos_backup.sort(key=lambda x: x[0])
            if len(arquivos_backup) > max_arquivos:
                excedente = len(arquivos_backup) - max_arquivos
                for i in range(excedente):
                    try:
                        os.remove(arquivos_backup[i][1])
                        removidos_count += 1
                    except Exception:
                        pass
        except Exception as e:
            print(f"[Backup Automático] Erro na rotação de backups: {e}")

        self._registrar_status("Sucesso", data_hora_legivel)

        msg_sucesso = f"Backup realizado com sucesso ({origem_gatilho}): {nome_arquivo} ({tamanho} bytes)"
        print(f"[Backup Automático] {msg_sucesso}")

        return {
            "sucesso": True,
            "cancelado": False,
            "caminho": caminho_destino,
            "nome_arquivo": nome_arquivo,
            "tamanho_bytes": tamanho,
            "data_hora": data_hora_legivel,
            "removidos_rotacao": removidos_count,
            "mensagem": f"Backup automático gerado com sucesso em {nome_arquivo}.",
        }

    def _registrar_status(self, status: str, data_hora: Optional[str] = None) -> None:
        try:
            payload = {"backup_auto_ultimo_status": status}
            if data_hora:
                payload["backup_auto_ultimo_sucesso"] = data_hora
            self.api.save_settings(payload)
        except Exception:
            pass

    def check_auto_backup_trigger(self, gatilho: str) -> Optional[Dict[str, Any]]:
        try:
            configs = self.api.get_settings()
            if configs.get("backup_auto_ativo", "0") != "1":
                return None

            diretorio = configs.get("backup_auto_diretorio", "").strip()
            if not diretorio:
                return None

            gatilho_config = configs.get("backup_auto_gatilho", "abertura")

            deve_executar = False
            if gatilho_config == "sempre":
                deve_executar = True
            elif gatilho in ("abertura", "fechamento") and gatilho_config == gatilho:
                deve_executar = True
            elif gatilho == "periodico" and gatilho_config in ("periodico", "sempre"):
                try:
                    intervalo_horas = float(configs.get("backup_auto_intervalo_horas", "4"))
                except (ValueError, TypeError):
                    intervalo_horas = 4.0

                ultimo_sucesso = configs.get("backup_auto_ultimo_sucesso", "")
                if not ultimo_sucesso:
                    deve_executar = True
                else:
                    try:
                        dt_ultimo = datetime.strptime(ultimo_sucesso, "%d/%m/%Y %H:%M:%S")
                        horas_passadas = (datetime.now() - dt_ultimo).total_seconds() / 3600.0
                        if horas_passadas >= intervalo_horas:
                            deve_executar = True
                    except Exception:
                        deve_executar = True

            if deve_executar:
                return self.execute_auto_backup(origem_gatilho=gatilho)
            return None
        except (sqlite3.ProgrammingError, sqlite3.OperationalError):
            return None
        except Exception as e:
            print(f"[Backup Automático] Erro ao verificar gatilho '{gatilho}': {e}")
            return None

    def start_worker_thread(self) -> None:
        if self._worker_started:
            return
        self._worker_started = True

        def _worker():
            while True:
                time.sleep(300)
                try:
                    self.check_auto_backup_trigger("periodico")
                except Exception:
                    pass

        threading.Thread(target=_worker, daemon=True).start()

    def on_app_exit(self) -> None:
        try:
            self.check_auto_backup_trigger("fechamento")
        except Exception:
            pass

    def import_database(self, conteudo_base64: str) -> Dict[str, Any]:
        from backend.core.config import set_last_db_path
        import tempfile

        try:
            dados = base64.b64decode(conteudo_base64)
            fd, temp_path = tempfile.mkstemp(suffix=".db")
            with os.fdopen(fd, "wb") as f:
                f.write(dados)

            # Valida integridade ANTES de substituir
            try:
                temp_conn = sqlite3.connect(temp_path)
                cursor = temp_conn.cursor()
                cursor.execute("PRAGMA integrity_check;")
                status = cursor.fetchone()[0]
                temp_conn.close()
                if status != "ok":
                    raise ValueError(f"Integridade do banco comprometida: {status}")
            except Exception as e:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                raise ValueError(f"Falha ao validar banco de dados importado: {e}")

            self.api._release_lock()
            path = self.api.db_path
            set_last_db_path(path)
            shutil.move(temp_path, path)
            self.api._ensure_lock()
            return {"sucesso": True, "caminho": path, "mensagem": "Banco de dados restaurado com sucesso."}
        except Exception as e:
            self.api._ensure_lock()
            raise ValueError(f"Falha ao restaurar banco de dados: {e}")
