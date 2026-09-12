import os
import sqlite3
import unittest

from backend.db import (
    create_schema,
    format_database_db,
    get_db_settings,
    get_product_statistics_db,
    save_db_setting,
    seed_data,
    seed_settings,
)


class TestDatabaseSchema(unittest.TestCase):
    def setUp(self) -> None:
        """Cria um banco SQLite em memória para testes isolados."""
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON;")
        create_schema(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def test_tables_created(self) -> None:
        """Verifica se todas as 7 tabelas foram criadas com sucesso."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = {row["name"] for row in cursor.fetchall()}
        expected_tables = {
            "configuracoes",
            "produtos",
            "fornecedores",
            "rodadas",
            "necessidades",
            "cotacoes",
            "alocacoes",
        }
        for table in expected_tables:
            self.assertIn(table, tables, f"Tabela '{table}' não foi encontrada no banco.")

    def test_configuracoes_crud(self) -> None:
        """Testa inserção, atualização e leitura das configurações do sistema."""
        seed_settings(self.conn)
        configs = get_db_settings(self.conn)
        self.assertEqual(configs.get("app_nome"), "Mapa de Cotações")
        self.assertEqual(configs.get("app_icone"), "Scale")

        save_db_setting(self.conn, "app_nome", "Central de Compras")
        configs_atualizadas = get_db_settings(self.conn)
        self.assertEqual(configs_atualizadas.get("app_nome"), "Central de Compras")

    def test_estatisticas_produto(self) -> None:
        """Testa o cálculo de estatísticas históricas e ranking de um produto."""
        seed_data(self.conn)
        stats = get_product_statistics_db(self.conn, 1)  # Detergente

        self.assertEqual(stats["produto"]["nome"], "Detergente Líquido Neutro 500ml")
        self.assertEqual(stats["total_cotacoes"], 13)
        self.assertEqual(stats["total_rodadas"], 4)
        self.assertAlmostEqual(stats["menor_preco"], 2.20, places=2)
        self.assertGreater(len(stats["ranking_fornecedores"]), 0)

    def test_formatar_banco_dados(self) -> None:
        """Testa a formatação segura do banco de dados."""
        seed_data(self.conn)
        # Formata sem seed
        format_database_db(self.conn, com_seed=False)
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM produtos")
        self.assertEqual(cursor.fetchone()[0], 0)
        cursor.execute("SELECT COUNT(*) FROM cotacoes")
        self.assertEqual(cursor.fetchone()[0], 0)

        # Formata com seed
        format_database_db(self.conn, com_seed=True)
        cursor.execute("SELECT COUNT(*) FROM produtos")
        self.assertEqual(cursor.fetchone()[0], 625)

    def test_cotacoes_schema_no_stored_unit_price(self) -> None:
        """Garante que a tabela cotacoes NÃO possui coluna de preço unitário armazenado."""
        cursor = self.conn.cursor()
        cursor.execute("PRAGMA table_info(cotacoes);")
        columns = {row["name"] for row in cursor.fetchall()}
        self.assertIn("preco_embalagem", columns)
        self.assertIn("qtd_por_embalagem", columns)
        self.assertIn("embalagem", columns)
        self.assertNotIn(
            "preco_unitario",
            columns,
            "Regra violada: preco_unitario não deve ser armazenado na tabela cotacoes.",
        )

    def test_dynamic_unit_price_calculation(self) -> None:
        """Testa o cálculo do preço unitário normalizado a partir da embalagem."""
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO produtos (nome) VALUES ('Item A');")
        id_prod = cursor.lastrowid
        cursor.execute("INSERT INTO fornecedores (nome) VALUES ('Forn A');")
        id_forn = cursor.lastrowid
        cursor.execute("INSERT INTO rodadas (descricao, data_criacao) VALUES ('R1', '2026-08-30');")
        id_rod = cursor.lastrowid

        # Inserir cotação de caixa com 24 unidades a R$ 48.00
        cursor.execute(
            """
            INSERT INTO cotacoes (id_rodada, id_fornecedor, id_produto, embalagem, qtd_por_embalagem, preco_embalagem)
            VALUES (?, ?, ?, 'Caixa c/ 24', 24.0, 48.0)
            """,
            (id_rod, id_forn, id_prod),
        )
        self.conn.commit()

        cursor.execute(
            """
            SELECT (preco_embalagem / qtd_por_embalagem) as preco_unitario
            FROM cotacoes WHERE id_rodada = ? AND id_produto = ?
            """,
            (id_rod, id_prod),
        )
        row = cursor.fetchone()
        self.assertAlmostEqual(row["preco_unitario"], 2.00, places=2)

    def test_multiple_allocations_for_same_product_and_round(self) -> None:
        """Regra CRUCIAL: Deve permitir múltiplas linhas de alocação para o mesmo produto na mesma rodada."""
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO produtos (nome) VALUES ('Detergente');")
        id_prod = cursor.lastrowid
        cursor.execute("INSERT INTO fornecedores (nome) VALUES ('Forn 1');")
        id_forn1 = cursor.lastrowid
        cursor.execute("INSERT INTO fornecedores (nome) VALUES ('Forn 2');")
        id_forn2 = cursor.lastrowid
        cursor.execute("INSERT INTO rodadas (descricao, data_criacao) VALUES ('R1', '2026-08-30');")
        id_rod = cursor.lastrowid

        # Linha 1: 70 unidades no Forn 1
        cursor.execute(
            """
            INSERT INTO alocacoes (id_rodada, id_produto, id_fornecedor, quantidade)
            VALUES (?, ?, ?, 70.0)
            """,
            (id_rod, id_prod, id_forn1),
        )

        # Linha 2: 30 unidades no Forn 2 (mesmo produto, mesma rodada!)
        cursor.execute(
            """
            INSERT INTO alocacoes (id_rodada, id_produto, id_fornecedor, quantidade)
            VALUES (?, ?, ?, 30.0)
            """,
            (id_rod, id_prod, id_forn2),
        )
        self.conn.commit()

        cursor.execute(
            "SELECT COUNT(*), SUM(quantidade) FROM alocacoes WHERE id_rodada = ? AND id_produto = ?",
            (id_rod, id_prod),
        )
        count, total_qtd = cursor.fetchone()
        self.assertEqual(count, 2)
        self.assertEqual(total_qtd, 100.0)

    def test_seed_data_validation(self) -> None:
        """Valida que o seed_data inicializa o catálogo rico com 625 produtos, 25 fornecedores e 4 rodadas."""
        seed_data(self.conn)
        cursor = self.conn.cursor()

        # Produtos (50 originais + 575 sintéticos para volume de teste)
        cursor.execute("SELECT COUNT(*) FROM produtos")
        self.assertEqual(cursor.fetchone()[0], 625)

        # Fornecedores (8 originais + 17 sintéticos para volume de teste)
        cursor.execute("SELECT COUNT(*) FROM fornecedores")
        self.assertEqual(cursor.fetchone()[0], 25)

        # Rodadas
        cursor.execute("SELECT COUNT(*) FROM rodadas")
        self.assertEqual(cursor.fetchone()[0], 4)

        # Rodada aberta ativa
        cursor.execute("SELECT COUNT(*) FROM rodadas WHERE status = 'aberta'")
        self.assertEqual(cursor.fetchone()[0], 1)

        # Cotações (histórico rico de cotações)
        cursor.execute("SELECT COUNT(*) FROM cotacoes")
        self.assertGreater(cursor.fetchone()[0], 20)

        # Alocações
        cursor.execute("SELECT COUNT(*) FROM alocacoes")
        self.assertGreater(cursor.fetchone()[0], 10)

    def test_schema_legacy_migration(self) -> None:
        """Testa migração de schema legado onde a coluna 'ativo' não existia."""
        mem_conn = sqlite3.connect(":memory:")
        mem_conn.row_factory = sqlite3.Row
        cursor = mem_conn.cursor()
        cursor.execute("CREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT NOT NULL);")
        cursor.execute("CREATE TABLE fornecedores (id INTEGER PRIMARY KEY, nome TEXT NOT NULL);")
        cursor.execute("CREATE TABLE necessidades (id INTEGER PRIMARY KEY, id_rodada INTEGER);")
        cursor.execute("CREATE TABLE cotacoes (id INTEGER PRIMARY KEY, id_rodada INTEGER);")
        cursor.execute("CREATE TABLE alocacoes (id INTEGER PRIMARY KEY, id_rodada INTEGER);")
        mem_conn.commit()

        # Invoca create_schema que deve detectar a ausência de 'ativo' e migrar
        create_schema(mem_conn)

        cursor.execute("PRAGMA table_info(produtos)")
        cols_prod = [r["name"] for r in cursor.fetchall()]
        self.assertIn("ativo", cols_prod)

        cursor.execute("PRAGMA table_info(fornecedores)")
        cols_forn = [r["name"] for r in cursor.fetchall()]
        self.assertIn("ativo", cols_forn)

        # Verifica que as tabelas antigas foram renomeadas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_old'")
        old_tables = [r["name"] for r in cursor.fetchall()]
        self.assertIn("necessidades_old", old_tables)
        self.assertIn("cotacoes_old", old_tables)
        self.assertIn("alocacoes_old", old_tables)
        mem_conn.close()

    def test_check_db_status_non_existent_path(self) -> None:
        """Testa check_db_status_db apontando para caminho inexistente."""
        from backend.db import check_db_status_db

        res = check_db_status_db(self.conn, db_path="non_existent_test_12345.db")
        self.assertFalse(res["inicializado"])
        self.assertEqual(res["total_produtos"], 0)

    def test_alternar_status_produto_e_fornecedor(self) -> None:
        """Testa alternância de status ativo para produtos e fornecedores."""
        from backend.db import (
            alternar_status_fornecedor_db,
            alternar_status_produto_db,
            toggle_product_status_db,
            toggle_supplier_status_db,
        )

        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO produtos (nome, ativo) VALUES ('Prod Teste', 1)")
        p_id = cursor.lastrowid
        cursor.execute("INSERT INTO fornecedores (nome, ativo) VALUES ('Forn Teste', 1)")
        f_id = cursor.lastrowid
        self.conn.commit()

        # Toggle produto via toggle_product_status_db (1 -> 0)
        self.assertTrue(toggle_product_status_db(self.conn, p_id, ativo=None))
        cursor.execute("SELECT ativo FROM produtos WHERE id = ?", (p_id,))
        self.assertEqual(cursor.fetchone()["ativo"], 0)

        # Toggle produto via alias alternar_status_produto_db (0 -> 1)
        self.assertTrue(alternar_status_produto_db(self.conn, p_id, ativo=None))
        cursor.execute("SELECT ativo FROM produtos WHERE id = ?", (p_id,))
        self.assertEqual(cursor.fetchone()["ativo"], 1)

        # Definir explícito produto
        toggle_product_status_db(self.conn, p_id, ativo=0)
        cursor.execute("SELECT ativo FROM produtos WHERE id = ?", (p_id,))
        self.assertEqual(cursor.fetchone()["ativo"], 0)

        # Toggle fornecedor via toggle_supplier_status_db (1 -> 0)
        self.assertTrue(toggle_supplier_status_db(self.conn, f_id, ativo=None))
        cursor.execute("SELECT ativo FROM fornecedores WHERE id = ?", (f_id,))
        self.assertEqual(cursor.fetchone()["ativo"], 0)

        # Definir explícito fornecedor via alias alternar_status_fornecedor_db
        alternar_status_fornecedor_db(self.conn, f_id, ativo=1)
        cursor.execute("SELECT ativo FROM fornecedores WHERE id = ?", (f_id,))
        self.assertEqual(cursor.fetchone()["ativo"], 1)

    def test_estatisticas_produto_e_fornecedor_errors_and_edge_cases(self) -> None:
        """Testa estatísticas de produtos e fornecedores inexistentes e sem cotações."""
        from backend.db import (
            get_product_statistics_db,
            get_supplier_statistics_db,
        )

        # Produto inexistente
        with self.assertRaises(ValueError):
            get_product_statistics_db(self.conn, 99999)

        # Fornecedor inexistente
        with self.assertRaises(ValueError):
            get_supplier_statistics_db(self.conn, 99999)

        # Produto sem cotações
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO produtos (nome) VALUES ('Prod Sem Cotacao')")
        p_id = cursor.lastrowid
        self.conn.commit()
        stats_p = get_product_statistics_db(self.conn, p_id)
        self.assertEqual(stats_p["total_cotacoes"], 0)
        self.assertEqual(stats_p["menor_preco"], 0.0)

        # Fornecedor sem cotações
        cursor.execute("INSERT INTO fornecedores (nome) VALUES ('Forn Sem Cotacao')")
        f_id = cursor.lastrowid
        self.conn.commit()
        stats_f = get_supplier_statistics_db(self.conn, f_id)
        self.assertEqual(stats_f["total_cotacoes"], 0)
        self.assertEqual(stats_f["total_alocacoes"], 0)

    def test_editar_rodada_validations(self) -> None:
        """Testa validações de negócio ao editar rodadas."""
        from backend.db import update_round_db

        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO rodadas (descricao, status, data_criacao) VALUES ('R1', 'aberta', '2026-09-03')")
        r_id = cursor.lastrowid
        self.conn.commit()

        # Descrição vazia
        with self.assertRaises(ValueError):
            update_round_db(self.conn, r_id, descricao="   ", status="aberta")

        # Status inválido
        with self.assertRaises(ValueError):
            update_round_db(self.conn, r_id, descricao="R1", status="invalido")

        # Rodada inexistente
        with self.assertRaises(ValueError):
            update_round_db(self.conn, 99999, descricao="R99", status="aberta")

        # Edição válida
        res = update_round_db(self.conn, r_id, descricao="R1 Editada", status="fechada")
        self.assertEqual(res["descricao"], "R1 Editada")
        self.assertEqual(res["status"], "fechada")

    def test_reset_db_and_init_db(self) -> None:
        """Testa as funções de inicialização e reset de banco em arquivo."""
        import tempfile

        from backend.db import init_db, reset_db

        fd, temp_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)

        try:
            conn1 = reset_db(temp_path)
            cur = conn1.cursor()
            cur.execute("SELECT COUNT(*) FROM produtos")
            self.assertGreater(cur.fetchone()[0], 0)
            conn1.close()

            # Testar init_db
            conn2 = init_db(temp_path)
            conn2.close()
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_config_paths_and_sys_frozen(self) -> None:
        """Testa caminhos de configuração e simula sys.frozen."""
        import sys
        import tempfile
        from unittest.mock import patch

        from backend.db import (
            get_app_config_path,
            get_db_path,
            get_default_db_path,
            get_last_db_path,
            set_last_db_path,
        )

        with patch.object(sys, "frozen", True, create=True), patch.object(sys, "executable", r"C:\app\cotacao.exe"):
            cfg_path = get_app_config_path()
            self.assertIn("app_config.json", cfg_path)
            def_path = get_default_db_path()
            self.assertIn("cotacao.db", def_path)

        # Testar JSON corrompido em app_config.json
        with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as f:
            f.write("{corrupted json")
            tmp_cfg = f.name

        try:
            with patch("backend.db.get_app_config_path", return_value=tmp_cfg), patch(
                "backend.core.config.get_app_config_path", return_value=tmp_cfg
            ):
                self.assertIsNone(get_last_db_path())
                # Testar set_last_db_path sobrepondo JSON corrompido
                set_last_db_path(r"C:\test\cotacao.db")
                # Testar get_db_path fallback
                self.assertTrue(get_db_path().endswith("cotacao.db"))

            # Testar get_db_path com caminho existente retornado por get_last_db_path
            with patch("backend.db.get_last_db_path", return_value=tmp_cfg):
                self.assertEqual(get_db_path(), tmp_cfg)

            # Testar erro ao salvar app_config.json (linhas 60-61)
            with patch("builtins.open", side_effect=PermissionError("Acesso negado")), patch(
                "backend.core.config.get_app_config_path", return_value=tmp_cfg
            ):
                set_last_db_path(r"C:\test\cotacao.db")

            # Testar exceção ao remover banco anterior em reset_db (linhas 1110-1111)
            with patch("os.path.exists", return_value=True), patch(
                "os.remove", side_effect=PermissionError("Bloqueado")
            ):
                with patch("backend.db.get_connection", return_value=self.conn), patch(
                    "backend.db.create_schema"
                ), patch("backend.db.seed_data"):
                    from backend.db import reset_db

                    reset_db(tmp_cfg + ".db")
        finally:
            if os.path.exists(tmp_cfg):
                os.remove(tmp_cfg)


if __name__ == "__main__":
    unittest.main()
