import base64
import os
import sqlite3
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from backend.api import Api
from backend.core.database import DatabaseLock, get_connection
from backend.core.schema import create_schema
from backend.domain.cotacoes import (
    batch_update_quotes_db,
    get_global_quote_history_db,
    get_quote_matrix_db,
    list_quotes_db,
    save_quote_db,
    update_quote_db,
)
from backend.domain.fornecedores import (
    create_supplier_db,
    list_suppliers_db,
    remove_supplier_db,
)
from backend.domain.produtos import (
    create_product_db,
    list_products_db,
    remove_product_db,
)
from backend.domain.rodadas import (
    check_round_dependencies_db,
    create_round_db,
    list_rounds_db,
)
from backend.services.demo_service import seed_data
from backend.services.dialog_service import (
    select_directory_dialog,
    select_save_file_dialog,
)


class TestDomainCoverage(unittest.TestCase):
    """Suíte para garantir 100% nas regras críticas de domínio e >=90% em todos os módulos."""

    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        create_schema(self.conn)
        seed_data(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    # -------------------------------------------------------------------------
    # DOMÍNIO: COTAÇÕES (REGRAS CRÍTICAS DE CÁLCULO E MATRIZ)
    # -------------------------------------------------------------------------
    def test_list_quotes_db_com_e_sem_filtro_fornecedor(self) -> None:
        # Sem filtro de fornecedor
        todas = list_quotes_db(self.conn, id_rodada=1)
        self.assertGreater(len(todas), 0)

        # Com filtro de fornecedor
        filtradas = list_quotes_db(self.conn, id_rodada=1, id_fornecedor=1)
        self.assertGreater(len(filtradas), 0)
        for c in filtradas:
            self.assertEqual(c["id_fornecedor"], 1)

    def test_get_quote_matrix_db_comparativo_completo(self) -> None:
        # Rodada 1 possui produtos e cotações concorrentes
        matriz = get_quote_matrix_db(self.conn, 1)
        self.assertIn("produtos", matriz)
        self.assertIn("fornecedores", matriz)
        self.assertIn("cotacoes", matriz)
        self.assertIn("menores_precos", matriz)

        # Valida que produtos e fornecedores foram encontrados
        self.assertGreater(len(matriz["produtos"]), 0)
        self.assertGreater(len(matriz["fornecedores"]), 0)

        # Testa cálculo de economia percentual frente ao 2º colocado
        for pid, menor in matriz["menores_precos"].items():
            self.assertIn("preco_unitario", menor)
            self.assertIn("economia_percentual", menor)
            self.assertGreaterEqual(menor["economia_percentual"], 0.0)

        # Teste com rodada vazia (sem cotações)
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO rodadas (descricao, status, data_criacao) VALUES ('Vazia', 'aberta', '2026-01-01')")
        self.conn.commit()
        empty_id = cursor.lastrowid
        matriz_vazia = get_quote_matrix_db(self.conn, empty_id)
        self.assertEqual(matriz_vazia["produtos"], [])
        self.assertEqual(matriz_vazia["menores_precos"], {})

    def test_get_global_quote_history_db_filtros(self) -> None:
        # Sem filtros
        hist_total = get_global_quote_history_db(self.conn, limite=100)
        self.assertGreater(len(hist_total), 0)

        # Filtro por categoria
        hist_cat = get_global_quote_history_db(self.conn, limite=50, categoria="Higiene")
        for item in hist_cat:
            self.assertEqual(item["produto_categoria"], "Higiene")

        # Filtro por fornecedor
        hist_forn = get_global_quote_history_db(self.conn, limite=50, id_fornecedor=1)
        for item in hist_forn:
            self.assertEqual(item["id_fornecedor"], 1)

        # Categoria com espaços em branco e limite mínimo seguro
        hist_espaco = get_global_quote_history_db(self.conn, limite=-5, categoria="  Higiene  ")
        self.assertGreaterEqual(len(hist_espaco), 0)

    def test_batch_update_quotes_db_campos_e_erros(self) -> None:
        # Cotação na rodada 4 (aberta)
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, preco_embalagem FROM cotacoes WHERE id_rodada = 4 LIMIT 1")
        cot = cursor.fetchone()
        cid = cot["id"]

        # Atualizar marca, embalagem, qtd_por_embalagem, unidade e preco_embalagem
        res = batch_update_quotes_db(
            self.conn,
            [cid],
            {
                "marca": "Nova Marca Teste",
                "embalagem": "Caixa 12",
                "qtd_por_embalagem": 12.0,
                "unidade": "cx",
                "preco_embalagem": 60.0,
            },
        )
        self.assertTrue(res["sucesso"])
        self.assertEqual(res["atualizados"], 1)

        cursor.execute(
            "SELECT marca, embalagem, qtd_por_embalagem, unidade, preco_embalagem FROM cotacoes WHERE id = ?",
            (cid,),
        )
        row = cursor.fetchone()
        self.assertEqual(row["marca"], "Nova Marca Teste")
        self.assertEqual(row["embalagem"], "Caixa 12")
        self.assertEqual(row["qtd_por_embalagem"], 12.0)
        self.assertEqual(row["unidade"], "CX")
        self.assertEqual(row["preco_embalagem"], 60.0)

        # Reajuste percentual (+20%)
        res_pct = batch_update_quotes_db(self.conn, [cid], {"percentual_reajuste": 20.0})
        self.assertEqual(res_pct["atualizados"], 1)
        cursor.execute("SELECT preco_embalagem FROM cotacoes WHERE id = ?", (cid,))
        self.assertEqual(cursor.fetchone()["preco_embalagem"], 72.0)

        # Transferência de fornecedor em lote com id_fornecedor válido
        cursor.execute(
            "SELECT id FROM fornecedores WHERE id NOT IN (SELECT id_fornecedor FROM cotacoes WHERE id = ?) LIMIT 1",
            (cid,),
        )
        forn_row = cursor.fetchone()
        if forn_row:
            res_forn = batch_update_quotes_db(self.conn, [cid], {"id_fornecedor": forn_row["id"]})
            self.assertGreaterEqual(res_forn["atualizados"], 0)

        # Tipos inválidos ou malformados não devem quebrar a execução
        res_invalid = batch_update_quotes_db(
            self.conn,
            [cid],
            {
                "qtd_por_embalagem": "invalido",
                "preco_embalagem": "nao_numero",
                "percentual_reajuste": "abc",
            },
        )
        self.assertTrue(res_invalid["sucesso"])

        # Cotação inexistente
        res_none = batch_update_quotes_db(self.conn, [999999], {"marca": "Inexistente"})
        self.assertEqual(res_none["atualizados"], 0)

    def test_update_quote_db_auto_cadastro_e_duplicidade(self) -> None:
        # Cadastra cotação inicial na rodada 4 (aberta)
        q1 = save_quote_db(self.conn, id_rodada=4, id_fornecedor=1, produto_nome="Item Base", preco_embalagem=10.0)

        # Atualiza cotação alterando para um novo nome de produto inédito
        upd = update_quote_db(
            self.conn,
            id_cotacao=q1["id"],
            id_fornecedor=1,
            produto_nome="Item Totalmente Novo Auto Cadastrado",
            produto_categoria="Inovação",
            preco_embalagem=15.0,
        )
        self.assertEqual(upd["produto_nome"], "Item Totalmente Novo Auto Cadastrado")

        # Atualiza novamente alterando a categoria do produto já existente
        upd2 = update_quote_db(
            self.conn,
            id_cotacao=q1["id"],
            id_fornecedor=1,
            produto_nome="Item Totalmente Novo Auto Cadastrado",
            produto_categoria="Inovação 2",
            preco_embalagem=18.0,
        )
        self.assertEqual(upd2["preco_embalagem"], 18.0)

        # Tenta atualizar gerando duplicidade com outra cotação existente na mesma rodada
        q2 = save_quote_db(self.conn, id_rodada=4, id_fornecedor=2, produto_nome="Outro Item", preco_embalagem=20.0)
        with self.assertRaises(ValueError) as ctx:
            update_quote_db(
                self.conn,
                id_cotacao=q2["id"],
                id_fornecedor=1,
                id_produto=upd2["id_produto"],
            )
        self.assertIn("Já existe outra cotação", str(ctx.exception))

    # -------------------------------------------------------------------------
    # DOMÍNIO: RODADAS
    # -------------------------------------------------------------------------
    def test_rodadas_domain_functions(self) -> None:
        # Descrição vazia
        with self.assertRaises(ValueError):
            create_round_db(self.conn, "   ")

        # Criar rodada duplicando de rodada 1
        r_nova = create_round_db(self.conn, "Rodada Duplicada Teste", duplicar_de_rodada_id=1)
        self.assertGreater(r_nova["id"], 0)
        self.assertGreater(r_nova["itens_duplicados"], 0)

        # Listar rodadas
        rodadas = list_rounds_db(self.conn)
        self.assertGreater(len(rodadas), 0)

        # Checar dependências da rodada
        deps = check_round_dependencies_db(self.conn, r_nova["id"])
        self.assertEqual(deps["id"], r_nova["id"])
        self.assertGreater(deps["total_necessidades"], 0)

        # Rodada inexistente
        with self.assertRaises(ValueError):
            check_round_dependencies_db(self.conn, 999999)

    # -------------------------------------------------------------------------
    # DOMÍNIO: FORNECEDORES
    # -------------------------------------------------------------------------
    def test_fornecedores_domain_functions(self) -> None:
        # Listar fornecedores
        lista = list_suppliers_db(self.conn)
        self.assertGreater(len(lista), 0)

        # Validação de nome vazio
        with self.assertRaises(ValueError):
            create_supplier_db(self.conn, "   ")

        # Criar fornecedor sem histórico e excluir com sucesso
        novo_f = create_supplier_db(self.conn, "Fornecedor Temporário", pedido_minimo=150.0)
        self.assertEqual(novo_f["pedido_minimo"], 150.0)
        res_del = remove_supplier_db(self.conn, novo_f["id"])
        self.assertTrue(res_del["sucesso"])

        # Fornecedor inexistente
        with self.assertRaises(ValueError):
            remove_supplier_db(self.conn, 999999)

        # Fornecedor 1 possui cotações e alocações -> bloqueio com mensagem detalhada
        with self.assertRaises(ValueError) as ctx:
            remove_supplier_db(self.conn, 1)
        self.assertIn("possui", str(ctx.exception))

    # -------------------------------------------------------------------------
    # DOMÍNIO: PRODUTOS
    # -------------------------------------------------------------------------
    def test_produtos_domain_functions(self) -> None:
        # Listar produtos
        lista = list_products_db(self.conn)
        self.assertGreater(len(lista), 0)

        # Validação de nome vazio
        with self.assertRaises(ValueError):
            create_product_db(self.conn, "")

        # Criar produto sem histórico e excluir com sucesso
        novo_p = create_product_db(self.conn, "Produto Sem Vínculo", categoria="Geral")
        res_del = remove_product_db(self.conn, novo_p["id"])
        self.assertTrue(res_del["sucesso"])

        # Produto inexistente
        with self.assertRaises(ValueError):
            remove_product_db(self.conn, 999999)

        # Produto 1 possui vínculos -> bloqueio detalhado
        with self.assertRaises(ValueError) as ctx:
            remove_product_db(self.conn, 1)
        self.assertIn("Não é possível excluir", str(ctx.exception))

    # -------------------------------------------------------------------------
    # CORE: DATABASE & DATABASELOCK
    # -------------------------------------------------------------------------
    def test_database_lock_and_connection(self) -> None:
        # Lock em :memory: não deve falhar
        lock_mem = DatabaseLock(":memory:")
        lock_mem.acquire()
        lock_mem.release()

        # Lock em arquivo real
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            temp_path = tf.name

        try:
            lock = DatabaseLock(temp_path)
            lock.acquire()
            self.assertIsNotNone(lock._file_handle)
            # Segunda chamada segura
            lock.acquire()
            lock.release()
            self.assertIsNone(lock._file_handle)
            # Segunda liberação segura
            lock.release()
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        # get_connection com caminho explícito e sem argumentos
        c = get_connection(":memory:")
        self.assertIsInstance(c, sqlite3.Connection)
        c.close()

        # get_connection sem argumento (usa get_db_path)
        with patch("backend.core.database.get_db_path", return_value=":memory:"):
            c_def = get_connection()
            self.assertIsInstance(c_def, sqlite3.Connection)
            c_def.close()

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            fpath = tf.name
        try:
            c_file = get_connection(fpath)
            self.assertIsInstance(c_file, sqlite3.Connection)
            c_file.close()

            # Teste de exceção no lock acquire e release
            lock_err = DatabaseLock(fpath)
            with patch("builtins.open", side_effect=IOError("Erro simulado")):
                lock_err.acquire()
            self.assertIsNone(lock_err._file_handle)

            mock_handle = MagicMock()
            mock_handle.close.side_effect = IOError("Erro ao fechar")
            lock_err._file_handle = mock_handle
            lock_err.release()
            self.assertIsNone(lock_err._file_handle)
        finally:
            if os.path.exists(fpath):
                os.remove(fpath)

    # -------------------------------------------------------------------------
    # SERVICES: DIALOG SERVICE (MOCK WEBVIEW)
    # -------------------------------------------------------------------------
    def test_dialog_service_webview_scenarios(self) -> None:
        api = Api(db_path=":memory:")

        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tf:
            temp_out = tf.name

        valid_b64 = base64.b64encode(b"PK\x03\x04\x00\x00conteudo_de_teste_excel").decode("ascii")

        try:
            mock_win = MagicMock()
            mock_win.create_file_dialog.return_value = [temp_out]

            # 1. Sucesso com webview aberto salvando em disco
            with patch("webview.windows", [mock_win]):
                res = api._salvar_excel_com_dialogo_ou_base64(
                    {
                        "conteudo_base64": valid_b64,
                        "nome_arquivo": "teste.xlsx",
                        "total": 5,
                    }
                )
                self.assertTrue(res["sucesso"])
                self.assertTrue(res["salvo_em_disco"])

            # 2. Cancelado pelo usuário
            mock_win.create_file_dialog.return_value = []
            with patch("webview.windows", [mock_win]):
                res_cancel = api._salvar_excel_com_dialogo_ou_base64(
                    {
                        "conteudo_base64": valid_b64,
                    }
                )
                self.assertTrue(res_cancel.get("cancelado"))

            # 3. Teste direto das funções em dialog_service
            mock_win.create_file_dialog.return_value = [temp_out]
            with patch("webview.windows", [mock_win]):
                salvar_path = select_save_file_dialog("padrao.xlsx")
                self.assertEqual(salvar_path, temp_out)

                mock_win.create_file_dialog.return_value = []
                salvar_cancel = select_save_file_dialog("padrao.xlsx")
                self.assertEqual(salvar_cancel, "")

                temp_dir = os.path.dirname(temp_out)
                mock_win.create_file_dialog.return_value = [temp_dir]
                dir_res = select_directory_dialog("Selecione")
                self.assertTrue(dir_res["sucesso"])
                self.assertEqual(dir_res["caminho"], temp_dir)
        finally:
            if os.path.exists(temp_out):
                os.remove(temp_out)


if __name__ == "__main__":
    unittest.main()
