import atexit
import base64
import contextlib
import os
import sqlite3
import sys
import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.config import get_default_db_path, get_last_db_path, set_last_db_path
from backend.core.database import get_connection, DatabaseLock
from backend.core.schema import (
    check_db_status_db,
    initialize_empty_db_db,
    format_database_db,
    create_schema,
)
from backend.domain.configuracoes import (
    get_db_settings,
    save_db_setting,
    save_all_db_settings,
    seed_settings,
)
from backend.domain.produtos import (
    list_products_db,
    create_product_db,
    update_product_db,
    alternar_status_produto_db,
    get_product_statistics_db,
    verificar_historico_produto_db,
)
from backend.domain.fornecedores import (
    list_suppliers_db,
    create_supplier_db,
    update_supplier_db,
    alternar_status_fornecedor_db,
    get_supplier_statistics_db,
    verificar_historico_fornecedor_db,
)
from backend.domain.rodadas import (
    list_rounds_with_metrics_db,
    create_round_db,
    update_round_db,
    remove_round_db,
    check_round_dependencies_db,
    duplicate_round_needs_db,
    verificar_rodada_aberta,
    verificar_historico_rodada_db,
)
from backend.domain.necessidades import (
    list_needs_db,
    create_need_db,
    remove_need_db,
)
from backend.domain.cotacoes import (
    list_quotes_db,
    save_quote_db,
    remove_quote_db,
    get_quote_matrix_db,
    get_global_quotes_history_db,
)
from backend.domain.alocacoes import (
    list_allocations_db,
    save_allocations_db,
    remove_allocation_db,
)
from backend.services.demo_service import populate_demo_db_db
from backend.services.dialog_service import select_directory_dialog
from backend.services.backup_service import BackupManager
from backend.services.excel_service import (
    generate_quote_template_excel,
    process_quote_excel,
    export_products_excel_db,
    import_products_excel_db,
    export_suppliers_excel_db,
    import_suppliers_excel_db,
)


