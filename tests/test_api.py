import os
import sqlite3
import unittest
from backend.api import Api
from backend.db import create_schema, seed_data


class TestApi(unittest.TestCase):
    def setUp(self) -> None:
        """Cria um banco de dados em memória para testes isolados da Api."""
        import tempfile
        from unittest.mock import patch
        self._temp_cfg_fd, self._temp_cfg_path = tempfile.mkstemp(suffix=".json")
        os.close(self._temp_cfg_fd)
        self._cfg_patch1 = patch("backend.core.config.get_app_config_path", return_value=self._temp_cfg_path)
        self._cfg_patch2 = patch("backend.db.get_app_config_path", return_value=self._temp_cfg_path)
        self._cfg_patch1.start()
        self._cfg_patch2.start()

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
        self._cfg_patch1.stop()
        self._cfg_patch2.stop()
        if os.path.exists(self._temp_cfg_path):
            try:
                os.remove(self._temp_cfg_path)
            except Exception:
                pass

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

    def test_auto_cadastro_produto_na_necessidade(self) -> None:
        novo_prod_nome = "Vassoura de Piaçava Inédita"
        nec = self.api.create_need(id_rodada=4, produto_nome=novo_prod_nome)
        self.assertTrue(nec.get("produto_novo"))
        self.assertEqual(nec["produto_nome"], novo_prod_nome)

        # Verifica se o produto foi inserido no catálogo de produtos
        produtos = self.api.list_products()
        cadastrado = next((p for p in produtos if p["nome"] == novo_prod_nome), None)
        self.assertIsNotNone(cadastrado)
        self.assertEqual(cadastrado["ativo"], 1)

        # Verifica se consta na lista de necessidades da rodada
        necessidades = self.api.list_needs(id_rodada=4)
        item = next((n for n in necessidades if n["produto_nome"] == novo_prod_nome), None)
        self.assertIsNotNone(item)

        # Se chamar novamente para o mesmo produto, não é produto novo
        nec2 = self.api.create_need(id_rodada=4, produto_nome=novo_prod_nome)
        self.assertFalse(nec2.get("produto_novo"))

    def test_set_and_reset_selected_supplier_api(self) -> None:
        # Rodada 4 está aberta
        # Cadastra necessidade para produto 1
        self.api.create_need(id_rodada=4, id_produto=1)

        # Seleciona fornecedor 2 para o produto 1 na rodada 4
        res = self.api.set_selected_supplier(id_rodada=4, id_produto=1, id_fornecedor=2)
        self.assertTrue(res["sucesso"])
        self.assertEqual(res["id_fornecedor_selecionado"], 2)

        # Verifica se list_needs traz o id_fornecedor_selecionado
        necs = self.api.list_needs(id_rodada=4)
        nec = next((n for n in necs if n["id_produto"] == 1), None)
        self.assertIsNotNone(nec)
        self.assertEqual(nec["id_fornecedor_selecionado"], 2)

        # Salva uma alocação para produto 1 com quantidade
        self.api.save_allocations(
            id_rodada=4,
            alocacoes=[{"id_produto": 1, "id_fornecedor": 2, "quantidade": 50}],
        )

        # Agora muda o fornecedor selecionado para o fornecedor 3
        res2 = self.api.set_selected_supplier(id_rodada=4, id_produto=1, id_fornecedor=3)
        self.assertTrue(res2["sucesso"])
        self.assertEqual(res2["id_fornecedor_selecionado"], 3)

        # Verifica se a alocação existente foi sincronizada para o fornecedor 3 preservando a quantidade
        alocs = self.api.list_allocations(id_rodada=4)
        aloc = next((a for a in alocs if a["id_produto"] == 1), None)
        self.assertIsNotNone(aloc)
        self.assertEqual(aloc["id_fornecedor"], 3)
        self.assertEqual(aloc["quantidade"], 50)

        # Restaura os fornecedores padrão com reset
        res_reset = self.api.reset_selected_suppliers(id_rodada=4)
        self.assertTrue(res_reset["sucesso"])

        necs_apos_reset = self.api.list_needs(id_rodada=4)
        nec_reset = next((n for n in necs_apos_reset if n["id_produto"] == 1), None)
        self.assertIsNone(nec_reset["id_fornecedor_selecionado"])

        # Teste de validações
        # Produto não presente na rodada
        with self.assertRaises(ValueError):
            self.api.set_selected_supplier(id_rodada=4, id_produto=999999, id_fornecedor=1)

        # Fornecedor inexistente
        with self.assertRaises(ValueError):
            self.api.set_selected_supplier(id_rodada=4, id_produto=1, id_fornecedor=999999)

        # Rodada fechada deve bloquear
        # Rodada 2 está fechada no seed
        with self.assertRaises(ValueError):
            self.api.set_selected_supplier(id_rodada=2, id_produto=1, id_fornecedor=1)
        with self.assertRaises(ValueError):
            self.api.reset_selected_suppliers(id_rodada=2)

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

    def test_atualizar_cotacao(self) -> None:
        cotacao = self.api.create_quote(
            id_rodada=4,
            id_fornecedor=1,
            id_produto=1,
            marca="Marca Original",
            embalagem="Caixa",
            qtd_por_embalagem=10.0,
            unidade="UN",
            preco_embalagem=100.0,
        )
        id_cotacao = cotacao["id"]

        atualizada = self.api.update_quote(
            id_cotacao=id_cotacao,
            id_fornecedor=1,
            id_produto=1,
            marca="Marca Atualizada",
            embalagem="Fardo Especial",
            qtd_por_embalagem=10.0,
            unidade="FD",
            preco_embalagem=50.0,
            produto_categoria="Limpeza Pesada",
        )
        self.assertEqual(atualizada["marca"], "Marca Atualizada")
        self.assertEqual(atualizada["embalagem"], "Fardo Especial")
        self.assertEqual(atualizada["qtd_por_embalagem"], 10.0)
        self.assertEqual(atualizada["unidade"], "FD")
        self.assertEqual(atualizada["preco_embalagem"], 50.0)
        self.assertAlmostEqual(atualizada["preco_unitario"], 5.0, places=2)

        # Teste de validações
        with self.assertRaises(ValueError):
            self.api.update_quote(id_cotacao=id_cotacao, id_fornecedor=1, embalagem="")
        with self.assertRaises(ValueError):
            self.api.update_quote(id_cotacao=id_cotacao, id_fornecedor=1, unidade="")
        with self.assertRaises(ValueError):
            self.api.update_quote(id_cotacao=id_cotacao, id_fornecedor=1, qtd_por_embalagem=0)
        with self.assertRaises(ValueError):
            self.api.update_quote(id_cotacao=id_cotacao, id_fornecedor=1, preco_embalagem=-5)
        with self.assertRaises(ValueError):
            self.api.update_quote(id_cotacao=id_cotacao, id_fornecedor=99999)
        with self.assertRaises(ValueError):
            self.api.update_quote(id_cotacao=99999, id_fornecedor=1)

        # Rodada fechada deve bloquear atualização
        cotacoes_fechadas = self.api.list_quotes(id_rodada=1)
        with self.assertRaises(ValueError):
            self.api.update_quote(id_cotacao=cotacoes_fechadas[0]["id"], id_fornecedor=1)

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
        from unittest.mock import patch
        from backend.db import set_last_db_path, get_last_db_path

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_db = f.name
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f_cfg:
            temp_cfg = f_cfg.name

        try:
            with patch("backend.core.config.get_app_config_path", return_value=temp_cfg):
                set_last_db_path(temp_db)
                last = get_last_db_path()
                self.assertIsNotNone(last)
                self.assertEqual(os.path.abspath(last), os.path.abspath(temp_db))
        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)
            if os.path.exists(temp_cfg):
                os.remove(temp_cfg)

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

    # -------------------------------------------------------------------------
    # Testes do Sistema de Backup Automático
    # -------------------------------------------------------------------------
    def test_execute_auto_backup_sem_diretorio_lanca_erro(self) -> None:
        """Verifica que execute_auto_backup lança erro se não houver pasta configurada."""
        self.api.save_settings({"backup_auto_diretorio": ""})
        with self.assertRaises(ValueError):
            self.api.execute_auto_backup()

    def test_execute_auto_backup_sucesso_e_integridade(self) -> None:
        """Verifica que o backup automático gera arquivo SQLite íntegro e atualiza configs."""
        import tempfile
        import shutil

        temp_backup_dir = tempfile.mkdtemp(prefix="cotacao_backup_test_")
        try:
            self.api.save_settings({
                "backup_auto_ativo": "1",
                "backup_auto_diretorio": temp_backup_dir,
                "backup_auto_max_arquivos": "5",
            })

            res = self.api.execute_auto_backup(origem_gatilho="teste")
            self.assertTrue(res["sucesso"])
            self.assertTrue(os.path.exists(res["caminho"]))
            self.assertGreater(res["tamanho_bytes"], 0)

            # Valida integridade do banco copiado
            conn_backup = sqlite3.connect(res["caminho"])
            cursor = conn_backup.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tabelas = [r[0] for r in cursor.fetchall()]
            conn_backup.close()
            self.assertIn("produtos", tabelas)
            self.assertIn("fornecedores", tabelas)

            # Verifica se configs foram atualizadas
            configs = self.api.get_settings()
            self.assertEqual(configs.get("backup_auto_ultimo_status"), "Sucesso")
            self.assertNotEqual(configs.get("backup_auto_ultimo_sucesso"), "")
        finally:
            shutil.rmtree(temp_backup_dir, ignore_errors=True)

    def test_execute_auto_backup_rotacao_arquivos(self) -> None:
        """Verifica que o número de backups mantidos respeita o limite de retenção configurado."""
        import tempfile
        import shutil
        import time

        temp_backup_dir = tempfile.mkdtemp(prefix="cotacao_rotacao_test_")
        try:
            limite_max = 3
            self.api.save_settings({
                "backup_auto_ativo": "1",
                "backup_auto_diretorio": temp_backup_dir,
                "backup_auto_max_arquivos": str(limite_max),
            })

            # Gera 5 backups sequenciais simulados
            for i in range(5):
                # Pequena pausa ou simula arquivo para timestamp diferente
                arq = os.path.join(temp_backup_dir, f"backup_auto_cotacao_20260902_{i:02d}0000.db")
                with open(arq, "wb") as f:
                    f.write(b"dummy")
                # Define mtime sequencial
                os.utime(arq, (time.time() + i * 10, time.time() + i * 10))

            # Executa o backup oficial da API
            res = self.api.execute_auto_backup()
            self.assertTrue(res["sucesso"])

            # Lista arquivos de backup no diretório
            arquivos = [
                f for f in os.listdir(temp_backup_dir)
                if f.startswith("backup_auto_cotacao_") and f.endswith(".db")
            ]
            self.assertLessEqual(len(arquivos), limite_max)
        finally:
            shutil.rmtree(temp_backup_dir, ignore_errors=True)

    def test_check_auto_backup_trigger(self) -> None:
        """Testa acionamento por gatilho condicional (abertura, fechamento, etc.)."""
        import tempfile
        import shutil

        temp_backup_dir = tempfile.mkdtemp(prefix="cotacao_trigger_test_")
        try:
            # 1. Com backup desativado -> não deve executar
            self.api.save_settings({
                "backup_auto_ativo": "0",
                "backup_auto_diretorio": temp_backup_dir,
                "backup_auto_gatilho": "abertura",
            })
            res_desativado = self.api.check_auto_backup_trigger("abertura")
            self.assertIsNone(res_desativado)

            # 2. Com backup ativo para 'abertura' -> acionamento por 'fechamento' não deve rodar
            self.api.save_settings({
                "backup_auto_ativo": "1",
                "backup_auto_diretorio": temp_backup_dir,
                "backup_auto_gatilho": "abertura",
            })
            res_outro_gatilho = self.api.check_auto_backup_trigger("fechamento")
            self.assertIsNone(res_outro_gatilho)

            # 3. Com backup ativo para 'abertura' -> acionamento por 'abertura' DEVE rodar
            res_abertura = self.api.check_auto_backup_trigger("abertura")
            self.assertIsNotNone(res_abertura)
            self.assertTrue(res_abertura["sucesso"])
        finally:
            shutil.rmtree(temp_backup_dir, ignore_errors=True)

    def test_execute_auto_backup_sem_permissao_escrita(self) -> None:
        """Verifica que diretório sem permissão de escrita gera erro e registra status de falha."""
        from unittest.mock import patch

        self.api.save_settings({
            "backup_auto_ativo": "1",
            "backup_auto_diretorio": "C:\\diretorio_sem_permissao_test_999",
        })

        with patch("os.makedirs", side_effect=PermissionError("Acesso negado")):
            with self.assertRaises(PermissionError):
                self.api.execute_auto_backup()

        configs = self.api.get_settings()
        self.assertTrue(configs.get("backup_auto_ultimo_status", "").startswith("Falha"))



    # -------------------------------------------------------------------------
    # Testes Abrangentes de Cobertura da API (Fase 2)
    # -------------------------------------------------------------------------
    def test_db_path_and_lock_handling(self) -> None:
        """Testa caminhos do banco, aquisição e liberação de locks de arquivo."""
        from unittest.mock import patch, MagicMock
        from backend.api import Api

        # Api sem caminho explícito
        with patch("backend.api.get_last_db_path", return_value=None), patch("backend.api.get_default_db_path", return_value="dummy_default.db"):
            api_temp = Api()
            self.assertEqual(api_temp.db_path, "dummy_default.db")

        # Exceção em _ensure_lock
        with patch("builtins.open", side_effect=PermissionError("Lock failed")):
            import tempfile
        with tempfile.NamedTemporaryFile(suffix=".db") as tf:
            api_lock = Api(tf.name)
            api_lock._ensure_lock()

        # Exceção em _release_lock
        mock_handle = MagicMock()
        mock_handle.close.side_effect = Exception("Close error")
        api_temp._file_lock_handle = mock_handle
        api_temp._release_lock()
        self.assertIsNone(api_temp._file_lock_handle)

    def test_check_db_status_with_existing_last_path(self) -> None:
        """Testa check_db_status quando o último banco existe no disco."""
        import tempfile
        from unittest.mock import patch
        from backend.api import Api
        from backend.db import init_db, seed_data

        fd, temp_db = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        api_test = None
        try:
            conn = init_db(temp_db)
            seed_data(conn)
            conn.close()
            with patch("backend.api.get_last_db_path", return_value=temp_db):
                api_test = Api()
                status = api_test.check_db_status()
                self.assertTrue(status["inicializado"])
                self.assertEqual(status["caminho_banco"], temp_db)
        finally:
            if api_test:
                api_test._release_lock()
            if os.path.exists(temp_db):
                try:
                    os.remove(temp_db)
                except Exception:
                    pass

    def test_export_database_and_salvar_backup_em_caminho_errors(self) -> None:
        """Testa exportação e salvamento de backup com validações de erro."""
        import uuid
        import tempfile
        from backend.api import Api
        path_inexistente = os.path.join(tempfile.gettempdir(), f"non_existent_{uuid.uuid4().hex}.db")
        api_inexistente = Api(path_inexistente)

        # export_database com banco inexistente
        with self.assertRaises(FileNotFoundError):
            api_inexistente.export_database()

        # _salvar_backup_em_caminho com caminho vazio
        with self.assertRaises(ValueError):
            self.api._salvar_backup_em_caminho("   ")

        # _salvar_backup_em_caminho com banco inexistente
        with self.assertRaises(FileNotFoundError):
            api_inexistente._salvar_backup_em_caminho("backup_teste.db")

        # _salvar_backup_em_caminho com criação de pasta pai e arquivo existente
        import shutil
        from backend.db import init_db
        temp_dir = tempfile.mkdtemp()
        db_file = os.path.join(temp_dir, "origem.db")
        conn = init_db(db_file)
        conn.close()
        api_local = Api(db_file)
        try:
            destino_nested = os.path.join(temp_dir, "nova_pasta", "subpasta", "backup.db")
            res = api_local._salvar_backup_em_caminho(destino_nested)
            self.assertTrue(res["sucesso"])
            self.assertTrue(os.path.exists(destino_nested))
        finally:
            api_local._release_lock()
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_select_location_and_save_backup_dialogs(self) -> None:
        """Testa diálogos nativos e webview para salvar backup."""
        import sys
        import uuid
        from unittest.mock import patch, MagicMock
        from backend.api import Api

        import tempfile
        import shutil
        from backend.db import init_db

        path_inexistente = os.path.join(tempfile.gettempdir(), f"non_existent_{uuid.uuid4().hex}.db")
        api_inexistente = Api(path_inexistente)
        with self.assertRaises(FileNotFoundError):
            api_inexistente.select_location_and_save_backup()

        temp_dir = tempfile.mkdtemp()
        db_file = os.path.join(temp_dir, "banco_dialog.db")
        conn = init_db(db_file)
        conn.close()
        api_dialog = Api(db_file)

        try:
            # Mock com webview window salvando com sucesso
            mock_win = MagicMock()
            mock_win.create_file_dialog.return_value = ["C:\\test\\backup.db"]
            mock_webview = MagicMock()
            mock_webview.windows = [mock_win]

            with patch.dict(sys.modules, {"webview": mock_webview}):
                with patch.object(api_dialog, "_salvar_backup_em_caminho", return_value={"sucesso": True}):
                    res = api_dialog.select_location_and_save_backup()
                    self.assertTrue(res["sucesso"])

            # Mock com webview cancelado pelo usuário
            mock_win.create_file_dialog.return_value = []
            with patch.dict(sys.modules, {"webview": mock_webview}):
                res_cancel = api_dialog.select_location_and_save_backup()
                self.assertTrue(res_cancel["cancelado"])

            # Mock sem webview windows -> fallback export_database
            mock_webview.windows = []
            with patch.dict(sys.modules, {"webview": mock_webview}):
                with patch.object(api_dialog, "export_database", return_value={"sucesso": True, "nome_arquivo": "b.db", "conteudo_base64": "abc"}):
                    res_fallback = api_dialog.select_location_and_save_backup()
                    self.assertTrue(res_fallback["sucesso"])

            # Mock exceção no diálogo
            mock_win.create_file_dialog.side_effect = RuntimeError("Dialog error")
            mock_webview.windows = [mock_win]
            with patch.dict(sys.modules, {"webview": mock_webview}):
                with self.assertRaises(ValueError):
                    api_dialog.select_location_and_save_backup()
        finally:
            api_dialog._release_lock()
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_select_backup_directory_dialogs(self) -> None:
        """Testa select_backup_directory com webview, tkinter e permissões."""
        import sys
        import tempfile
        from unittest.mock import patch, MagicMock

        temp_dir = tempfile.mkdtemp()
        try:
            # 1. Sucesso via webview
            mock_win = MagicMock()
            mock_win.create_file_dialog.return_value = [temp_dir]
            mock_webview = MagicMock()
            mock_webview.windows = [mock_win]

            with patch.dict(sys.modules, {"webview": mock_webview}):
                res = self.api.select_backup_directory()
                self.assertTrue(res["sucesso"])
                self.assertEqual(res["caminho"], temp_dir)

            # 2. Cancelamento via webview
            mock_win.create_file_dialog.return_value = None
            with patch.dict(sys.modules, {"webview": mock_webview}):
                with patch("tkinter.filedialog.askdirectory", return_value=""):
                    res_cancel = self.api.select_backup_directory()
                    self.assertTrue(res_cancel["cancelado"])

            # 3. Fallback para tkinter
            mock_webview.windows = []
            with patch.dict(sys.modules, {"webview": mock_webview}):
                with patch("tkinter.filedialog.askdirectory", return_value=temp_dir):
                    res_tk = self.api.select_backup_directory()
                    self.assertTrue(res_tk["sucesso"])

            # 4. Falha de permissão no diretório
            with patch.dict(sys.modules, {"webview": mock_webview}):
                with patch("tkinter.filedialog.askdirectory", return_value=temp_dir):
                    with patch("builtins.open", side_effect=PermissionError("Sem permissão")):
                        res_perm = self.api.select_backup_directory()
                        self.assertFalse(res_perm["sucesso"])
                        self.assertIn("Sem permissão", res_perm["mensagem"])
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_execute_auto_backup_rotation_and_errors(self) -> None:
        """Testa rotação de backups excedentes, configurações inválidas e tratamento de erros."""
        import tempfile
        import shutil
        from unittest.mock import patch, MagicMock

        temp_dir = tempfile.mkdtemp()
        try:
            # max_arquivos inválido ou menor que 1 (fallback para 10)
            self.api.save_settings({
                "backup_auto_ativo": "1",
                "backup_auto_diretorio": temp_dir,
                "backup_auto_max_arquivos": "-5",
            })
            res = self.api.execute_auto_backup()
            self.assertTrue(res["sucesso"])

            # Falha atômica durante backup sqlite
            with patch("sqlite3.connect", side_effect=RuntimeError("Erro de snapshot")):
                with self.assertRaises(RuntimeError):
                    self.api.execute_auto_backup()

            # Exceção em _registrar_status_backup tratada silenciosamente
            with patch.object(self.api, "_get_connection", side_effect=Exception("DB Error")):
                self.api._registrar_status_backup("Erro")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_check_auto_backup_trigger_conditions(self) -> None:
        """Testa condições do gatilho periódico e gatilho 'sempre'."""
        import tempfile
        import shutil
        from datetime import datetime, timedelta

        temp_dir = tempfile.mkdtemp()
        try:
            # Sem diretório configurado -> None
            self.api.save_settings({
                "backup_auto_ativo": "1",
                "backup_auto_diretorio": "   ",
                "backup_auto_gatilho": "abertura",
            })
            self.assertIsNone(self.api.check_auto_backup_trigger("abertura"))

            # Gatilho 'sempre'
            self.api.save_settings({
                "backup_auto_ativo": "1",
                "backup_auto_diretorio": temp_dir,
                "backup_auto_gatilho": "sempre",
            })
            res_sempre = self.api.check_auto_backup_trigger("qualquer")
            self.assertIsNotNone(res_sempre)

            # Gatilho periódico com tempo decorrido
            tempo_antigo = (datetime.now() - timedelta(hours=6)).strftime("%d/%m/%Y %H:%M:%S")
            self.api.save_settings({
                "backup_auto_ativo": "1",
                "backup_auto_diretorio": temp_dir,
                "backup_auto_gatilho": "periodico",
                "backup_auto_intervalo_horas": "4",
                "backup_auto_ultimo_sucesso": tempo_antigo,
            })
            res_per = self.api.check_auto_backup_trigger("periodico")
            self.assertIsNotNone(res_per)

            # Gatilho periódico sem tempo suficiente decorrido -> None
            tempo_recente = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            self.api.save_settings({
                "backup_auto_gatilho": "periodico",
                "backup_auto_ultimo_sucesso": tempo_recente,
            })
            self.assertIsNone(self.api.check_auto_backup_trigger("periodico"))

            # Gatilho periódico com data corrompida -> deve executar
            self.api.save_settings({
                "backup_auto_ultimo_sucesso": "data_invalida",
            })
            self.assertIsNotNone(self.api.check_auto_backup_trigger("periodico"))

            # _on_app_exit executando fechamento
            self.api.save_settings({
                "backup_auto_gatilho": "fechamento",
            })
            self.api._on_app_exit()
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_import_database_valid_and_corrupt(self) -> None:
        """Testa importação e restauração de banco SQLite com verificação de integridade."""
        import base64
        import tempfile
        from backend.api import Api
        from backend.db import init_db

        fd, temp_db = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            init_db(temp_db)
            api_test = Api(temp_db)

            # Cria um banco válido para codificar em base64
            with open(temp_db, "rb") as f:
                b64_valido = base64.b64encode(f.read()).decode("utf-8")

            res = api_test.import_database(b64_valido)
            self.assertTrue(res["sucesso"])

            # Banco corrompido (não SQLite válido)
            b64_corrompido = base64.b64encode(b"arquivo corrompido de texto puro").decode("utf-8")
            with self.assertRaises(ValueError):
                api_test.import_database(b64_corrompido)

            # Base64 mal formatado
            with self.assertRaises(ValueError):
                api_test.import_database("base64_invalido_!!!")
        finally:
            api_test._release_lock()
            if os.path.exists(temp_db):
                try:
                    os.remove(temp_db)
                except Exception:
                    pass

    def test_rodada_fechada_ou_cancelada_blocks_actions(self) -> None:
        """Garante que ações em rodadas fechadas ou canceladas são rigorosamente bloqueadas."""
        # Cria rodada fechada
        r_fechada = self.api.create_round(descricao="Rodada Encerrada")
        self.api.update_round(r_fechada["id"], descricao="Rodada Encerrada", status="fechada")

        # Bloqueio de inclusão de necessidade
        with self.assertRaises(ValueError):
            self.api.create_need(id_rodada=r_fechada["id"], id_produto=1)

        # Bloqueio de cotação
        with self.assertRaises(ValueError):
            self.api.create_quote(
                id_rodada=r_fechada["id"],
                id_fornecedor=1,
                id_produto=1,
                preco_embalagem=10.0,
            )

        # Bloqueio de duplicação de necessidades para rodada fechada
        with self.assertRaises(ValueError):
            self.api.duplicate_round_needs(id_origem=1, id_destino=r_fechada["id"])

        # Cria rodada cancelada
        r_canc = self.api.create_round(descricao="Rodada Cancelada")
        self.api.update_round(r_canc["id"], descricao="Rodada Cancelada", status="cancelada")

        # Bloqueio em rodada cancelada
        with self.assertRaises(ValueError):
            self.api.create_need(id_rodada=r_canc["id"], id_produto=1)

    def test_remove_product_and_supplier_with_and_without_history(self) -> None:
        """Testa exclusão física vs bloqueio por histórico comercial."""
        # Produto sem histórico -> deve excluir
        p_novo = self.api.create_product(nome="Produto Limpo Exclusao")
        res_del_p = self.api.remove_product(p_novo["id"])
        self.assertTrue(res_del_p["sucesso"])

        # Produto inexistente -> ValueError
        with self.assertRaises(ValueError):
            self.api.remove_product(99999)

        # Produto com histórico (ex: ID 1 Detergente tem cotações e alocações) -> Bloqueado
        with self.assertRaises(ValueError):
            self.api.remove_product(1)

        # Fornecedor sem histórico -> deve excluir
        f_novo = self.api.create_supplier(nome="Fornecedor Limpo Exclusao")
        res_del_f = self.api.remove_supplier(f_novo["id"])
        self.assertTrue(res_del_f["sucesso"])

        # Fornecedor inexistente -> ValueError
        with self.assertRaises(ValueError):
            self.api.remove_supplier(99999)

        # Fornecedor com histórico (ex: Fornecedor 1) -> Bloqueado
        with self.assertRaises(ValueError):
            self.api.remove_supplier(1)

    def test_remove_round_validations(self) -> None:
        """Testa remoção de rodadas sem histórico e bloqueio quando há vínculos históricos."""
        # Rodada sem histórico -> exclusão permitida
        r_limpa = self.api.create_round(descricao="Rodada Vazia para Deletar")
        res_del = self.api.remove_round(r_limpa["id"])
        self.assertTrue(res_del["sucesso"])

        # Rodada inexistente -> ValueError
        with self.assertRaises(ValueError):
            self.api.remove_round(99999)

        # Rodada 1 possui histórico completo -> Bloqueada
        with self.assertRaises(ValueError):
            self.api.remove_round(1)

    def test_save_quote_validations(self) -> None:
        """Testa todas as validações de campos obrigatórios ao cadastrar cotação."""
        # Embalagem vazia
        with self.assertRaises(ValueError):
            self.api.create_quote(id_rodada=4, id_fornecedor=1, id_produto=1, embalagem="   ")

        # Unidade vazia
        with self.assertRaises(ValueError):
            self.api.create_quote(id_rodada=4, id_fornecedor=1, id_produto=1, unidade="   ")

        # Qtd por embalagem <= 0
        with self.assertRaises(ValueError):
            self.api.create_quote(id_rodada=4, id_fornecedor=1, id_produto=1, qtd_por_embalagem=0)

        # Preço negativo
        with self.assertRaises(ValueError):
            self.api.create_quote(id_rodada=4, id_fornecedor=1, id_produto=1, preco_embalagem=-5.0)

        # Fornecedor inexistente
        with self.assertRaises(ValueError):
            self.api.create_quote(id_rodada=4, id_fornecedor=99999, id_produto=1)

        # Sem ID e sem Nome de produto
        with self.assertRaises(ValueError):
            self.api.create_quote(id_rodada=4, id_fornecedor=1, id_produto=None, produto_nome="")

        # Auto-cadastro por nome de produto quando id_produto é None
        cot = self.api.create_quote(
            id_rodada=4,
            id_fornecedor=1,
            produto_nome="Novo Produto Auto Cotação",
            preco_embalagem=25.0,
        )
        self.assertGreater(cot["id_produto"], 0)

        # Atualização (UPSERT) para cotação com mesmo produto já cadastrado
        cot2 = self.api.create_quote(
            id_rodada=4,
            id_fornecedor=1,
            produto_nome="Novo Produto Auto Cotação",
            preco_embalagem=30.0,
        )
        self.assertEqual(cot2["id_produto"], cot["id_produto"])

    def test_batch_save_allocations_and_remove_allocation_validations(self) -> None:
        """Testa alocações em lote com dados inválidos e remoção."""
        # Dados não numéricos na alocação
        with self.assertRaises(ValueError):
            self.api.save_allocations(
                id_rodada=4,
                alocacoes=[{"id_produto": "invalido", "id_fornecedor": 1, "quantidade": "abc"}],
            )

        # Alocação válida
        res = self.api.save_allocations(
            id_rodada=4,
            alocacoes=[{"id_produto": 1, "id_fornecedor": 1, "quantidade": 50}],
        )
        self.assertTrue(res["sucesso"])
        self.assertEqual(res["total_alocacoes"], 1)

        # Remoção da alocação
        alocs = self.api.list_allocations(id_rodada=4)
        aloc_id = alocs[0]["id"]
        res_del = self.api.remove_allocation(aloc_id)
        self.assertTrue(res_del["sucesso"])

    def test_excel_export_dialogs_and_encerrar_sistema(self) -> None:
        """Testa exportação de planilhas com diálogo e encerramento do sistema."""
        import sys
        import tempfile
        from unittest.mock import patch, MagicMock

        temp_dir = tempfile.mkdtemp()
        try:
            caminho_xlsx = os.path.join(temp_dir, "planilha_teste.xlsx")
            mock_win = MagicMock()
            mock_win.create_file_dialog.return_value = [caminho_xlsx]
            mock_webview = MagicMock()
            mock_webview.windows = [mock_win]

            # Salvar com sucesso via webview dialog
            with patch.dict(sys.modules, {"webview": mock_webview}):
                res_plan = self.api.export_quote_spreadsheet(id_rodada=1)
                self.assertTrue(res_plan["sucesso"])
                self.assertTrue(os.path.exists(caminho_xlsx))

            # Cancelado pelo usuário
            mock_win.create_file_dialog.return_value = None
            with patch.dict(sys.modules, {"webview": mock_webview}):
                res_canc = self.api.export_products_excel()
                self.assertTrue(res_canc["cancelado"])

            # Exceção no diálogo
            mock_win.create_file_dialog.side_effect = RuntimeError("Save error")
            with patch.dict(sys.modules, {"webview": mock_webview}):
                res_err = self.api.export_suppliers_excel()
                self.assertFalse(res_err["salvo_em_disco"])
                self.assertIn("aviso", res_err)

            # Teste encerrar_sistema com mock de threading.Thread.start para não matar o processo de testes
            with patch("threading.Thread.start"):
                res_exit = self.api.encerrar_sistema()
                self.assertTrue(res_exit["sucesso"])
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)



    def test_api_edge_cases_and_cleanups(self) -> None:
        """Testa casos de borda restantes para atingir cobertura máxima em api.py."""
        import tempfile
        import os
        import sys
        from unittest.mock import patch, MagicMock
        from backend.api import Api
        from backend.db import init_db

        # 1. create_supplier com nome vazio (linha 701)
        with self.assertRaises(ValueError):
            self.api.create_supplier(nome="   ")

        # 2. create_round com descrição vazia (linha 819)
        with self.assertRaises(ValueError):
            self.api.create_round(descricao="   ")

        # 3. duplicate_round_needs sucesso (linhas 895-896)
        r1 = self.api.create_round(descricao="Rodada Origem Duplicacao")
        self.api.create_need(id_rodada=r1["id"], id_produto=1)
        r2 = self.api.create_round(descricao="Rodada Destino Duplicacao")
        res_dup = self.api.duplicate_round_needs(id_origem=r1["id"], id_destino=r2["id"])
        self.assertTrue(res_dup["sucesso"])
        self.assertEqual(res_dup["itens_copiados"], 1)

        # 4. create_need com id_produto inexistente e sem nome (linhas 941, 959)
        with self.assertRaises(ValueError):
            self.api.create_need(id_rodada=4, id_produto=99999, produto_nome="")

        # save_quote com id_produto inexistente e sem nome (linhas 1076, 1094)
        with self.assertRaises(ValueError):
            self.api.create_quote(id_rodada=4, id_fornecedor=1, id_produto=99999, produto_nome="")

        # 5. save_quote com prod_id inexistente mas produto_nome válido (linha 1076)
        cot_fallback = self.api.create_quote(
            id_rodada=4,
            id_fornecedor=1,
            id_produto=99999,
            produto_nome="Produto Fallback Id Inexistente",
            preco_embalagem=15.0,
        )
        self.assertGreater(cot_fallback["id_produto"], 0)

        # 6. export_database com banco em arquivo físico real (linhas 181-186)
        fd, real_db = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            init_db(real_db)
            api_real = Api(real_db)
            exp = api_real.export_database()
            self.assertTrue(exp["sucesso"])
            self.assertIn("conteudo_base64", exp)

            # _ensure_lock exceção com arquivo existente (linhas 77-78)
            api_real._release_lock()
            with patch("builtins.open", side_effect=PermissionError("Lock error")):
                api_real._ensure_lock()

            # _on_app_exit com banco físico real (linhas 501-503)
            api_real.save_settings({"backup_auto_ativo": "0"})
            api_real._on_app_exit()

            # select_location_and_save_backup sem .xlsx (linha 1292) e pasta inexistente (linha 1296)
            caminho_sem_ext = os.path.join(tempfile.gettempdir(), "nova_pasta_xlsx", "teste_plan")
            mock_win = MagicMock()
            mock_win.create_file_dialog.return_value = caminho_sem_ext  # retorna str sem lista
            mock_wv = MagicMock()
            mock_wv.windows = [mock_win]
            with patch.dict(sys.modules, {"webview": mock_wv}):
                res_plan = api_real.export_products_excel()
                self.assertTrue(res_plan["sucesso"])
                self.assertTrue(res_plan["caminho"].endswith(".xlsx"))
                if os.path.exists(res_plan["caminho"]):
                    os.remove(res_plan["caminho"])

            # select_backup_directory com string única (linhas 271-272)
            mock_win.create_file_dialog.return_value = tempfile.gettempdir()
            with patch.dict(sys.modules, {"webview": mock_wv}):
                res_dir_str = api_real.select_backup_directory()
                self.assertTrue(res_dir_str["sucesso"])

            # select_backup_directory tkinter cancelado e erro (linhas 286, 288-289, 297)
            mock_wv.windows = []
            with patch.dict(sys.modules, {"webview": mock_wv}):
                with patch("tkinter.filedialog.askdirectory", return_value=""):
                    self.assertTrue(api_real.select_backup_directory()["cancelado"])
                with patch("tkinter.filedialog.askdirectory", side_effect=RuntimeError("Tk error")):
                    self.assertFalse(api_real.select_backup_directory()["sucesso"])
                with patch("tkinter.filedialog.askdirectory", return_value="   "):
                    self.assertTrue(api_real.select_backup_directory()["cancelado"])

            # execute_auto_backup com max_arquivos inválido e falha de escrita teste (linhas 339-340, 356-359)
            temp_b_dir = tempfile.mkdtemp()
            try:
                api_real.save_settings({
                    "backup_auto_ativo": "1",
                    "backup_auto_diretorio": temp_b_dir,
                    "backup_auto_max_arquivos": "invalido",
                })
                with patch("builtins.open", side_effect=PermissionError("Sem permissao")):
                    with self.assertRaises(PermissionError):
                        api_real.execute_auto_backup()

                # Rotação com erro ao remover arquivo antigo (linhas 397-400)
                for i in range(12):
                    arq_rot = os.path.join(temp_b_dir, f"backup_auto_cotacao_20260101_{i:04d}.db")
                    with open(arq_rot, "wb") as f:
                        f.write(b"rot")

                orig_remove = os.remove
                def selective_rm(p):
                    if "backup_auto_cotacao_20260101_" in p:
                        raise PermissionError("Erro remove")
                    return orig_remove(p)

                with patch("os.remove", side_effect=selective_rm):
                    api_real.execute_auto_backup()

                # check_auto_backup_trigger com intervalo inválido e último sucesso vazio (linhas 454-455, 459, 472-476)
                api_real.save_settings({
                    "backup_auto_gatilho": "periodico",
                    "backup_auto_intervalo_horas": "nao_numero",
                    "backup_auto_ultimo_sucesso": "",
                })
                self.assertIsNotNone(api_real.check_auto_backup_trigger("periodico"))

                with patch.object(api_real, "_get_connection", side_effect=sqlite3.OperationalError("db locked")):
                    self.assertIsNone(api_real.check_auto_backup_trigger("periodico"))
                with patch.object(api_real, "_get_connection", side_effect=RuntimeError("generic error")):
                    self.assertIsNone(api_real.check_auto_backup_trigger("periodico"))

                # Erro na rotação linha 399-400
                with patch("os.listdir", side_effect=RuntimeError("Listdir error")):
                    api_real.execute_auto_backup()

                # import_database com integridade comprometida (linhas 523, 526)
                with patch("sqlite3.connect") as mock_sql_conn:
                    mock_c = MagicMock()
                    mock_c.cursor.return_value.fetchone.return_value = ["database disk image is malformed"]
                    mock_sql_conn.return_value = mock_c
                    with self.assertRaises(ValueError):
                        api_real.import_database(exp["conteudo_base64"])

                with patch("sqlite3.connect", side_effect=RuntimeError("Connect fail")):
                    with self.assertRaises(ValueError):
                        api_real.import_database(exp["conteudo_base64"])

                # _on_app_exit com exceção tratada (linhas 502-503)
                with patch.object(api_real, "check_auto_backup_trigger", side_effect=Exception("Exit err")):
                    api_real._on_app_exit()

                # _start_auto_backup_worker thread execution (linhas 487-492)
                with patch("threading.Thread") as mock_thread:
                    api_real._backup_worker_started = False
                    with patch("time.sleep", side_effect=[None, StopIteration]):
                        try:
                            api_real._start_auto_backup_worker()
                            worker_target = mock_thread.call_args[1]["target"]
                            worker_target()
                        except StopIteration:
                            pass

                # _do_shutdown execução real com mock de os._exit (linhas 1368-1375)
                with patch("threading.Thread") as mock_thread, patch("os._exit") as mock_exit, patch("time.sleep"):
                    api_real.encerrar_sistema()
                    shutdown_target = mock_thread.call_args[1]["target"]
                    shutdown_target()
                    mock_exit.assert_called_once_with(0)
            finally:
                import shutil
                shutil.rmtree(temp_b_dir, ignore_errors=True)

            api_real._release_lock()
        finally:
            if os.path.exists(real_db):
                try:
                    os.remove(real_db)
                except Exception:
                    pass


if __name__ == "__main__":
    unittest.main()


