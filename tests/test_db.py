import sqlite3
import unittest
from db import (
    create_schema,
    seed_data,
    seed_settings,
    get_db_settings,
    save_db_setting,
    save_all_db_settings,
    format_database_db,
    get_product_statistics_db,
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
        self.assertEqual(cursor.fetchone()[0], 12)

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
        cursor.execute(
            "INSERT INTO rodadas (descricao, data_criacao) VALUES ('R1', '2026-08-30');"
        )
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
        cursor.execute(
            "INSERT INTO rodadas (descricao, data_criacao) VALUES ('R1', '2026-08-30');"
        )
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
        """Valida que o seed_data inicializa o catálogo rico com 12 produtos, 5 fornecedores e 4 rodadas."""
        seed_data(self.conn)
        cursor = self.conn.cursor()

        # Produtos
        cursor.execute("SELECT COUNT(*) FROM produtos")
        self.assertEqual(cursor.fetchone()[0], 12)

        # Fornecedores
        cursor.execute("SELECT COUNT(*) FROM fornecedores")
        self.assertEqual(cursor.fetchone()[0], 5)

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


if __name__ == "__main__":
    unittest.main()