class Api:
    """
    Fachada orquestradora da aplicação para chamadas do frontend e do servidor HTTP.
    Delega operações de forma limpa para os submódulos de domínio e serviços.
    """

    def __init__(self, db_path: Optional[str] = None):
        self._explicit_db_path = db_path
        self._file_lock_handle = None
        self._ensure_lock()

        self.backup_service = BackupManager(self)
        self._backup_worker_started = False
        self._start_auto_backup_worker()
        atexit.register(self._on_app_exit)

    @property
    def db_path(self) -> str:
        if self._explicit_db_path:
            return self._explicit_db_path
        last_path = get_last_db_path()
        if last_path and os.path.exists(last_path):
            return last_path
        return get_default_db_path()

    def _ensure_lock(self) -> None:
        current_path = self.db_path
        if current_path != ":memory:" and os.path.exists(current_path):
            try:
                if self._file_lock_handle is None:
                    self._file_lock_handle = open(current_path, "r+b")
            except Exception as e:
                print(f"Aviso ao adquirir lock de arquivo do banco: {e}")

    def _release_lock(self) -> None:
        if self._file_lock_handle is not None:
            try:
                self._file_lock_handle.close()
            except Exception:
                pass
            self._file_lock_handle = None

    @contextlib.contextmanager
    def _get_connection(self):
        conn = get_connection(self.db_path)
        try:
            yield conn
        finally:
            conn.close()

    # -------------------------------------------------------------------------
    # STATUS DE INICIALIZAÇÃO & SETUP INICIAL
    # -------------------------------------------------------------------------
    def check_db_status(self) -> Dict[str, Any]:
        if self._explicit_db_path:
            if self._explicit_db_path == ":memory:":
                with self._get_connection() as conn:
                    return check_db_status_db(conn, db_path=":memory:")
            if not os.path.exists(self._explicit_db_path):
                return {
                    "inicializado": False,
                    "total_produtos": 0,
                    "total_fornecedores": 0,
                    "total_rodadas": 0,
                    "caminho_banco": self._explicit_db_path,
                }
            with self._get_connection() as conn:
                create_schema(conn)
                seed_settings(conn)
                return check_db_status_db(conn, db_path=self._explicit_db_path)

        last_path = get_last_db_path()
        if not last_path or not os.path.exists(last_path):
            default_path = get_default_db_path()
            if os.path.exists(default_path):
                last_path = default_path
                set_last_db_path(last_path)
            else:
                return {
                    "inicializado": False,
                    "total_produtos": 0,
                    "total_fornecedores": 0,
                    "total_rodadas": 0,
                    "caminho_banco": None,
                }

        with self._get_connection() as conn:
            create_schema(conn)
            seed_settings(conn)
            status = check_db_status_db(conn, db_path=last_path)
            self._ensure_lock()
            return status

    def initialize_empty_db(self) -> Dict[str, Any]:
        """Inicializa um banco 100% limpo para produção e salva seu caminho como ativo."""
        self._release_lock()
        path = self.db_path
        set_last_db_path(path)
        with self._get_connection() as conn:
            create_schema(conn)
            seed_settings(conn)
            res = initialize_empty_db_db(conn)
        self._ensure_lock()
        res["caminho"] = path
        return res

    def populate_demo_db(self) -> Dict[str, Any]:
        """Popula o banco com catálogo rico de teste e salva seu caminho como ativo."""
        self._release_lock()
        path = self.db_path
        set_last_db_path(path)
        with self._get_connection() as conn:
            res = populate_demo_db_db(conn)
        self._ensure_lock()
        res["caminho"] = path
        return res

    def format_database(self, com_seed: bool = False) -> Dict[str, Any]:
        self._release_lock()
        path = self.db_path
        set_last_db_path(path)
        with self._get_connection() as conn:
            sucesso = format_database_db(conn, com_seed=com_seed)
        self._ensure_lock()
        return {"sucesso": sucesso, "com_seed": com_seed, "caminho": path}

    # -------------------------------------------------------------------------
    # BACKUP & RESTAURAÇÃO
    # -------------------------------------------------------------------------
    def export_database(self) -> Dict[str, Any]:
        return self.backup_service.export_database()

    def select_location_and_save_backup(self, nome_sugerido: str = "") -> Dict[str, Any]:
        if not os.path.exists(self.db_path):
            raise FileNotFoundError("Arquivo de banco de dados original não encontrado.")

        if not nome_sugerido:
            nome_sugerido = f"backup_cotacao_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"

        try:
            import webview
            if webview.windows and len(webview.windows) > 0:
                win = webview.windows[0]
                dialog_type = getattr(webview.FileDialog, "SAVE", getattr(webview, "SAVE_DIALOG", 30))
                caminhos = win.create_file_dialog(
                    dialog_type=dialog_type,
                    save_filename=nome_sugerido,
                    file_types=("Arquivos SQLite (*.db;*.sqlite)", "Todos os arquivos (*.*)"),
                )
                if not caminhos:
                    return {
                        "sucesso": False,
                        "cancelado": True,
                        "mensagem": "Operação de backup cancelada pelo usuário.",
                    }

                destino = caminhos if isinstance(caminhos, str) else caminhos[0]
                return self._salvar_backup_em_caminho(destino)
            else:
                export_res = self.export_database()
                export_res["mensagem"] = "Download via navegador disponibilizado."
                return export_res
        except Exception as e:
            raise ValueError(f"Falha ao acionar diálogo de backup: {e}")

    def _salvar_backup_em_caminho(self, caminho_destino: str) -> Dict[str, Any]:
        return self.backup_service.salvar_backup_em_caminho(caminho_destino)

    def select_backup_directory(self) -> Dict[str, Any]:
        return select_directory_dialog("Selecione a Pasta para o Backup Automático")

    def execute_auto_backup(self, origem_gatilho: str = "manual") -> Dict[str, Any]:
        return self.backup_service.execute_auto_backup(origem_gatilho=origem_gatilho)

    def _registrar_status_backup(self, status: str, data_hora: Optional[str] = None) -> None:
        self.backup_service._registrar_status(status, data_hora)

    def check_auto_backup_trigger(self, gatilho: str) -> Optional[Dict[str, Any]]:
        return self.backup_service.check_auto_backup_trigger(gatilho)

    def _start_auto_backup_worker(self) -> None:
        if self._backup_worker_started:
            return
        self._backup_worker_started = True

        def _worker():
            while True:
                time.sleep(300)
                try:
                    self.check_auto_backup_trigger("periodico")
                except Exception:
                    pass

        threading.Thread(target=_worker, daemon=True).start()

    def _on_app_exit(self) -> None:
        try:
            if self.db_path and self.db_path != ":memory:" and os.path.exists(self.db_path):
                self.check_auto_backup_trigger("fechamento")
        except Exception:
            pass

    def import_database(self, conteudo_base64: str) -> Dict[str, Any]:
        return self.backup_service.import_database(conteudo_base64)

    # -------------------------------------------------------------------------
    # CONFIGURAÇÕES
    # -------------------------------------------------------------------------
    def get_settings(self) -> Dict[str, str]:
        with self._get_connection() as conn:
            return get_db_settings(conn)

    def save_settings(self, novas_configuracoes: Dict[str, Any]) -> Dict[str, str]:
        with self._get_connection() as conn:
            return save_all_db_settings(conn, novas_configuracoes)

    def _verificar_rodada_aberta_por_id(self, conn: sqlite3.Connection, id_rodada: int) -> None:
        cursor = conn.cursor()
        cursor.execute("SELECT status FROM rodadas WHERE id = ?", (id_rodada,))
        row = cursor.fetchone()
        if row:
            if row["status"] == "fechada":
                raise ValueError("Ação bloqueada: Não é possível modificar os dados de uma rodada concluída (fechada).")
            if row["status"] == "cancelada":
                raise ValueError("Ação bloqueada: Não é possível modificar os dados de uma rodada cancelada.")

    def _verificar_rodada_aberta_por_entidade(self, conn: sqlite3.Connection, tabela: str, id_entidade: int) -> None:
        cursor = conn.cursor()
        cursor.execute(f"SELECT id_rodada FROM {tabela} WHERE id = ?", (id_entidade,))
        row = cursor.fetchone()
        if row:
            self._verificar_rodada_aberta_por_id(conn, row["id_rodada"])

    # -------------------------------------------------------------------------
    # PRODUTOS
    # -------------------------------------------------------------------------
    def list_products(self, apenas_ativos: bool = False) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT id, nome, categoria, ativo FROM produtos"
            if apenas_ativos:
                query += " WHERE ativo = 1"
            query += " ORDER BY nome ASC"
            cursor.execute(query)
            return [dict(row) for row in cursor.fetchall()]

    def alternar_status_produto(self, id_produto: int, ativo: Optional[bool] = None) -> Dict[str, Any]:
        with self._get_connection() as conn:
            val = 1 if ativo is True else (0 if ativo is False else None)
            sucesso = alternar_status_produto_db(conn, id_produto, val)
            cursor = conn.cursor()
            cursor.execute("SELECT id, nome, categoria, ativo FROM produtos WHERE id = ?", (id_produto,))
            row = cursor.fetchone()
            return {"sucesso": sucesso, "produto": dict(row) if row else None}

    def create_product(self, nome: str, categoria: Optional[str] = None) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return create_product_db(conn, nome, categoria)

    def update_product(self, id_produto: int, nome: str, categoria: Optional[str] = None) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return update_product_db(conn, id_produto, nome, categoria)

    def remove_product(self, id_produto: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT nome FROM produtos WHERE id = ?", (id_produto,))
            prod = cursor.fetchone()
            if not prod:
                raise ValueError(f"Produto #{id_produto} não encontrado.")
            nome = prod["nome"]

            hist = verificar_historico_produto_db(conn, id_produto)
            if hist["total"] > 0:
                detalhes = []
                if hist["necessidades"] > 0:
                    detalhes.append(f"{hist['necessidades']} necessidade(s)")
                if hist["cotacoes"] > 0:
                    detalhes.append(f"{hist['cotacoes']} cotação(ões)")
                if hist["alocacoes"] > 0:
                    detalhes.append(f"{hist['alocacoes']} alocação(ões) de compra")
                detalhes_str = ", ".join(detalhes)

                raise ValueError(
                    f"Não é possível excluir o produto '{nome}' pois ele possui vínculos históricos ({detalhes_str}). "
                    f"Para ocultá-lo de novas cotações sem comprometer o histórico financeiro, utilize a opção 'Desativar'."
                )

            cursor.execute("DELETE FROM produtos WHERE id = ?", (id_produto,))
            conn.commit()
            return {
                "sucesso": True,
                "id": id_produto,
                "mensagem": f"Produto '{nome}' excluído permanentemente com sucesso.",
            }

    def get_product_statistics(self, id_produto: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return get_product_statistics_db(conn, id_produto)

    # -------------------------------------------------------------------------
    # FORNECEDORES
    # -------------------------------------------------------------------------
    def list_suppliers(self, apenas_ativos: bool = False) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT id, nome, contato, telefone, email, pedido_minimo, ativo FROM fornecedores"
            if apenas_ativos:
                query += " WHERE ativo = 1"
            query += " ORDER BY nome ASC"
            cursor.execute(query)
            return [dict(row) for row in cursor.fetchall()]

    def alternar_status_fornecedor(self, id_fornecedor: int, ativo: Optional[bool] = None) -> Dict[str, Any]:
        with self._get_connection() as conn:
            val = 1 if ativo is True else (0 if ativo is False else None)
            sucesso = alternar_status_fornecedor_db(conn, id_fornecedor, val)
            cursor = conn.cursor()
            cursor.execute("SELECT id, nome, contato, telefone, email, pedido_minimo, ativo FROM fornecedores WHERE id = ?", (id_fornecedor,))
            row = cursor.fetchone()
            return {"sucesso": sucesso, "fornecedor": dict(row) if row else None}

    def create_supplier(
        self,
        nome: str,
        contato: Optional[str] = None,
        telefone: Optional[str] = None,
        email: Optional[str] = None,
        pedido_minimo: float = 0.0,
    ) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return create_supplier_db(conn, nome, contato, telefone, email, pedido_minimo)

    def update_supplier(
        self,
        id_fornecedor: int,
        nome: str,
        contato: Optional[str] = None,
        telefone: Optional[str] = None,
        email: Optional[str] = None,
        pedido_minimo: float = 0.0,
    ) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return update_supplier_db(conn, id_fornecedor, nome, contato, telefone, email, pedido_minimo)

    def remove_supplier(self, id_fornecedor: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT nome FROM fornecedores WHERE id = ?", (id_fornecedor,))
            forn = cursor.fetchone()
            if not forn:
                raise ValueError(f"Fornecedor #{id_fornecedor} não encontrado.")
            nome = forn["nome"]

            hist = verificar_historico_fornecedor_db(conn, id_fornecedor)
            if hist["total"] > 0:
                detalhes = []
                if hist["cotacoes"] > 0:
                    detalhes.append(f"{hist['cotacoes']} cotação(ões)")
                if hist["alocacoes"] > 0:
                    detalhes.append(f"{hist['alocacoes']} compra(s) alocada(s)")
                detalhes_str = ", ".join(detalhes)

                raise ValueError(
                    f"Não é possível excluir o fornecedor '{nome}' pois ele possui vínculos históricos ({detalhes_str}). "
                    f"Para ocultá-lo de novas cotações sem comprometer o histórico financeiro, utilize a opção 'Desativar'."
                )

            cursor.execute("DELETE FROM fornecedores WHERE id = ?", (id_fornecedor,))
            conn.commit()
            return {
                "sucesso": True,
                "id": id_fornecedor,
                "mensagem": f"Fornecedor '{nome}' excluído permanentemente com sucesso.",
            }

    def get_supplier_statistics(self, id_fornecedor: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return get_supplier_statistics_db(conn, id_fornecedor)

    # -------------------------------------------------------------------------
    # RODADAS DE COTAÇÃO
    # -------------------------------------------------------------------------
    def list_rounds(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            return list_rounds_with_metrics_db(conn)

    def list_rounds_with_metrics(self) -> List[Dict[str, Any]]:
        return self.list_rounds()

    def create_round(
        self,
        descricao: str,
        status: str = "aberta",
        duplicar_de_id: Optional[int] = None,
        duplicar_de_rodada_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        descricao = descricao.strip()
        if not descricao:
            raise ValueError("A descrição da rodada não pode ser vazia.")

        data_criacao = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        duplicar = duplicar_de_id if duplicar_de_id is not None else duplicar_de_rodada_id

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO rodadas (descricao, status, data_criacao) VALUES (?, ?, ?)",
                (descricao, status, data_criacao),
            )
            id_rodada = cursor.lastrowid
            conn.commit()

            if duplicar:
                duplicate_round_needs_db(conn, int(duplicar), id_rodada)

            cursor.execute(
                "SELECT id, descricao, status, data_criacao FROM rodadas WHERE id = ?",
                (id_rodada,),
            )
            return dict(cursor.fetchone())

    def update_round(self, id_rodada: int, descricao: str, status: str = "aberta") -> Dict[str, Any]:
        with self._get_connection() as conn:
            return update_round_db(conn, id_rodada, descricao, status)

    def check_round_dependencies(self, id_rodada: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return check_round_dependencies_db(conn, id_rodada)

    def remove_round(self, id_rodada: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT descricao FROM rodadas WHERE id = ?", (id_rodada,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Rodada #{id_rodada} não encontrada.")
            descricao = row["descricao"]

            hist = verificar_historico_rodada_db(conn, id_rodada)
            if hist["total"] > 0:
                detalhes = []
                if hist["necessidades"] > 0:
                    detalhes.append(f"{hist['necessidades']} item(ns) em falta")
                if hist["cotacoes"] > 0:
                    detalhes.append(f"{hist['cotacoes']} cotação(ões)")
                if hist["alocacoes"] > 0:
                    detalhes.append(f"{hist['alocacoes']} compra(s) alocada(s)")
                detalhes_str = ", ".join(detalhes)

                raise ValueError(
                    f"Não é possível excluir a rodada #{id_rodada} ('{descricao}') pois ela possui vínculos históricos "
                    f"({detalhes_str}). Para descontinuar este ciclo mantendo a integridade do histórico comercial, "
                    f"altere o status da rodada para 'cancelada'."
                )

            sucesso = remove_round_db(conn, id_rodada)
            return {
                "sucesso": sucesso,
                "id": id_rodada,
                "mensagem": f"Rodada #{id_rodada} excluída permanentemente com sucesso.",
            }

    def duplicate_round_needs(self, id_origem: int, id_destino: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_destino)
            qtd = duplicate_round_needs_db(conn, id_origem, id_destino)
            return {"sucesso": True, "itens_copiados": qtd}

    # -------------------------------------------------------------------------
    # NECESSIDADES DA RODADA
    # -------------------------------------------------------------------------
    def list_needs(self, id_rodada: int) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            return list_needs_db(conn, id_rodada)

    def create_need(
        self,
        id_rodada: int,
        id_produto: Optional[int] = None,
        quantidade: float = 0.0,
        produto_nome: Optional[str] = None,
    ) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return create_need_db(conn, id_rodada, id_produto, produto_nome)

    def remove_need(self, id_necessidade: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return remove_need_db(conn, id_necessidade)

    # -------------------------------------------------------------------------
    # COTAÇÕES
    # -------------------------------------------------------------------------
    def list_quotes(self, id_rodada: int, id_fornecedor: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            return list_quotes_db(conn, id_rodada, id_fornecedor)

    def create_quote(
        self,
        id_rodada: int,
        id_fornecedor: int,
        id_produto: Optional[int] = None,
        produto_nome: Optional[str] = None,
        marca: Optional[str] = None,
        embalagem: str = "Unidade",
        qtd_por_embalagem: float = 1.0,
        unidade: str = "UN",
        preco_embalagem: float = 0.0,
    ) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return save_quote_db(
                conn,
                id_rodada=id_rodada,
                id_fornecedor=id_fornecedor,
                id_produto=id_produto,
                marca=marca,
                embalagem=embalagem,
                qtd_por_embalagem=qtd_por_embalagem,
                unidade=unidade,
                preco_embalagem=preco_embalagem,
                produto_nome=produto_nome,
            )

    def save_quote(self, *args, **kwargs) -> Dict[str, Any]:
        return self.create_quote(*args, **kwargs)

    def remove_quote(self, id_cotacao: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_entidade(conn, "cotacoes", id_cotacao)
            return remove_quote_db(conn, id_cotacao)

    def get_comparison_matrix(self, id_rodada: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return get_quote_matrix_db(conn, id_rodada)

    def get_global_quotes_history(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            return get_global_quotes_history_db(conn)

    # -------------------------------------------------------------------------
    # ALOCAÇÕES (DECISÕES DE COMPRA)
    # -------------------------------------------------------------------------
    def list_allocations(self, id_rodada: int) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            return list_allocations_db(conn, id_rodada)

    def save_allocations(self, id_rodada: int, alocacoes: List[Dict[str, Any]]) -> Dict[str, Any]:
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_rodada)
            return save_allocations_db(conn, id_rodada, alocacoes)

    def remove_allocation(self, id_alocacao: int) -> Dict[str, Any]:
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_entidade(conn, "alocacoes", id_alocacao)
            return remove_allocation_db(conn, id_alocacao)

    # -------------------------------------------------------------------------
    # EXPORTAÇÃO E IMPORTAÇÃO EXCEL
    # -------------------------------------------------------------------------
    def _salvar_excel_com_dialogo_ou_base64(self, resultado_geracao: Dict[str, Any]) -> Dict[str, Any]:
        nome_sugerido = resultado_geracao.get("nome_arquivo", "planilha.xlsx")
        b64_content = resultado_geracao.get("conteudo_base64", "")

        try:
            import webview

            if getattr(webview, "windows", None) and len(webview.windows) > 0:
                win = webview.windows[0]
                dialog_type = getattr(
                    webview.FileDialog, "SAVE", getattr(webview, "SAVE_DIALOG", 30)
                )
                caminhos = win.create_file_dialog(
                    dialog_type=dialog_type,
                    save_filename=nome_sugerido,
                    file_types=("Planilha Excel (*.xlsx)", "Todos os arquivos (*.*)"),
                )
                if not caminhos:
                    return {
                        "sucesso": False,
                        "cancelado": True,
                        "mensagem": "Exportação cancelada pelo usuário.",
                    }

                destino = caminhos if isinstance(caminhos, str) else caminhos[0]
                if not destino.lower().endswith(".xlsx"):
                    destino += ".xlsx"

                pasta = os.path.dirname(destino)
                if pasta and not os.path.exists(pasta):
                    os.makedirs(pasta, exist_ok=True)

                conteudo_bytes = base64.b64decode(b64_content)
                with open(destino, "wb") as f:
                    f.write(conteudo_bytes)

                return {
                    "sucesso": True,
                    "cancelado": False,
                    "salvo_em_disco": True,
                    "caminho": destino,
                    "nome_arquivo": os.path.basename(destino),
                    "total": resultado_geracao.get("total", resultado_geracao.get("total_itens", 0)),
                    "total_itens": resultado_geracao.get("total_itens", resultado_geracao.get("total", 0)),
                    "mensagem": f"Planilha salva com sucesso em: {destino}",
                }
            else:
                resultado_geracao["salvo_em_disco"] = False
                resultado_geracao["cancelado"] = False
                return resultado_geracao
        except Exception as e:
            resultado_geracao["salvo_em_disco"] = False
            resultado_geracao["cancelado"] = False
            resultado_geracao["aviso"] = str(e)
            return resultado_geracao

    def export_quote_spreadsheet(self, id_rodada: int, id_fornecedor: Optional[int] = None) -> Dict[str, Any]:
        with self._get_connection() as conn:
            gerado = generate_quote_template_excel(conn, id_rodada, id_fornecedor)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def import_quote_spreadsheet(self, id_rodada: int, id_fornecedor: int, conteudo_base64: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return process_quote_excel(conn, id_rodada, id_fornecedor, conteudo_base64)

    def export_products_excel(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            gerado = export_products_excel_db(conn)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def import_products_excel(self, conteudo_base64: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return import_products_excel_db(conn, conteudo_base64)

    def export_suppliers_excel(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            gerado = export_suppliers_excel_db(conn)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def import_suppliers_excel(self, conteudo_base64: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            return import_suppliers_excel_db(conn, conteudo_base64)

    # -------------------------------------------------------------------------
    # ENCERRAMENTO DO SISTEMA
    # -------------------------------------------------------------------------
    def encerrar_sistema(self) -> Dict[str, Any]:
        def _do_shutdown():
            time.sleep(0.5)
            try:
                import webview
                for window in getattr(webview, "windows", []):
                    window.destroy()
            except Exception:
                pass
            os._exit(0)

        threading.Thread(target=_do_shutdown, daemon=True).start()
        return {"sucesso": True, "mensagem": "Sistema sendo encerrado com sucesso."}
