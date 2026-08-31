import base64
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

from db import (
    DB_PATH,
    get_connection,
    get_default_db_path,
    get_last_db_path,
    set_last_db_path,
    create_schema,
    seed_configuracoes,
    obter_configuracoes_db,
    salvar_todas_configuracoes_db,
    formatar_banco_dados_db,
    verificar_status_banco_db,
    inicializar_banco_em_branco_db,
    popular_banco_demo_completo_db,
    obter_estatisticas_produto_db,
    obter_estatisticas_fornecedor_db,
    obter_historico_global_cotacoes_db,
    listar_rodadas_com_metricas_db,
    atualizar_rodada_db,
    remover_rodada_db,
    duplicar_necessidades_rodada_db,
    atualizar_produto_db,
    atualizar_fornecedor_db,
    verificar_historico_produto_db,
    verificar_historico_fornecedor_db,
    alternar_status_produto_db,
    alternar_status_fornecedor_db,
)
from excel_service import (
    gerar_planilha_modelo_cotacao_db,
    processar_planilha_cotacao_db,
    exportar_produtos_excel_db,
    importar_produtos_excel_db,
    exportar_fornecedores_excel_db,
    importar_fornecedores_excel_db,
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

    def _get_connection(self) -> sqlite3.Connection:
        return get_connection(self.db_path)

    # -------------------------------------------------------------------------
    # STATUS DE INICIALIZAÇÃO & SETUP INICIAL
    # -------------------------------------------------------------------------
    def verificar_status_banco(self) -> Dict[str, Any]:
        """
        Verifica se o banco de dados já foi inicializado pelo usuário e se o arquivo existe.
        Caso o arquivo do último banco não exista no disco, retorna inicializado=False.
        """
        if self._explicit_db_path == ":memory:":
            with self._get_connection() as conn:
                return verificar_status_banco_db(conn, db_path=":memory:")

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
            seed_configuracoes(conn)
            status = verificar_status_banco_db(conn, db_path=last_path)
            self._ensure_lock()
            return status

    def inicializar_banco_em_branco(self) -> Dict[str, Any]:
        """Inicializa um banco 100% limpo para produção e salva seu caminho como ativo."""
        self._release_lock()
        path = self.db_path
        set_last_db_path(path)
        with self._get_connection() as conn:
            create_schema(conn)
            seed_configuracoes(conn)
            res = inicializar_banco_em_branco_db(conn)
        self._ensure_lock()
        res["caminho"] = path
        return res

    def popular_banco_demo_completo(self) -> Dict[str, Any]:
        """Popula o banco com catálogo rico de teste e salva seu caminho como ativo."""
        self._release_lock()
        path = self.db_path
        set_last_db_path(path)
        with self._get_connection() as conn:
            res = popular_banco_demo_completo_db(conn)
        self._ensure_lock()
        res["caminho"] = path
        return res

    # -------------------------------------------------------------------------
    # CONFIGURAÇÕES DO APLICATIVO
    # -------------------------------------------------------------------------
    def obter_configuracoes(self) -> Dict[str, str]:
        """Retorna todas as configurações da aplicação como dicionário."""
        with self._get_connection() as conn:
            return obter_configuracoes_db(conn)

    def salvar_configuracoes(self, configs: Dict[str, Any]) -> Dict[str, str]:
        """Salva as configurações (nome, subtítulo, ícone, tema) e retorna o estado atualizado."""
        with self._get_connection() as conn:
            return salvar_todas_configuracoes_db(conn, {k: str(v) for k, v in configs.items()})

    # -------------------------------------------------------------------------
    # GERENCIAMENTO SEGURO DE BANCO DE DADOS
    # -------------------------------------------------------------------------
    def formatar_banco_dados(self, com_seed: bool = False) -> Dict[str, Any]:
        """Formata o banco de dados (recria tabelas limpas ou popula com seed inicial)."""
        self._release_lock()
        path = self.db_path
        set_last_db_path(path)
        with self._get_connection() as conn:
            sucesso = formatar_banco_dados_db(conn, com_seed=com_seed)
        self._ensure_lock()
        return {"sucesso": sucesso, "com_seed": com_seed, "caminho": path}

    def exportar_banco_dados(self) -> Dict[str, Any]:
        """Exporta o arquivo do banco SQLite codificado em base64 para download/backup."""
        if not os.path.exists(self.db_path):
            raise FileNotFoundError("Arquivo de banco de dados não encontrado.")

        with open(self.db_path, "rb") as f:
            conteudo = f.read()
            encoded = base64.b64encode(conteudo).decode("utf-8")

        nome_arquivo = f"backup_cotacao_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        return {"sucesso": True, "nome_arquivo": nome_arquivo, "conteudo_base64": encoded}

    def selecionar_local_e_salvar_backup(self, nome_sugerido: str = "") -> Dict[str, Any]:
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
                export_res = self.exportar_banco_dados()
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

    def importar_banco_dados(self, conteudo_base64: str) -> Dict[str, Any]:
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
        if row and row["status"] == "fechada":
            raise ValueError("Ação bloqueada: Não é possível modificar os dados de uma rodada fechada.")

    def _verificar_rodada_aberta_por_entidade(self, conn: sqlite3.Connection, tabela: str, id_entidade: int) -> None:
        cursor = conn.cursor()
        cursor.execute(f"SELECT id_rodada FROM {tabela} WHERE id = ?", (id_entidade,))
        row = cursor.fetchone()
        if row:
            self._verificar_rodada_aberta_por_id(conn, row["id_rodada"])

    # -------------------------------------------------------------------------
    # PRODUTOS
    # -------------------------------------------------------------------------
    def listar_produtos(self, apenas_ativos: bool = False) -> List[Dict[str, Any]]:
        """Retorna produtos ordenados por nome, opcionalmente filtrando apenas ativos."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT id, nome, categoria, unidade_padrao, ativo FROM produtos"
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
                "SELECT id, nome, categoria, unidade_padrao, ativo FROM produtos WHERE id = ?",
                (id_produto,),
            )
            row = cursor.fetchone()
            return {"sucesso": sucesso, "produto": dict(row) if row else None}

    def criar_produto(
        self,
        nome: str,
        categoria: Optional[str] = None,
        unidade_padrao: str = "UN",
    ) -> Dict[str, Any]:
        """Cadastra um novo produto no catálogo com unidade padrão livre."""
        nome = nome.strip()
        if not nome:
            raise ValueError("O nome do produto não pode ser vazio.")

        unidade_padrao = (unidade_padrao or "UN").strip().upper()
        categoria = categoria.strip() if categoria else None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO produtos (nome, categoria, unidade_padrao, ativo)
                VALUES (?, ?, ?, 1)
                """,
                (nome, categoria, unidade_padrao),
            )
            id_produto = cursor.lastrowid
            conn.commit()

            cursor.execute(
                "SELECT id, nome, categoria, unidade_padrao, ativo FROM produtos WHERE id = ?",
                (id_produto,),
            )
            return dict(cursor.fetchone())

    def atualizar_produto(
        self,
        id_produto: int,
        nome: str,
        categoria: Optional[str] = None,
        unidade_padrao: str = "UN",
    ) -> Dict[str, Any]:
        """Atualiza os dados de um produto existente (nome, categoria, unidade padrão)."""
        with self._get_connection() as conn:
            return atualizar_produto_db(conn, id_produto, nome, categoria, unidade_padrao)

    def remover_produto(self, id_produto: int) -> Dict[str, Any]:
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

    def obter_estatisticas_produto(self, id_produto: int) -> Dict[str, Any]:
        """Retorna histórico completo e métricas analíticas de preços de um produto."""
        with self._get_connection() as conn:
            return obter_estatisticas_produto_db(conn, id_produto)

    # -------------------------------------------------------------------------
    # FORNECEDORES
    # -------------------------------------------------------------------------
    def listar_fornecedores(self, apenas_ativos: bool = False) -> List[Dict[str, Any]]:
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

    def criar_fornecedor(
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

    def atualizar_fornecedor(
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
            return atualizar_fornecedor_db(
                conn, id_fornecedor, nome, contato, telefone, email, pedido_minimo
            )

    def remover_fornecedor(self, id_fornecedor: int) -> Dict[str, Any]:
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

    def obter_estatisticas_fornecedor(self, id_fornecedor: int) -> Dict[str, Any]:
        """Retorna histórico comercial, volume financeiro alocado e taxa de competitividade do fornecedor."""
        with self._get_connection() as conn:
            return obter_estatisticas_fornecedor_db(conn, id_fornecedor)

    # -------------------------------------------------------------------------
    # HISTÓRICO GLOBAL MULTIDIMENSIONAL DE COTAÇÕES
    # -------------------------------------------------------------------------
    def obter_historico_global_cotacoes(self) -> List[Dict[str, Any]]:
        """Retorna todas as cotações de todas as rodadas com joins completos e status de compra alocada."""
        with self._get_connection() as conn:
            return obter_historico_global_cotacoes_db(conn)

    # -------------------------------------------------------------------------
    # RODADAS
    # -------------------------------------------------------------------------
    def listar_rodadas(self) -> List[Dict[str, Any]]:
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

    def listar_rodadas_com_metricas(self) -> List[Dict[str, Any]]:
        """Retorna todas as rodadas com indicadores de necessidades, cotações, alocações e total financeiro."""
        with self._get_connection() as conn:
            return listar_rodadas_com_metricas_db(conn)

    def criar_rodada(
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
                duplicar_necessidades_rodada_db(conn, duplicar_de_id, id_rodada)

            cursor.execute(
                "SELECT id, descricao, status, data_criacao FROM rodadas WHERE id = ?",
                (id_rodada,),
            )
            return dict(cursor.fetchone())

    def atualizar_rodada(
        self,
        id_rodada: int,
        descricao: str,
        status: str = "aberta",
    ) -> Dict[str, Any]:
        """Atualiza a descrição e o status de uma rodada existente."""
        with self._get_connection() as conn:
            return atualizar_rodada_db(conn, id_rodada, descricao, status)

    def remover_rodada(self, id_rodada: int) -> Dict[str, Any]:
        """Exclui uma rodada aberta e todos os seus lançamentos. Rodadas fechadas são protegidas."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT status FROM rodadas WHERE id = ?", (id_rodada,))
            row = cursor.fetchone()
            if row and row["status"] == "fechada":
                raise ValueError(
                    "Ação bloqueada: Não é possível excluir uma rodada com status 'fechada' "
                    "pois ela representa histórico consolidado de compras."
                )
            sucesso = remover_rodada_db(conn, id_rodada)
            return {"sucesso": sucesso, "id": id_rodada}

    def duplicar_necessidades_rodada(
        self,
        id_origem: int,
        id_destino: int,
    ) -> Dict[str, Any]:
        """Copia a lista de produtos/necessidades de uma rodada de origem para outra."""
        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_destino)
            qtd = duplicar_necessidades_rodada_db(conn, id_origem, id_destino)
            return {"sucesso": True, "itens_copiados": qtd}

    # -------------------------------------------------------------------------
    # NECESSIDADES (Itens que compõem a rodada)
    # -------------------------------------------------------------------------
    def listar_necessidades(self, id_rodada: int) -> List[Dict[str, Any]]:
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
                    p.categoria AS produto_categoria,
                    p.unidade_padrao AS produto_unidade_padrao,
                    n.quantidade
                FROM necessidades n
                JOIN produtos p ON p.id = n.id_produto
                WHERE n.id_rodada = ?
                ORDER BY p.nome ASC
                """,
                (id_rodada,),
            )
            return [dict(row) for row in cursor.fetchall()]

    def criar_necessidade(
        self,
        id_rodada: int,
        id_produto: int,
        quantidade: float = 0.0,
    ) -> Dict[str, Any]:
        """Adiciona um produto à rodada de cotação (a quantidade é definida na alocação)."""
        quantidade = float(quantidade or 0.0)

        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_rodada)
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO necessidades (id_rodada, id_produto, quantidade)
                VALUES (?, ?, ?)
                ON CONFLICT(id_rodada, id_produto) DO UPDATE SET
                    quantidade = excluded.quantidade
                """,
                (id_rodada, id_produto, quantidade),
            )
            conn.commit()

            cursor.execute(
                """
                SELECT 
                    n.id,
                    n.id_rodada,
                    n.id_produto,
                    p.nome AS produto_nome,
                    p.categoria AS produto_categoria,
                    p.unidade_padrao AS produto_unidade_padrao,
                    n.quantidade
                FROM necessidades n
                JOIN produtos p ON p.id = n.id_produto
                WHERE n.id_rodada = ? AND n.id_produto = ?
                """,
                (id_rodada, id_produto),
            )
            return dict(cursor.fetchone())

    def remover_necessidade(self, id_necessidade: int) -> Dict[str, Any]:
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
    def listar_cotacoes(self, id_rodada: int) -> List[Dict[str, Any]]:
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
                    p.unidade_padrao AS produto_unidade_padrao,
                    c.embalagem,
                    c.qtd_por_embalagem,
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

    def criar_cotacao(
        self,
        id_rodada: int,
        id_fornecedor: int,
        id_produto: int,
        embalagem: str,
        qtd_por_embalagem: float,
        preco_embalagem: float,
    ) -> Dict[str, Any]:
        """Cadastra ou atualiza uma cotação (UPSERT) e retorna os dados com preço unitário calculado."""
        embalagem = embalagem.strip()
        qtd_por_embalagem = float(qtd_por_embalagem)
        preco_embalagem = float(preco_embalagem)

        if not embalagem:
            raise ValueError("A descrição da embalagem não pode ser vazia.")
        if qtd_por_embalagem <= 0:
            raise ValueError("A quantidade por embalagem deve ser maior que zero.")
        if preco_embalagem < 0:
            raise ValueError("O preço da embalagem não pode ser negativo.")

        with self._get_connection() as conn:
            self._verificar_rodada_aberta_por_id(conn, id_rodada)
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO cotacoes (
                    id_rodada, id_fornecedor, id_produto,
                    embalagem, qtd_por_embalagem, preco_embalagem
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id_rodada, id_fornecedor, id_produto) DO UPDATE SET
                    embalagem = excluded.embalagem,
                    qtd_por_embalagem = excluded.qtd_por_embalagem,
                    preco_embalagem = excluded.preco_embalagem
                """,
                (
                    id_rodada,
                    id_fornecedor,
                    id_produto,
                    embalagem,
                    qtd_por_embalagem,
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
                    p.unidade_padrao AS produto_unidade_padrao,
                    c.embalagem,
                    c.qtd_por_embalagem,
                    c.preco_embalagem,
                    (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
                FROM cotacoes c
                JOIN fornecedores f ON f.id = c.id_fornecedor
                JOIN produtos p ON p.id = c.id_produto
                WHERE c.id_rodada = ? AND c.id_fornecedor = ? AND c.id_produto = ?
                """,
                (id_rodada, id_fornecedor, id_produto),
            )
            return dict(cursor.fetchone())

    def remover_cotacao(self, id_cotacao: int) -> Dict[str, Any]:
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
    def listar_alocacoes(self, id_rodada: int) -> List[Dict[str, Any]]:
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
                    p.unidade_padrao AS produto_unidade_padrao,
                    a.id_fornecedor,
                    f.nome AS fornecedor_nome,
                    a.quantidade,
                    a.observacao,
                    c.embalagem,
                    c.qtd_por_embalagem,
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

    def salvar_alocacoes(
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
                    if not qtd_str:
                        quantidade = 0.0
                    else:
                        quantidade = float(qtd_str)
                        
                    observacao = item.get("observacao")
                except (ValueError, TypeError):
                    continue # Pula itens com dados inválidos em vez de dar crash 500

                if quantidade > 0 and id_fornecedor > 0 and id_produto > 0:
                    linhas_para_inserir.append(
                        (id_rodada, id_produto, id_fornecedor, quantidade, observacao)
                    )

            if linhas_para_inserir:
                cursor.executemany(
                    """
                    INSERT INTO alocacoes (
                        id_rodada, id_produto, id_fornecedor, quantidade, observacao
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    linhas_para_inserir,
                )

            conn.commit()
            return {"sucesso": True, "total_alocacoes": len(linhas_para_inserir)}

    def remover_alocacao(self, id_alocacao: int) -> Dict[str, Any]:
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

    def exportar_planilha_cotacao(
        self, id_rodada: int, id_fornecedor: Optional[int] = None
    ) -> Dict[str, Any]:
        """Exporta a planilha modelo de cotação da rodada com diálogo de seleção de local."""
        with self._get_connection() as conn:
            gerado = gerar_planilha_modelo_cotacao_db(conn, id_rodada, id_fornecedor)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def importar_planilha_cotacao(
        self, id_rodada: int, id_fornecedor: int, conteudo_base64: str
    ) -> Dict[str, Any]:
        """Importa cotações em lote a partir do arquivo Excel fornecido."""
        with self._get_connection() as conn:
            return processar_planilha_cotacao_db(
                conn, id_rodada, id_fornecedor, conteudo_base64
            )

    def exportar_produtos_excel(self) -> Dict[str, Any]:
        """Exporta o catálogo mestre de produtos para Excel com diálogo de seleção de local."""
        with self._get_connection() as conn:
            gerado = exportar_produtos_excel_db(conn)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def importar_produtos_excel(self, conteudo_base64: str) -> Dict[str, Any]:
        """Importa produtos em lote a partir de uma planilha Excel."""
        with self._get_connection() as conn:
            return importar_produtos_excel_db(conn, conteudo_base64)

    def exportar_fornecedores_excel(self) -> Dict[str, Any]:
        """Exporta o catálogo mestre de fornecedores para Excel com diálogo de seleção de local."""
        with self._get_connection() as conn:
            gerado = exportar_fornecedores_excel_db(conn)
            return self._salvar_excel_com_dialogo_ou_base64(gerado)

    def importar_fornecedores_excel(self, conteudo_base64: str) -> Dict[str, Any]:
        """Importa fornecedores em lote a partir de uma planilha Excel."""
        with self._get_connection() as conn:
            return importar_fornecedores_excel_db(conn, conteudo_base64)


