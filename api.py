import base64
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional
import contextlib

from db import (
    DB_PATH,
    get_connection,
    get_default_db_path,
    get_last_db_path,
    set_last_db_path,
    create_schema,
    seed_settings,
    get_db_settings,
    save_all_db_settings,
    format_database_db,
    check_db_status_db,
    initialize_empty_db_db,
    populate_demo_db_db,
    get_product_statistics_db,
    get_supplier_statistics_db,
    get_global_quotes_history_db,
    list_rounds_with_metrics_db,
    update_round_db,
    remove_round_db,
    duplicate_round_needs_db,
    update_product_db,
    update_supplier_db,
    verificar_historico_produto_db,
    verificar_historico_fornecedor_db,
    verificar_historico_rodada_db,
    alternar_status_produto_db,
    alternar_status_fornecedor_db,
)
from excel_service import (
    generate_quote_template_excel,
    process_quote_excel,
    export_products_excel_db,
    import_products_excel_db,
    export_suppliers_excel_db,
    import_suppliers_excel_db,
)


class Api:
    """API backend exposta via bridge JS/Python do pywebview (window.pywebview.api)."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        self._explicit_db_path = db_path
        self._file_lock_handle = None
        self._ensure_lock()

    @property
    def db_path(self) -> str:
        if self._explicit_db_path:
            return self._explicit_db_path
        last_path = get_last_db_path()
        if last_path and os.path.exists(last_path):
            return last_path
        return get_default_db_path()

    def _ensure_lock(self) -> None:
        """Mantém o arquivo SQLite aberto em modo r+b exclusivo para bloquear deleção/renomeação no Windows Explorer."""
        current_path = self.db_path
        if current_path != ":memory:" and os.path.exists(current_path):
            try:
                if self._file_lock_handle is None:
                    self._file_lock_handle = open(current_path, "r+b")
            except Exception as e:
                print(f"Aviso ao adquirir lock de arquivo do banco: {e}")

    def _release_lock(self) -> None:
        """Libera o lock de arquivo temporariamente para permitir operações de substituição ou recriação."""
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
        """
        Verifica se o banco de dados já foi inicializado pelo usuário e se o arquivo existe.
        Caso o arquivo do último banco não exista no disco, retorna inicializado=False.
        """
        if self._explicit_db_path == ":memory:":
            with self._get_connection() as conn:
                return check_db_status_db(conn, db_path=":memory:")

        last_path = get_last_db_path()
        if not last_path or not os.path.exists(last_path):
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

    # -------------------------------------------------------------------------
    # CONFIGURAÇÕES DO APLICATIVO
    # -------------------------------------------------------------------------
    def get_settings(self) -> Dict[str, str]:
        """Retorna todas as configurações da aplicação como dicionário."""
        with self._get_connection() as conn:
            return get_db_settings(conn)

    def save_settings(self, configs: Dict[str, Any]) -> Dict[str, str]:
        """Salva as configurações (nome, subtítulo, ícone, tema) e retorna o estado atualizado."""
        with self._get_connection() as conn:
            return save_all_db_settings(conn, {k: str(v) for k, v in configs.items()})

    # -------------------------------------------------------------------------
    # GERENCIAMENTO SEGURO DE BANCO DE DADOS
    # -------------------------------------------------------------------------
    def format_database(self, com_seed: bool = False) -> Dict[str, Any]:
        """Formata o banco de dados (recria tabelas limpas ou popula com seed inicial)."""
        self._release_lock()
        path = self.db_path
        set_last_db_path(path)
        with self._get_connection() as conn:
            sucesso = format_database_db(conn, com_seed=com_seed)
        self._ensure_lock()
        return {"sucesso": sucesso, "com_seed": com_seed, "caminho": path}

    def export_database(self) -> Dict[str, Any]:
        """Exporta o arquivo do banco SQLite codificado em base64 para download/backup."""
        if not os.path.exists(self.db_path):
            raise FileNotFoundError("Arquivo de banco de dados não encontrado.")

        with open(self.db_path, "rb") as f:
            conteudo = f.read()
            encoded = base64.b64encode(conteudo).decode("utf-8")

        nome_arquivo = f"backup_cotacao_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        return {"sucesso": True, "nome_arquivo": nome_arquivo, "conteudo_base64": encoded}

    def select_location_and_save_backup(self, nome_sugerido: str = "") -> Dict[str, Any]:
        """
        Abre o diálogo nativo do sistema operacional para o usuário escolher o local/pasta
        e salva a cópia de segurança do banco SQLite no destino selecionado.
        """
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
                # Caso esteja em ambiente sem janela nativa (ex: dev server puro)
                export_res = self.export_database()
                export_res["mensagem"] = "Download via navegador disponibilizado."
                return export_res
        except Exception as e:
            raise ValueError(f"Falha ao acionar diálogo de backup: {e}")

    def _salvar_backup_em_caminho(self, caminho_completo: str) -> Dict[str, Any]:
        """Salva uma cópia do banco de dados em um caminho de arquivo/pasta especificado."""
        import shutil

        caminho_completo = caminho_completo.strip()
        if not caminho_completo:
            raise ValueError("O caminho de destino do backup não pode ser vazio.")

        if not os.path.exists(self.db_path):
            raise FileNotFoundError("Arquivo de banco de dados original não encontrado.")

        pasta = os.path.dirname(caminho_completo)
        if pasta and not os.path.exists(pasta):
            os.makedirs(pasta, exist_ok=True)

        shutil.copy2(self.db_path, caminho_completo)
        tamanho_bytes = os.path.getsize(caminho_completo)

        return {
            "sucesso": True,
            "cancelado": False,
            "caminho": caminho_completo,
            "nome_arquivo": os.path.basename(caminho_completo),
            "tamanho_bytes": tamanho_bytes,
            "mensagem": f"Backup gravado com sucesso em: {caminho_completo}",
        }

    def import_database(self, conteudo_base64: str) -> Dict[str, Any]:
        """Importa e substitui o arquivo do banco de dados a partir de uma string base64 de forma segura."""
        import tempfile
        import shutil
        try:
            dados = base64.b64decode(conteudo_base64)
            fd, temp_path = tempfile.mkstemp(suffix=".db")
            with os.fdopen(fd, "wb") as f:
                f.write(dados)

            # Verifica integridade do novo banco ANTES de sobrescrever
            try:
                temp_conn = sqlite3.connect(temp_path)
                cursor = temp_conn.cursor()
                cursor.execute("PRAGMA integrity_check;")
                status = cursor.fetchone()[0]
                temp_conn.close()
                if status != "ok":
                    raise ValueError(f"Integridade do banco comprometida: {status}")
            except Exception as e:
                os.remove(temp_path)
                raise ValueError(f"Falha ao validar banco de dados importado: {e}")

            # Agora sim aplica o banco verificado
            self._release_lock()
            path = self.db_path
            set_last_db_path(path)
            shutil.move(temp_path, path)

            self._ensure_lock()
            return {"sucesso": True, "caminho": path, "mensagem": "Banco de dados restaurado com sucesso."}
        except Exception as e:
            self._ensure_lock()
            raise ValueError(f"Falha ao restaurar banco de dados: {e}")

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
        """Retorna produtos ordenados por nome, opcionalmente filtrando apenas ativos."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT id, nome, categoria, ativo FROM produtos"
            if apenas_ativos:
                query += " WHERE ativo = 1"
            query += " ORDER BY nome ASC"
            cursor.execute(query)
            return [dict(r) for r in cursor.fetchall()]

    def alternar_status_produto(self, id_produto: int, ativo: Optional[bool] = None) -> Dict[str, Any]:
        """Alterna ou define o status de ativação de um produto."""
        with self._get_connection() as conn:
            val = 1 if ativo is True else (0 if ativo is False else None)
            sucesso = alternar_status_produto_db(conn, id_produto, val)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, nome, categoria, ativo FROM produtos WHERE id = ?",
                (id_produto,),
            )
            row = cursor.fetchone()
            return {"sucesso": sucesso, "produto": dict(row) if row else None}

    def create_product(
        self,
        nome: str,
        categoria: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Cadastra um novo produto no catálogo (nome único e categoria opcional)."""
        nome = nome.strip()
        if not nome:
            raise ValueError("O nome do produto não pode ser vazio.")

        categoria = categoria.strip() if categoria else None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO produtos (nome, categoria, ativo)
                VALUES (?, ?, 1)
                """,
                (nome, categoria),
            )
            id_produto = cursor.lastrowid
            conn.commit()

            cursor.execute(
                "SELECT id, nome, categoria, ativo FROM produtos WHERE id = ?",
                (id_produto,),
            )
            return dict(cursor.fetchone())

    def update_product(
        self,
        id_produto: int,
        nome: str,
        categoria: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Atualiza os dados de um produto existente (nome e categoria)."""
        with self._get_connection() as conn:
            return update_product_db(conn, id_produto, nome, categoria)

    def remove_product(self, id_produto: int) -> Dict[str, Any]:
        """Remove um produto fisicamente se não possuir nenhum histórico, senão bloqueia com mensagem explicativa."""
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
        """Retorna histórico completo e métricas analíticas de preços de um produto."""
        with self._get_connection() as conn:
            return get_product_statistics_db(conn, id_produto)

    # -------------------------------------------------------------------------
    # FORNECEDORES
    # -------------------------------------------------------------------------
    def list_suppliers(self, apenas_ativos: bool = False) -> List[Dict[str, Any]]:
        """Retorna fornecedores ordenados por nome, opcionalmente filtrando apenas ativos."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT id, nome, contato, telefone, email, pedido_minimo, ativo FROM fornecedores"
            if apenas_ativos:
                query += " WHERE ativo = 1"
            query += " ORDER BY nome ASC"
            cursor.execute(query)
            return [dict(row) for row in cursor.fetchall()]

    def alternar_status_fornecedor(self, id_fornecedor: int, ativo: Optional[bool] = None) -> Dict[str, Any]:
        """Alterna ou define o status de ativação de um fornecedor."""
        with self._get_connection() as conn:
            val = 1 if ativo is True else (0 if ativo is False else None)
            sucesso = alternar_status_fornecedor_db(conn, id_fornecedor, val)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, nome, contato, telefone, email, pedido_minimo, ativo FROM fornecedores WHERE id = ?",
                (id_fornecedor,),
            )
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
        """Cadastra um novo fornecedor com pedido mínimo."""
        nome = nome.strip()
        if not nome:
            raise ValueError("O nome do fornecedor não pode ser vazio.")

        contato = contato.strip() if contato else None
        telefone = telefone.strip() if telefone else None
        email = email.strip() if email else None
        pedido_minimo = max(0.0, float(pedido_minimo or 0.0))

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO fornecedores (nome, contato, telefone, email, pedido_minimo, ativo)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (nome, contato, telefone, email, pedido_minimo),
            )
            id_fornecedor = cursor.lastrowid
            conn.commit()

            cursor.execute(
                """
                SELECT id, nome, contato, telefone, email, pedido_minimo, ativo
                FROM fornecedores WHERE id = ?
                """,
                (id_fornecedor,),
            )
            return dict(cursor.fetchone())

    def update_supplier(
        self,
        id_fornecedor: int,
        nome: str,
        contato: Optional[str] = None,
        telefone: Optional[str] = None,
        email: Optional[str] = None,
        pedido_minimo: float = 0.0,
    ) -> Dict[str, Any]:
        """Atualiza os dados de um fornecedor existente."""
        with self._get_connection() as conn:
            return update_supplier_db(
                conn, id_fornecedor, nome, contato, telefone, email, pedido_minimo
            )

    def remove_supplier(self, id_fornecedor: int) -> Dict[str, Any]:
        """Remove um fornecedor fisicamente se não possuir nenhum histórico, senão bloqueia com mensagem explicativa."""
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
                    detalhes.append(f"{hist['alocacoes']} alocação(ões) de compra")
                detalhes_str = ", ".join(detalhes)

                raise ValueError(
                    f"Não é possível excluir o fornecedor '{nome}' pois ele possui vínculos históricos ({detalhes_str}). "
                    f"Para ocultá-lo de novas rodadas sem comprometer o histórico comercial, utilize a opção 'Desativar'."
                )

            cursor.execute("DELETE FROM fornecedores WHERE id = ?", (id_fornecedor,))
            conn.commit()
            return {
                "sucesso": True,
                "id": id_fornecedor,
                "mensagem": f"Fornecedor '{nome}' excluído permanentemente com sucesso.",
            }

    def get_supplier_statistics(self, id_fornecedor: int) -> Dict[str, Any]:
        """Retorna histórico comercial, volume financeiro alocado e taxa de competitividade do fornecedor."""
        with self._get_connection() as conn:
            return get_supplier_statistics_db(conn, id_fornecedor)

    # -------------------------------------------------------------------------
    # HISTÓRICO GLOBAL MULTIDIMENSIONAL DE COTAÇÕES
    # -------------------------------------------------------------------------
    def get_global_quotes_history(self) -> List[Dict[str, Any]]:
        """Retorna todas as cotações de todas as rodadas com joins completos e status de compra alocada."""
        with self._get_connection() as conn:
            return get_global_quotes_history_db(conn)

    # -------------------------------------------------------------------------
    # RODADAS
    # -------------------------------------------------------------------------
    def list_rounds(self) -> List[Dict[str, Any]]:
        """Retorna todas as rodadas ordenadas da mais recente para a mais antiga."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, descricao, status, data_criacao
                FROM rodadas
                ORDER BY id DESC
                """
            )
            return [dict(row) for row in cursor.fetchall()]

    def list_rounds_with_metrics(self) -> List[Dict[str, Any]]:
        """Retorna todas as rodadas com indicadores de necessidades, cotações, alocações e total financeiro."""
        with self._get_connection() as conn:
            return list_rounds_with_metrics_db(conn)

    def create_round(
        self,
        descricao: str,
        status: str = "aberta",
        duplicar_de_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Cria uma nova rodada de cotação com opção de duplicar as necessidades de uma rodada anterior."""
        descricao = descricao.strip()
        if not descricao:
            raise ValueError("A descrição da rodada não pode ser vazia.")

        data_criacao = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO rodadas (descricao, status, data_criacao)
                VALUES (?, ?, ?)
                """,
                (descricao, status, data_criacao),
            )
            id_rodada = cursor.lastrowid
            conn.commit()

            if duplicar_de_id:
                duplicate_round_needs_db(conn, duplicar_de_id, id_rodada)

            cursor.execute(
                "SELECT id, descricao, status, data_criacao FROM rodadas WHERE id = ?",
                (id_rodada,),
            )
            return dict(cursor.fetchone())

    def update_round(
        self,
        id_rodada: int,
        descricao: str,
        status: str = "aberta",
    ) -> Dict[str, Any]:
        """Atualiza a descrição e o status de uma rodada existente."""
        with self._get_connection() as conn:
            return update_round_db(conn, id_rodada, descricao, status)

    def remove_round(self, id_rodada: int) -> Dict[str, Any]:
        """Remove uma rodada permanentemente se não possuir histórico de cotações ou compras. Caso contrário, bloqueia a exclusão."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, descricao, status FROM rodadas WHERE id = ?", (id_rodada,))
            rodada = cursor.fetchone()
            if not rodada:
                raise ValueError(f"Rodada #{id_rodada} não encontrada.")

            descricao = rodada["descricao"]
            hist = verificar_historico_rodada_db(conn, id_rodada)

            if hist["total_historico"] > 0:
                detalhes = []
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

    def duplicate_round_needs(
        self,
        id_origem: int,
        id_destino: int,
    ) -> Dict[str, Any]:
        """Copia a lista de produtos/necessidades de uma rodada de origem para outra."""
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_destino)
            qtd = duplicate_round_needs_db(conn, id_origem, id_destino)
            return {"sucesso": True, "itens_copiados": qtd}

    # -------------------------------------------------------------------------
    # NECESSIDADES (Itens que compõem a rodada)
    # -------------------------------------------------------------------------
    def list_needs(self, id_rodada: int) -> List[Dict[str, Any]]:
        """Retorna os produtos selecionados para cotação na rodada com dados mestres do produto."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 
                    n.id,
                    n.id_rodada,
                    n.id_produto,
                    p.nome AS produto_nome,
                    p.categoria AS produto_categoria
                FROM necessidades n
                JOIN produtos p ON p.id = n.id_produto
                WHERE n.id_rodada = ?
                ORDER BY p.nome ASC
                """,
                (id_rodada,),
            )
            return [dict(row) for row in cursor.fetchall()]

    def create_need(
        self,
        id_rodada: int,
        id_produto: Optional[int] = None,
        quantidade: float = 0.0,
        produto_nome: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Adiciona um produto à rodada de cotação. Auto-cadastra produto caso não exista no catálogo."""
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_rodada)
            cursor = conn.cursor()

            produto_novo = False
            prod_id = id_produto

            if prod_id:
                cursor.execute("SELECT id, nome FROM produtos WHERE id = ?", (prod_id,))
                prod_row = cursor.fetchone()
                if not prod_row:
                    prod_id = None

            if not prod_id and produto_nome and produto_nome.strip():
                nome_limpo = produto_nome.strip()
                cursor.execute("SELECT id, nome FROM produtos WHERE LOWER(nome) = LOWER(?)", (nome_limpo,))
                prod_row = cursor.fetchone()
                if prod_row:
                    prod_id = prod_row["id"]
                else:
                    # Auto-cadastro do novo produto
                    cursor.execute(
                        "INSERT INTO produtos (nome, categoria, ativo) VALUES (?, NULL, 1)",
                        (nome_limpo,),
                    )
                    prod_id = cursor.lastrowid
                    produto_novo = True

            if not prod_id:
                raise ValueError("Informe um produto existente ou o nome do produto para cadastro automático.")

            cursor.execute(
                """
                INSERT INTO necessidades (id_rodada, id_produto)
                VALUES (?, ?)
                ON CONFLICT(id_rodada, id_produto) DO NOTHING
                """,
                (id_rodada, prod_id),
            )
            conn.commit()

            cursor.execute(
                """
                SELECT 
                    n.id,
                    n.id_rodada,
                    n.id_produto,
                    p.nome AS produto_nome,
                    p.categoria AS produto_categoria
                FROM necessidades n
                JOIN produtos p ON p.id = n.id_produto
                WHERE n.id_rodada = ? AND n.id_produto = ?
                """,
                (id_rodada, prod_id),
            )
            res = dict(cursor.fetchone())
            res["produto_novo"] = produto_novo
            return res

    def remove_need(self, id_necessidade: int) -> Dict[str, Any]:
        """Remove uma necessidade pelo ID."""
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_entidade(conn, "necessidades", id_necessidade)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM necessidades WHERE id = ?", (id_necessidade,))
            conn.commit()
            return {"sucesso": True, "id": id_necessidade}

    # -------------------------------------------------------------------------
    # COTAÇÕES
    # -------------------------------------------------------------------------
    def list_quotes(self, id_rodada: int) -> List[Dict[str, Any]]:
        """Retorna todas as cotações de uma rodada com joins e preço unitário calculado dinamicamente."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 
                    c.id,
                    c.id_rodada,
                    c.id_fornecedor,
                    f.nome AS fornecedor_nome,
                    c.id_produto,
                    p.nome AS produto_nome,
                    c.marca,
                    c.embalagem,
                    c.qtd_por_embalagem,
                    c.unidade,
                    c.preco_embalagem,
                    (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
                FROM cotacoes c
                JOIN fornecedores f ON f.id = c.id_fornecedor
                JOIN produtos p ON p.id = c.id_produto
                WHERE c.id_rodada = ?
                ORDER BY p.nome ASC, f.nome ASC
                """,
                (id_rodada,),
            )
            return [dict(row) for row in cursor.fetchall()]

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
        """Cadastra ou atualiza uma cotação (UPSERT). Auto-cadastra produto caso não exista no catálogo."""
        embalagem = (embalagem or "Unidade").strip()
        unidade = (unidade or "UN").strip().upper()
        marca = marca.strip() if marca and marca.strip() else None
        qtd_por_embalagem = float(qtd_por_embalagem)
        preco_embalagem = float(preco_embalagem)

        if not embalagem:
            raise ValueError("A descrição da embalagem não pode ser vazia.")
        if not unidade:
            raise ValueError("A unidade de contagem não pode ser vazia.")
        if qtd_por_embalagem <= 0:
            raise ValueError("A quantidade por embalagem deve ser maior que zero.")
        if preco_embalagem < 0:
            raise ValueError("O preço da embalagem não pode ser negativo.")

        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_rodada)
            cursor = conn.cursor()

            # 1. Verifica existência do fornecedor (fornecedor continua obrigatório)
            cursor.execute("SELECT id, nome FROM fornecedores WHERE id = ?", (id_fornecedor,))
            forn = cursor.fetchone()
            if not forn:
                raise ValueError(f"Fornecedor #{id_fornecedor} não encontrado.")

            # 2. Localiza ou auto-cadastra o produto
            produto_novo = False
            prod_id = id_produto

            if prod_id:
                cursor.execute("SELECT id, nome FROM produtos WHERE id = ?", (prod_id,))
                prod_row = cursor.fetchone()
                if not prod_row:
                    prod_id = None

            if not prod_id and produto_nome and produto_nome.strip():
                nome_limpo = produto_nome.strip()
                cursor.execute("SELECT id, nome FROM produtos WHERE LOWER(nome) = LOWER(?)", (nome_limpo,))
                prod_row = cursor.fetchone()
                if prod_row:
                    prod_id = prod_row["id"]
                else:
                    # Auto-cadastro do novo produto
                    cursor.execute(
                        "INSERT INTO produtos (nome, categoria, ativo) VALUES (?, NULL, 1)",
                        (nome_limpo,),
                    )
                    prod_id = cursor.lastrowid
                    produto_novo = True

            if not prod_id:
                raise ValueError("Informe um produto existente ou o nome do produto para cadastro automático.")

            # 3. Garante que o produto conste nas necessidades da rodada ativa
            cursor.execute(
                """
                INSERT INTO necessidades (id_rodada, id_produto)
                VALUES (?, ?)
                ON CONFLICT(id_rodada, id_produto) DO NOTHING
                """,
                (id_rodada, prod_id),
            )

            # 4. Upsert da Cotação
            cursor.execute(
                """
                INSERT INTO cotacoes (
                    id_rodada, id_fornecedor, id_produto,
                    marca, embalagem, qtd_por_embalagem, unidade, preco_embalagem
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id_rodada, id_fornecedor, id_produto) DO UPDATE SET
                    marca = excluded.marca,
                    embalagem = excluded.embalagem,
                    qtd_por_embalagem = excluded.qtd_por_embalagem,
                    unidade = excluded.unidade,
                    preco_embalagem = excluded.preco_embalagem
                """,
                (
                    id_rodada,
                    id_fornecedor,
                    prod_id,
                    marca,
                    embalagem,
                    qtd_por_embalagem,
                    unidade,
                    preco_embalagem,
                ),
            )
            conn.commit()

            cursor.execute(
                """
                SELECT 
                    c.id,
                    c.id_rodada,
                    c.id_fornecedor,
                    f.nome AS fornecedor_nome,
                    c.id_produto,
                    p.nome AS produto_nome,
                    c.marca,
                    c.embalagem,
                    c.qtd_por_embalagem,
                    c.unidade,
                    c.preco_embalagem,
                    (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
                FROM cotacoes c
                JOIN fornecedores f ON f.id = c.id_fornecedor
                JOIN produtos p ON p.id = c.id_produto
                WHERE c.id_rodada = ? AND c.id_fornecedor = ? AND c.id_produto = ?
                """,
                (id_rodada, id_fornecedor, prod_id),
            )
            row = dict(cursor.fetchone())
            row["produto_novo"] = produto_novo
            return row

    def remove_quote(self, id_cotacao: int) -> Dict[str, Any]:
        """Remove uma cotação pelo ID."""
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_entidade(conn, "cotacoes", id_cotacao)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM cotacoes WHERE id = ?", (id_cotacao,))
            conn.commit()
            return {"sucesso": True, "id": id_cotacao}

    # -------------------------------------------------------------------------
    # ALOCAÇÕES (Decisões de Compra)
    # -------------------------------------------------------------------------
    def list_allocations(self, id_rodada: int) -> List[Dict[str, Any]]:
        """Retorna as linhas de alocação da rodada com joins de produtos, fornecedores e cotação correspondente."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 
                    a.id,
                    a.id_rodada,
                    a.id_produto,
                    p.nome AS produto_nome,
                    a.id_fornecedor,
                    f.nome AS fornecedor_nome,
                    a.quantidade,
                    c.marca,
                    c.embalagem,
                    c.qtd_por_embalagem,
                    c.unidade,
                    c.preco_embalagem,
                    (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
                FROM alocacoes a
                JOIN produtos p ON p.id = a.id_produto
                JOIN fornecedores f ON f.id = a.id_fornecedor
                LEFT JOIN cotacoes c ON (
                    c.id_rodada = a.id_rodada 
                    AND c.id_fornecedor = a.id_fornecedor 
                    AND c.id_produto = a.id_produto
                )
                WHERE a.id_rodada = ?
                ORDER BY p.nome ASC, a.id ASC
                """,
                (id_rodada,),
            )
            return [dict(row) for row in cursor.fetchall()]

    def save_allocations(
        self,
        id_rodada: int,
        alocacoes: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Salva/substitui em lote as alocações de uma rodada dentro de uma transação."""
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_rodada)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM alocacoes WHERE id_rodada = ?", (id_rodada,))

            linhas_para_inserir = []
            for item in alocacoes:
                try:
                    id_produto = int(item.get("id_produto", 0))
                    id_fornecedor = int(item.get("id_fornecedor", 0))
                    
                    qtd_str = item.get("quantidade", 0)
                    quantidade = float(qtd_str) if qtd_str else 0.0
                except (ValueError, TypeError) as e:
                    raise ValueError(f"Dados inválidos na alocação: {e}")

                if quantidade > 0 and id_fornecedor > 0 and id_produto > 0:
                    linhas_para_inserir.append(
                        (id_rodada, id_produto, id_fornecedor, quantidade)
                    )

            if linhas_para_inserir:
                cursor.executemany(
                    """
                    INSERT INTO alocacoes (
                        id_rodada, id_produto, id_fornecedor, quantidade
                    ) VALUES (?, ?, ?, ?)
                    """,
                    linhas_para_inserir,
                )

            conn.commit()
            return {"sucesso": True, "total_alocacoes": len(linhas_para_inserir)}

    def remove_allocation(self, id_alocacao: int) -> Dict[str, Any]:
        """Remove uma linha de alocação específica."""
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_entidade(conn, "alocacoes", id_alocacao)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM alocacoes WHERE id = ?", (id_alocacao,))
            conn.commit()
            return {"sucesso": True, "id": id_alocacao}

    # -------------------------------------------------------------------------
    # INTEGRAÇÃO EXCEL (XLSX) COM DIÁLOGO NATIVO DE SALVAMENTO
    # -------------------------------------------------------------------------
    def _salvar_excel_com_dialogo_ou_base64(
        self, resultado_geracao: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Abre o diálogo nativo do sistema operacional para o usuário escolher o local
        e o nome do arquivo Excel (.xlsx) onde deseja salvar. Se confirmado, grava
        diretamente em disco. Caso cancelado ou em ambiente web, retorna o base64.
        """
        nome_sugerido = resultado_geracao.get("nome_arquivo", "planilha.xlsx")
        b64_content = resultado_geracao.get("conteudo_base64", "")

        try:
            import webview

            if webview.windows and len(webview.windows) > 0:
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
                # Ambiente sem janela pywebview ativa (ex: testes ou navegador puro)
                resultado_geracao["salvo_em_disco"] = False
                resultado_geracao["cancelado"] = False
                return resultado_geracao
        except Exception as e:
            resultado_geracao["salvo_em_disco"] = False
            resultado_geracao["cancelado"] = False
            resultado_geracao["aviso"] = str(e)
            return resultado_geracao

    def export_quote_spreadsheet(
        self, id_rodada: int, id_fornecedor: Optional[int] = None
    ) -> Dict[str, Any]:
        """Exporta a planilha modelo de cotação da rodada com diálogo de seleção de local."""
        with self._get_connection() as conn:
            gerado = generate_quote_template_excel(conn, id_rodada, id_fornecedor)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def import_quote_spreadsheet(
        self, id_rodada: int, id_fornecedor: int, conteudo_base64: str
    ) -> Dict[str, Any]:
        """Importa cotações em lote a partir do arquivo Excel fornecido."""
        with self._get_connection() as conn:
            return process_quote_excel(
                conn, id_rodada, id_fornecedor, conteudo_base64
            )

    def export_products_excel(self) -> Dict[str, Any]:
        """Exporta o catálogo mestre de produtos para Excel com diálogo de seleção de local."""
        with self._get_connection() as conn:
            gerado = export_products_excel_db(conn)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def import_products_excel(self, conteudo_base64: str) -> Dict[str, Any]:
        """Importa produtos em lote a partir de uma planilha Excel."""
        with self._get_connection() as conn:
            return import_products_excel_db(conn, conteudo_base64)

    def export_suppliers_excel(self) -> Dict[str, Any]:
        """Exporta o catálogo mestre de fornecedores para Excel com diálogo de seleção de local."""
        with self._get_connection() as conn:
            gerado = export_suppliers_excel_db(conn)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def import_suppliers_excel(self, conteudo_base64: str) -> Dict[str, Any]:
        """Importa fornecedores em lote a partir de uma planilha Excel."""
        with self._get_connection() as conn:
            return import_suppliers_excel_db(conn, conteudo_base64)

    def encerrar_sistema(self) -> Dict[str, Any]:
        """Solicita o encerramento seguro do backend e do aplicativo."""
        import threading
        import time

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


