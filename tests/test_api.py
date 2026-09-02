import sqlite3
import unittest
from api import Api
from db import create_schema, seed_data


class TestApi(unittest.TestCase):
    def setUp(self) -> None:
        """Cria um banco de dados em memória para testes isolados da Api."""
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON;")
        create_schema(self.conn)
        seed_data(self.conn)

        # Configura a Api para usar a mesma conexão em memória para os testes
        self.api = Api(db_path=":memory:")
        self.api._get_connection = lambda: self.conn

    def tearDown(self) -> None:
        self.conn.close()

    # -------------------------------------------------------------------------
    # Testes de Configurações
    # -------------------------------------------------------------------------
    def test_configuracoes_api(self) -> None:
        configs = self.api.get_settings()
        self.assertIn("app_nome", configs)
        self.assertEqual(configs["app_nome"], "Mapa de Cotações")
        self.assertIn("app_color_scheme", configs)

        novas = self.api.save_settings(
            {
                "app_nome": "Central de Suprimentos",
                "app_subtitulo": "Controle Inteligente",
                "app_icone": "ShoppingCart",
                "app_theme_color": "teal",
                "app_color_scheme": "dark",
            }
        )
        self.assertEqual(novas["app_nome"], "Central de Suprimentos")
        self.assertEqual(novas["app_icone"], "ShoppingCart")
        self.assertEqual(novas["app_theme_color"], "teal")
        self.assertEqual(novas["app_color_scheme"], "dark")

    # -------------------------------------------------------------------------
    # Testes de Backup em Caminho
    # -------------------------------------------------------------------------
    def test_salvar_backup_em_caminho_api(self) -> None:
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_db = f.name

        try:
            # Inicializa banco real temporário para testar a cópia de backup
            conn_temp = sqlite3.connect(temp_db)
            create_schema(conn_temp)
            seed_data(conn_temp)
            conn_temp.close()

            api_temp = Api(db_path=temp_db)

            with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as dest:
                dest_path = dest.name

            try:
                res = api_temp._salvar_backup_em_caminho(dest_path)
                self.assertTrue(res["sucesso"])
                self.assertEqual(res["caminho"], dest_path)
                self.assertGreater(res["tamanho_bytes"], 0)
                self.assertTrue(os.path.exists(dest_path))
            finally:
                if os.path.exists(dest_path):
                    os.remove(dest_path)
        finally:
            if 'api_temp' in locals():
                api_temp._release_lock()
            if os.path.exists(temp_db):
                os.remove(temp_db)

    # -------------------------------------------------------------------------
    # Testes de Status e Setup Inicial do Banco
    # -------------------------------------------------------------------------
    def test_verificar_status_banco_api(self) -> None:
        status = self.api.check_db_status()
        self.assertTrue(status["inicializado"])
        self.assertEqual(status["total_produtos"], 12)
        self.assertEqual(status["total_fornecedores"], 5)
        self.assertEqual(status["total_rodadas"], 4)

    def test_inicializar_banco_em_branco_api(self) -> None:
        self.api.format_database(com_seed=False)
        res = self.api.initialize_empty_db()
        self.assertTrue(res["sucesso"])
        self.assertEqual(res["tipo"], "em_branco")

    def test_popular_banco_demo_completo_api(self) -> None:
        res = self.api.populate_demo_db()
        self.assertTrue(res["sucesso"])
        self.assertEqual(len(self.api.list_products()), 12)
        self.assertEqual(len(self.api.list_suppliers()), 5)
        self.assertEqual(len(self.api.list_rounds()), 4)

    # -------------------------------------------------------------------------
    # Testes de Estatísticas de Produtos e Fornecedores
    # -------------------------------------------------------------------------
    def test_obter_estatisticas_produto_api(self) -> None:
        stats = self.api.get_product_statistics(1)  # Detergente
        self.assertEqual(stats["produto"]["nome"], "Detergente Líquido Neutro 500ml")
        self.assertEqual(stats["total_cotacoes"], 13)
        self.assertEqual(stats["total_rodadas"], 4)
        self.assertAlmostEqual(stats["menor_preco"], 2.20, places=2)
        self.assertEqual(len(stats["cotacoes_historico"]), 13)
        self.assertGreater(len(stats["ranking_fornecedores"]), 0)

    def test_obter_estatisticas_fornecedor_api(self) -> None:
        stats = self.api.get_supplier_statistics(1)  # Distribuidora Alvorada
        self.assertEqual(stats["fornecedor"]["nome"], "Distribuidora Alvorada")
        self.assertGreater(stats["total_cotacoes"], 0)
        self.assertGreater(stats["total_alocacoes"], 0)
        self.assertGreater(stats["volume_financeiro_alocado"], 0.0)

    def test_obter_historico_global_cotacoes_api(self) -> None:
        historico = self.api.get_global_quotes_history()
        self.assertGreater(len(historico), 20)
        self.assertIn("foi_alocado", historico[0])
        self.assertIn("preco_unitario", historico[0])

    # -------------------------------------------------------------------------
    # Testes de Formatação do Banco
    # -------------------------------------------------------------------------
    def test_formatar_banco_dados_api(self) -> None:
        res = self.api.format_database(com_seed=False)
        self.assertTrue(res["sucesso"])
        self.assertEqual(len(self.api.list_products()), 0)

        res_seed = self.api.format_database(com_seed=True)
        self.assertTrue(res_seed["sucesso"])
        self.assertEqual(len(self.api.list_products()), 12)

    # -------------------------------------------------------------------------
    # Testes de Produtos
    # -------------------------------------------------------------------------
    def test_listar_produtos(self) -> None:
        produtos = self.api.list_products()
        self.assertEqual(len(produtos), 12)
        self.assertTrue(all(isinstance(p, dict) for p in produtos))
        self.assertIn("nome", produtos[0])
        self.assertIn("ativo", produtos[0])

    def test_criar_e_remover_produto(self) -> None:
        novo = self.api.create_product(
            nome="Luva Nitrílica Descartável Tam M", categoria="Higiene"
        )
        self.assertIsNotNone(novo.get("id"))
        self.assertEqual(novo["nome"], "Luva Nitrílica Descartável Tam M")
        self.assertEqual(novo["categoria"], "Higiene")

        # Verifica se aparece na listagem
        produtos = self.api.list_products()
        self.assertEqual(len(produtos), 13)

        # Remove o produto
        res = self.api.remove_product(novo["id"])
        self.assertTrue(res["sucesso"])
        self.assertEqual(len(self.api.list_products()), 12)

    def test_criar_produto_invalido(self) -> None:
        with self.assertRaises(ValueError):
            self.api.create_product(nome="   ")

    def test_atualizar_produto_api(self) -> None:
        produtos = self.api.list_products()
        prod = produtos[0]
        atualizado = self.api.update_product(
            id_produto=prod["id"],
            nome="Produto Teste Atualizado",
            categoria="Nova Categoria",
        )
        self.assertEqual(atualizado["id"], prod["id"])
        self.assertEqual(atualizado["nome"], "Produto Teste Atualizado")
        self.assertEqual(atualizado["categoria"], "Nova Categoria")

        # Não deve permitir nome em branco
        with self.assertRaises(ValueError):
            self.api.update_product(id_produto=prod["id"], nome="   ")

        # Não deve permitir ID inexistente
        with self.assertRaises(ValueError):
            self.api.update_product(id_produto=999999, nome="Inexistente")

    def test_atualizar_produto_nome_duplicado_api(self) -> None:
        produtos = self.api.list_products()
        prod1 = produtos[0]
        prod2 = produtos[1]
        # Tentar mudar o nome do prod1 para o nome do prod2
        with self.assertRaises(ValueError):
            self.api.update_product(
                id_produto=prod1["id"],
                nome=prod2["nome"],
            )

    def test_bloqueio_exclusao_produto_com_historico(self) -> None:
        # Produto 1 (Detergente) tem necessidades, cotações e alocações
        with self.assertRaises(ValueError) as ctx:
            self.api.remove_product(1)
        self.assertIn("possui vínculos históricos", str(ctx.exception))
        self.assertIn("Desativar", str(ctx.exception))

    def test_alternar_status_produto(self) -> None:
        # Desativa produto 1
        res = self.api.alternar_status_produto(1, False)
        self.assertTrue(res["sucesso"])
        self.assertEqual(res["produto"]["ativo"], 0)

        # Filtro de apenas ativos deve retornar 11
        self.assertEqual(len(self.api.list_products(apenas_ativos=True)), 11)
        # Listagem total deve retornar 12
        self.assertEqual(len(self.api.list_products(apenas_ativos=False)), 12)

        # Reativa produto 1
        res_ativar = self.api.alternar_status_produto(1, True)
        self.assertTrue(res_ativar["sucesso"])
        self.assertEqual(res_ativar["produto"]["ativo"], 1)
        self.assertEqual(len(self.api.list_products(apenas_ativos=True)), 12)

    # -------------------------------------------------------------------------
    # Testes de Fornecedores
    # -------------------------------------------------------------------------
    def test_listar_fornecedores(self) -> None:
        fornecedores = self.api.list_suppliers()
        self.assertEqual(len(fornecedores), 5)
        self.assertTrue(all("pedido_minimo" in f for f in fornecedores))

    def test_bloqueio_exclusao_fornecedor_com_historico(self) -> None:
        # Fornecedor 1 (Distribuidora Alvorada) tem cotações e alocações
        with self.assertRaises(ValueError) as ctx:
            self.api.remove_supplier(1)
        self.assertIn("possui vínculos históricos", str(ctx.exception))
        self.assertIn("Desativar", str(ctx.exception))

    def test_alternar_status_fornecedor(self) -> None:
        # Desativa fornecedor 1
        res = self.api.alternar_status_fornecedor(1, False)
        self.assertTrue(res["sucesso"])
        self.assertEqual(res["fornecedor"]["ativo"], 0)

        # Filtro de apenas ativos deve retornar 4
        self.assertEqual(len(self.api.list_suppliers(apenas_ativos=True)), 4)
        # Listagem total deve retornar 5
        self.assertEqual(len(self.api.list_suppliers(apenas_ativos=False)), 5)

        # Reativa fornecedor 1
        res_ativar = self.api.alternar_status_fornecedor(1, True)
        self.assertTrue(res_ativar["sucesso"])
        self.assertEqual(res_ativar["fornecedor"]["ativo"], 1)
        self.assertEqual(len(self.api.list_suppliers(apenas_ativos=True)), 5)

    def test_criar_e_remover_fornecedor(self) -> None:
        novo = self.api.create_supplier(
            nome="Distribuidora Alpha",
            contato="Roberto",
            telefone="1199999999",
            email="alpha@email.com",
            pedido_minimo=350.0,
        )
        self.assertIsNotNone(novo.get("id"))
        self.assertEqual(novo["nome"], "Distribuidora Alpha")
        self.assertEqual(novo["pedido_minimo"], 350.0)

        fornecedores = self.api.list_suppliers()
        self.assertEqual(len(fornecedores), 6)

        res = self.api.remove_supplier(novo["id"])
        self.assertTrue(res["sucesso"])
        self.assertEqual(len(self.api.list_suppliers()), 5)

    def test_atualizar_fornecedor_api(self) -> None:
        fornecedores = self.api.list_suppliers()
        forn = fornecedores[0]
        atualizado = self.api.update_supplier(
            id_fornecedor=forn["id"],
            nome="Fornecedor Beta Modificado",
            contato="Mariana Vendas",
            telefone="1188888888",
            email="mariana@beta.com",
            pedido_minimo=750.0,
        )
        self.assertEqual(atualizado["id"], forn["id"])
        self.assertEqual(atualizado["nome"], "Fornecedor Beta Modificado")
        self.assertEqual(atualizado["contato"], "Mariana Vendas")
        self.assertEqual(atualizado["telefone"], "1188888888")
        self.assertEqual(atualizado["email"], "mariana@beta.com")
        self.assertEqual(atualizado["pedido_minimo"], 750.0)

        # Não deve permitir nome em branco
        with self.assertRaises(ValueError):
            self.api.update_supplier(id_fornecedor=forn["id"], nome="   ")

        # Não deve permitir ID inexistente
        with self.assertRaises(ValueError):
            self.api.update_supplier(id_fornecedor=999999, nome="Inexistente")

    def test_atualizar_fornecedor_nome_duplicado_api(self) -> None:
        fornecedores = self.api.list_suppliers()
        forn1 = fornecedores[0]
        forn2 = fornecedores[1]
        # Tentar mudar o nome do forn1 para o nome do forn2
        with self.assertRaises(ValueError):
            self.api.update_supplier(
                id_fornecedor=forn1["id"],
                nome=forn2["nome"],
            )

    # -------------------------------------------------------------------------
    # Testes de Rodadas
    # -------------------------------------------------------------------------
    def test_listar_e_criar_rodada(self) -> None:
        rodadas = self.api.list_rounds()
        self.assertEqual(len(rodadas), 4)

        nova = self.api.create_round("Cotação Extra Maio 2026")
        self.assertEqual(nova["descricao"], "Cotação Extra Maio 2026")
        self.assertEqual(nova["status"], "aberta")

        rodadas_atualizadas = self.api.list_rounds()
        self.assertEqual(len(rodadas_atualizadas), 5)

    def test_listar_rodadas_com_metricas_api(self) -> None:
        rodadas = self.api.list_rounds_with_metrics()
        self.assertEqual(len(rodadas), 4)
        self.assertIn("total_necessidades", rodadas[0])
        self.assertIn("total_cotacoes", rodadas[0])
        self.assertIn("total_alocacoes", rodadas[0])
        self.assertIn("valor_total_alocado", rodadas[0])

    def test_atualizar_rodada_api(self) -> None:
        # Atualiza rodada 4 para fechada
        atualizada = self.api.update_round(4, "Cotação Abril 2026 Finalizada", "fechada")
        self.assertEqual(atualizada["descricao"], "Cotação Abril 2026 Finalizada")
        self.assertEqual(atualizada["status"], "fechada")

    def test_duplicar_e_remover_rodada_api(self) -> None:
        # Cria rodada 5 clonando necessidades da rodada 1
        nova = self.api.create_round("Cotação Junho 2026", "aberta", duplicar_de_id=1)
        necessidades = self.api.list_needs(nova["id"])
        self.assertEqual(len(necessidades), 6)

        # Exclui rodada 5
        res = self.api.remove_round(nova["id"])
        self.assertTrue(res["sucesso"])
        self.assertEqual(len(self.api.list_rounds()), 4)

    def test_bloqueio_exclusao_rodada_com_historico_api(self) -> None:
        # Rodada 1 tem cotações e alocações
        with self.assertRaises(ValueError) as ctx:
            self.api.remove_round(1)
        self.assertIn("possui vínculos históricos", str(ctx.exception))
        self.assertIn("cancelada", str(ctx.exception))

        # Reabrir a rodada 1 não deve contornar a proteção de integridade
        self.api.update_round(1, "Rodada Reaberta", "aberta")
        with self.assertRaises(ValueError) as ctx:
            self.api.remove_round(1)
        self.assertIn("possui vínculos históricos", str(ctx.exception))

    def test_cancelar_rodada_e_bloqueio_mutacao_api(self) -> None:
        # Atualiza rodada 4 para cancelada
        atualizada = self.api.update_round(4, "Cotação Cancelada", "cancelada")
        self.assertEqual(atualizada["status"], "cancelada")

        # Tentar adicionar necessidade em rodada cancelada deve falhar
        with self.assertRaises(ValueError) as ctx:
            self.api.create_need(id_rodada=4, id_produto=1)
        self.assertIn("cancelada", str(ctx.exception))

    # -------------------------------------------------------------------------
    # Testes de Necessidades (sem exigir quantidade)
    # -------------------------------------------------------------------------
    def test_listar_necessidades(self) -> None:
        necessidades = self.api.list_needs(id_rodada=1)
        self.assertEqual(len(necessidades), 6)
        self.assertIn("produto_nome", necessidades[0])

    def test_criar_e_remover_necessidade(self) -> None:
        # Cadastra produto avulso
        prod = self.api.create_product(nome="Pano Multiuso Rolo")

        # Adiciona necessidade na rodada 4 (sem quantidade obrigatória)
        nec = self.api.create_need(id_rodada=4, id_produto=prod["id"])
        self.assertEqual(nec["produto_nome"], "Pano Multiuso Rolo")

        # Remove necessidade
        res = self.api.remove_need(nec["id"])
        self.assertTrue(res["sucesso"])

    # -------------------------------------------------------------------------
    # Testes de Cotações e Normalização de Preço
    # -------------------------------------------------------------------------
    def test_listar_cotacoes_calculo_preco_unitario(self) -> None:
        cotacoes = self.api.list_quotes(id_rodada=1)
        self.assertEqual(len(cotacoes), 14)

        # Verifica se o preço unitário está presente e calculado
        for c in cotacoes:
            self.assertIn("preco_unitario", c)
            self.assertIn("unidade", c)
            self.assertAlmostEqual(
                c["preco_unitario"],
                c["preco_embalagem"] / c["qtd_por_embalagem"],
                places=4,
            )

    def test_criar_e_remover_cotacao(self) -> None:
        # Cria cotação: Caixa com 50 unidades a R$ 100.00 -> unitário 2.00
        cotacao = self.api.create_quote(
            id_rodada=4,
            id_fornecedor=1,
            id_produto=1,
            marca="Marca Top",
            embalagem="Caixa Especial c/ 50",
            qtd_por_embalagem=50.0,
            unidade="UN",
            preco_embalagem=100.0,
        )
        self.assertEqual(cotacao["marca"], "Marca Top")
        self.assertEqual(cotacao["embalagem"], "Caixa Especial c/ 50")
        self.assertEqual(cotacao["unidade"], "UN")
        self.assertEqual(cotacao["preco_unitario"], 2.00)

        # Remove cotação
        res = self.api.remove_quote(cotacao["id"])
        self.assertTrue(res["sucesso"])

    def test_auto_cadastro_produto_na_cotacao(self) -> None:
        # Cotação com produto que ainda não existe no catálogo
        novo_prod_nome = "Desinfetante Lavanda 5L Inédito"
        cotacao = self.api.create_quote(
            id_rodada=4,
            id_fornecedor=1,
            produto_nome=novo_prod_nome,
            marca="Brilho Max",
            embalagem="Galão 5L",
            qtd_por_embalagem=5.0,
            unidade="L",
            preco_embalagem=35.0,
        )
        self.assertTrue(cotacao.get("produto_novo"))
        self.assertEqual(cotacao["produto_nome"], novo_prod_nome)
        self.assertEqual(cotacao["marca"], "Brilho Max")
        self.assertEqual(cotacao["unidade"], "L")
        self.assertAlmostEqual(cotacao["preco_unitario"], 7.0, places=2)

        # Verifica se o produto agora existe no catálogo
        produtos = self.api.list_products()
        cadastrado = next((p for p in produtos if p["nome"] == novo_prod_nome), None)
        self.assertIsNotNone(cadastrado)

        # Verifica se foi inserido nas necessidades da rodada 4
        necessidades = self.api.list_needs(id_rodada=4)
        nec = next((n for n in necessidades if n["produto_nome"] == novo_prod_nome), None)
        self.assertIsNotNone(nec)

        # Fornecedor inexistente deve falhar
        with self.assertRaises(ValueError):
            self.api.create_quote(
                id_rodada=4,
                id_fornecedor=99999,
                produto_nome="Outro Produto",
                embalagem="UN",
                qtd_por_embalagem=1,
                preco_embalagem=10,
            )

    # -------------------------------------------------------------------------
    # Testes de Alocações
    # -------------------------------------------------------------------------
    def test_listar_alocacoes(self) -> None:
        alocacoes = self.api.list_allocations(id_rodada=1)
        self.assertEqual(len(alocacoes), 6)
        self.assertIn("produto_nome", alocacoes[0])
        self.assertIn("fornecedor_nome", alocacoes[0])
        self.assertIn("quantidade", alocacoes[0])
        self.assertIn("produto_nome", alocacoes[0])
        self.assertIn("fornecedor_nome", alocacoes[0])
        self.assertIn("quantidade", alocacoes[0])

    def test_salvar_alocacoes_multiplas_linhas_mesmo_produto(self) -> None:
        novas_alocacoes = [
            # Produto 1 dividido em dois fornecedores
            {
                "id_produto": 1,
                "id_fornecedor": 1,
                "quantidade": 60.0,
            },
            {
                "id_produto": 1,
                "id_fornecedor": 2,
                "quantidade": 60.0,
            },
            # Produto 2 integral no fornecedor 3
            {
                "id_produto": 2,
                "id_fornecedor": 3,
                "quantidade": 50.0,
            },
        ]
        res = self.api.save_allocations(id_rodada=4, alocacoes=novas_alocacoes)
        self.assertTrue(res["sucesso"])
        self.assertEqual(res["total_alocacoes"], 3)

        alocs = self.api.list_allocations(id_rodada=4)
        self.assertEqual(len(alocs), 3)

        # Filtra alocações do produto 1 para confirmar a divisão permitida
        alocs_prod1 = [a for a in alocs if a["id_produto"] == 1]
        self.assertEqual(len(alocs_prod1), 2)
        self.assertEqual(sum(a["quantidade"] for a in alocs_prod1), 120.0)

    def test_remover_alocacao(self) -> None:
        alocs = self.api.list_allocations(id_rodada=4)
        id_remover = alocs[0]["id"]
        res = self.api.remove_allocation(id_remover)
        self.assertTrue(res["sucesso"])

        alocs_apos = self.api.list_allocations(id_rodada=4)
        self.assertEqual(len(alocs_apos), len(alocs) - 1)

    # -------------------------------------------------------------------------
    # Testes de Persistência do Último Banco e File Lock
    # -------------------------------------------------------------------------
    def test_banco_inexistente_retorna_nao_inicializado(self) -> None:
        import tempfile
        import os

        # Cria um caminho temporário de um arquivo que NÃO existe
        caminho_inexistente = os.path.join(tempfile.gettempdir(), "banco_inexistente_test_9999.db")
        if os.path.exists(caminho_inexistente):
            os.remove(caminho_inexistente)

        api_inexistente = Api(db_path=caminho_inexistente)
        status = api_inexistente.check_db_status()
        self.assertFalse(status["inicializado"])

    def test_salvar_e_obter_ultimo_banco_path(self) -> None:
        import tempfile
        import os
        from db import set_last_db_path, get_last_db_path

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_db = f.name

        try:
            set_last_db_path(temp_db)
            last = get_last_db_path()
            self.assertIsNotNone(last)
            self.assertEqual(os.path.abspath(last), os.path.abspath(temp_db))
        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    def test_trava_arquivo_em_uso_impede_delecao(self) -> None:
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_db = f.name

        try:
            # Inicializa banco real temporário
            conn_temp = sqlite3.connect(temp_db)
            create_schema(conn_temp)
            seed_data(conn_temp)
            conn_temp.close()

            # Instancia a API sobre o arquivo real (que deve adquirir o lock)
            api_temp = Api(db_path=temp_db)
            api_temp._ensure_lock()

            # No Windows, tentar deletar enquanto o lock estiver ativo deve lançar PermissionError
            if os.name == "nt":
                with self.assertRaises(PermissionError):
                    os.remove(temp_db)

            # Ao liberar o lock, a remoção deve ser permitida
            api_temp._release_lock()
            os.remove(temp_db)
            self.assertFalse(os.path.exists(temp_db))
        finally:
            if os.path.exists(temp_db):
                try:
                    os.remove(temp_db)
                except Exception:
                    pass


if __name__ == "__main__":
    unittest.main()

