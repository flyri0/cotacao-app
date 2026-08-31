import sqlite3
import unittest
import base64
import io
import openpyxl

from api import Api
from db import create_schema, seed_data
from excel_service import (
    gerar_planilha_modelo_cotacao_db,
    processar_planilha_cotacao_db,
    exportar_produtos_excel_db,
    importar_produtos_excel_db,
    exportar_fornecedores_excel_db,
    importar_fornecedores_excel_db,
)


class TestExcelService(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON;")
        create_schema(self.conn)
        seed_data(self.conn)

        self.api = Api(db_path=":memory:")
        self.api._get_connection = lambda: self.conn

    def tearDown(self) -> None:
        self.conn.close()

    def test_gerar_e_processar_planilha_cotacao(self) -> None:
        # Gera modelo de cotação para rodada 1
        res = self.api.exportar_planilha_cotacao(id_rodada=1, id_fornecedor=1)
        self.assertTrue(res["sucesso"])
        self.assertIn("conteudo_base64", res)
        self.assertGreater(res["total_itens"], 0)

        # Lê o Excel gerado e preenche preços para simular fornecedor
        raw = base64.b64decode(res["conteudo_base64"])
        wb = openpyxl.load_workbook(io.BytesIO(raw))
        ws = wb.active

        # Preenche preços na linha 5 e 6
        ws.cell(row=5, column=6, value="Caixa c/ 10")  # Embalagem
        ws.cell(row=5, column=7, value=10)             # Qtd
        ws.cell(row=5, column=8, value=50.0)           # Preço da embalagem (R$ 5.00 unitário)

        ws.cell(row=6, column=6, value="Fardo c/ 20")
        ws.cell(row=6, column=7, value=20)
        ws.cell(row=6, column=8, value=160.0)

        out_buf = io.BytesIO()
        wb.save(out_buf)
        out_buf.seek(0)
        filled_b64 = base64.b64encode(out_buf.read()).decode("utf-8")

        # Importa de volta via API
        import_res = self.api.importar_planilha_cotacao(
            id_rodada=1, id_fornecedor=1, conteudo_base64=filled_b64
        )
        self.assertTrue(import_res["sucesso"])
        self.assertGreaterEqual(import_res["importados"], 2)

    def test_exportar_e_importar_produtos_excel(self) -> None:
        exp = self.api.exportar_produtos_excel()
        self.assertTrue(exp["sucesso"])
        self.assertEqual(exp["total"], 12)

        # Cria uma planilha com novo produto
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["ID", "Nome do Produto", "Categoria", "Unidade Padrão"])
        ws.append(["", "Produto Teste Excel Novo", "Testes", "PCT"])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        novo_b64 = base64.b64encode(buf.read()).decode("utf-8")

        imp = self.api.importar_produtos_excel(novo_b64)
        self.assertTrue(imp["sucesso"])
        self.assertEqual(imp["importados"], 1)

        produtos = self.api.listar_produtos()
        self.assertEqual(len(produtos), 13)

    def test_exportar_e_importar_fornecedores_excel(self) -> None:
        exp = self.api.exportar_fornecedores_excel()
        self.assertTrue(exp["sucesso"])
        self.assertEqual(exp["total"], 5)

        # Cria uma planilha com novo fornecedor
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["ID", "Fornecedor / Razão Social", "Contato", "Telefone", "E-mail", "Pedido Mínimo (R$)"])
        ws.append(["", "Fornecedor Excel Ltda", "Ana", "11988887777", "ana@excel.com", 600.0])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        novo_b64 = base64.b64encode(buf.read()).decode("utf-8")

        imp = self.api.importar_fornecedores_excel(novo_b64)
        self.assertTrue(imp["sucesso"])
        self.assertEqual(imp["importados"], 1)

        fornecedores = self.api.listar_fornecedores()
        self.assertEqual(len(fornecedores), 6)
