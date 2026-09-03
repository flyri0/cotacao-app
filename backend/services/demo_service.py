import sqlite3
from datetime import datetime
from typing import Dict, Any

from backend.core.schema import create_schema
from backend.domain.configuracoes import seed_settings, save_db_setting

def populate_demo_db_db(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Popula o banco com um conjunto rico e amplo de demonstração e testes de alta escala:
    - 50 produtos em 6 categorias (Limpeza, Descartáveis, Alimentos & Copa, Higiene, Escritório & Informática, Manutenção & EPIs)
    - 8 fornecedores com pedidos mínimos variados
    - 3 rodadas concluídas (históricas) com cotações e compras
    - 1 rodada aberta (em andamento) com todos os 50 produtos cotados e alocações ativas
    """
    cursor = conn.cursor()

    # Limpa dados anteriores recriando schema limpo
    cursor.executescript(
        """
        DROP TABLE IF EXISTS alocacoes;
        DROP TABLE IF EXISTS cotacoes;
        DROP TABLE IF EXISTS necessidades;
        DROP TABLE IF EXISTS rodadas;
        DROP TABLE IF EXISTS fornecedores;
        DROP TABLE IF EXISTS produtos;
        """
    )
    conn.commit()
    create_schema(conn)
    seed_settings(conn)

    # 1. 50 PRODUTOS EM 6 CATEGORIAS
    produtos = [
        # Limpeza (1..4)
        ("Detergente Líquido Neutro 500ml", "Limpeza"),           # 1
        ("Desinfetante Lavanda 5L", "Limpeza"),                    # 2
        ("Álcool Líquido 70% 1L", "Limpeza"),                      # 3
        ("Sabão em Pó 1kg", "Limpeza"),                            # 4
        # Descartáveis (5..8)
        ("Papel Toalha Interfolha 2 Dobras", "Descartáveis"),      # 5
        ("Copo Descartável 200ml", "Descartáveis"),                # 6
        ("Saco de Lixo Reforçado 100L", "Descartáveis"),           # 7
        ("Guardanapo de Papel 30x30", "Descartáveis"),             # 8
        # Alimentos & Copa (9..10)
        ("Café Torrado e Moído 500g", "Alimentos & Copa"),         # 9
        ("Açúcar Refinado 1kg", "Alimentos & Copa"),               # 10
        # Higiene (11..12)
        ("Sabonete Líquido Erva Doce 5L", "Higiene"),              # 11
        ("Papel Higiênico Folha Dupla 30m", "Higiene"),            # 12
        # Mais Limpeza (13..18)
        ("Água Sanitária 2L", "Limpeza"),                          # 13
        ("Desengordurante Multiuso 500ml", "Limpeza"),             # 14
        ("Limpador Perfumado Floral 5L", "Limpeza"),               # 15
        ("Esponja Dupla Face Multiuso", "Limpeza"),                # 16
        ("Lustra Móveis 200ml", "Limpeza"),                        # 17
        ("Amaciante de Roupas Concentrado 2L", "Limpeza"),         # 18
        # Mais Descartáveis (19..24)
        ("Copo Descartável para Café 50ml", "Descartáveis"),       # 19
        ("Prato Descartável Plástico 15cm", "Descartáveis"),       # 20
        ("Garfo Descartável Reforçado", "Descartáveis"),           # 21
        ("Faca Descartável Reforçada", "Descartáveis"),            # 22
        ("Filme de PVC Transparente 30cm x 100m", "Descartáveis"), # 23
        ("Papel Alumínio 30cm x 7.5m", "Descartáveis"),            # 24
        # Mais Alimentos & Copa (25..32)
        ("Chá de Camomila c/ 25 sachês", "Alimentos & Copa"),      # 25
        ("Adoçante Líquido Sucralose 75ml", "Alimentos & Copa"),   # 26
        ("Biscoito Cream Cracker 400g", "Alimentos & Copa"),       # 27
        ("Biscoito Maizena 400g", "Alimentos & Copa"),             # 28
        ("Leite UHT Integral 1L", "Alimentos & Copa"),             # 29
        ("Achocolatado em Pó 400g", "Alimentos & Copa"),           # 30
        ("Filtro de Papel para Café nº 103", "Alimentos & Copa"),  # 31
        ("Mexedor Plástico para Café 11cm", "Alimentos & Copa"),   # 32
        # Mais Higiene (33..40)
        ("Álcool em Gel Antisséptico 70% 500ml", "Higiene"),       # 33
        ("Dispenser de Parede Sabonete Líquido", "Higiene"),       # 34
        ("Dispenser de Parede Papel Toalha", "Higiene"),           # 35
        ("Toalha de Papel Bobina 200m", "Higiene"),                # 36
        ("Luva Látex para Limpeza M", "Higiene"),                  # 37
        ("Luva Látex para Limpeza G", "Higiene"),                  # 38
        ("Pano de Chão Microfibra 40x60", "Higiene"),              # 39
        ("Odorizador de Ambientes Aerossol 360ml", "Higiene"),     # 40
        # Escritório & Informática (41..45)
        ("Papel Sulfite A4 75g Resma 500 Folhas", "Escritório & Informática"), # 41
        ("Caneta Esferográfica Azul 1.0mm", "Escritório & Informática"),       # 42
        ("Caneta Esferográfica Preta 1.0mm", "Escritório & Informática"),      # 43
        ("Bloco Auto-adesivo Amarelo 76x76mm", "Escritório & Informática"),    # 44
        ("Grampeador de Mesa Médio 26/6", "Escritório & Informática"),         # 45
        # Manutenção & EPIs (46..50)
        ("Vassoura Piaçava com Cabo", "Manutenção & EPIs"),        # 46
        ("Rodo de Borracha Duplo 40cm com Cabo", "Manutenção & EPIs"), # 47
        ("Balde Plástico Graduado 15L", "Manutenção & EPIs"),      # 48
        ("Pá de Lixo Coletora com Cabo Longo", "Manutenção & EPIs"), # 49
        ("Fita Adesiva Transparente 45mm x 50m", "Manutenção & EPIs"), # 50
    ]
    cursor.executemany(
        "INSERT INTO produtos (nome, categoria) VALUES (?, ?)",
        produtos,
    )

    # 2. 8 FORNECEDORES
    fornecedores = [
        ("Distribuidora Alvorada", "Carlos Silva", "(11) 98765-4321", "vendas@alvorada.com.br", 600.0),
        ("Comercial Silva & Filhos", "Mariana Costa", "(11) 91234-5678", "cotacao@silvafilhos.com.br", 450.0),
        ("Atacado Brasil Suprimentos", "Roberto Santos", "(11) 99887-1122", "pedidos@atacadobrasil.com.br", 800.0),
        ("Suprimentos Express", "Patricia Lima", "(11) 97654-3210", "atendimento@expresssuprimentos.com.br", 350.0),
        ("Central Descartáveis & Embalagens", "Felipe Moura", "(11) 94321-8765", "contato@centraldescartaveis.com.br", 500.0),
        ("Nova Era Higiene e Limpeza", "Amanda Rocha", "(11) 93211-9988", "contato@novaerahigiene.com.br", 400.0),
        ("Papelaria & Escritório Central", "Marcos Vinicius", "(11) 92110-4455", "vendas@papelariacentral.com.br", 300.0),
        ("Master Distribuição e Atacado", "Juliana Pires", "(11) 98122-3344", "atacado@masterdistribuicao.com.br", 750.0),
    ]
    cursor.executemany(
        """
        INSERT INTO fornecedores (nome, contato, telefone, email, pedido_minimo)
        VALUES (?, ?, ?, ?, ?)
        """,
        fornecedores,
    )

    # 3. RODADAS: 3 HISTÓRICAS FECHADAS + 1 ATIVA ABERTA
    # Rodada 1: Janeiro 2026 (Fechada)
    cursor.execute(
        "INSERT INTO rodadas (descricao, status, data_criacao) VALUES (?, ?, ?)",
        ("Cotação Geral - Janeiro 2026", "fechada", "2026-01-15 10:00:00"),
    )
    r1 = cursor.lastrowid

    # Rodada 2: Fevereiro 2026 (Fechada)
    cursor.execute(
        "INSERT INTO rodadas (descricao, status, data_criacao) VALUES (?, ?, ?)",
        ("Cotação Geral - Fevereiro 2026", "fechada", "2026-02-14 14:30:00"),
    )
    r2 = cursor.lastrowid

    # Rodada 3: Março 2026 (Fechada)
    cursor.execute(
        "INSERT INTO rodadas (descricao, status, data_criacao) VALUES (?, ?, ?)",
        ("Cotação Mensal - Março 2026", "fechada", "2026-03-16 09:15:00"),
    )
    r3 = cursor.lastrowid

    # Rodada 4: Rodada Atual (Aberta / Em andamento)
    cursor.execute(
        "INSERT INTO rodadas (descricao, status, data_criacao) VALUES (?, ?, ?)",
        ("Cotação de Suprimentos - Abril 2026 (Atual)", "aberta", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    r4 = cursor.lastrowid

    # NECESSIDADES NAS RODADAS
    # Rodada 1 (Janeiro) - 6 itens compatíveis
    nec_r1 = [(r1, 1), (r1, 2), (r1, 5), (r1, 6), (r1, 9), (r1, 11)]
    # Rodada 2 (Fevereiro) - 12 itens
    nec_r2 = [(r2, 1), (r2, 2), (r2, 3), (r2, 5), (r2, 6), (r2, 7), (r2, 9), (r2, 12), (r2, 13), (r2, 19), (r2, 25), (r2, 41)]
    # Rodada 3 (Março) - 16 itens
    nec_r3 = [(r3, 1), (r3, 2), (r3, 3), (r3, 4), (r3, 5), (r3, 6), (r3, 8), (r3, 9), (r3, 10), (r3, 11), (r3, 14), (r3, 16), (r3, 20), (r3, 27), (r3, 36), (r3, 42)]
    # Rodada 4 (Atual - Abril) - Todos os 50 produtos necessários para testar matriz completa
    nec_r4 = [(r4, i) for i in range(1, 51)]

    cursor.executemany("INSERT INTO necessidades (id_rodada, id_produto) VALUES (?, ?)", nec_r1 + nec_r2 + nec_r3 + nec_r4)

    # COTAÇÕES HISTÓRICAS E ATUAIS (Evolução de preços para gráficos e estatísticas)
    cotacoes_seed = [
        # --- RODADA 1 (Janeiro 2026) ---
        (r1, 1, 1, "Ypê", "Caixa c/ 24 un", 24.0, "UN", 57.60),  # 2.40/un
        (r1, 2, 1, "Limpol", "Fardo c/ 12 un", 12.0, "UN", 27.60),  # 2.30/un
        (r1, 3, 1, "Minuano", "Caixa c/ 24 un", 24.0, "UN", 58.80),  # 2.45/un
        (r1, 1, 2, "Veja", "Galão 5L", 1.0, "GALAO", 32.00),
        (r1, 2, 2, "Pinho Sol", "Galão 5L", 1.0, "GALAO", 29.90),
        (r1, 4, 2, "Sancler", "Galão 5L", 1.0, "GALAO", 31.50),
        (r1, 3, 5, "Sulleg", "Fardo c/ 8 pct", 8.0, "PCT", 128.00), # 16.00/pct
        (r1, 5, 5, "Melhoramentos", "Fardo c/ 10 pct", 10.0, "PCT", 155.00), # 15.50/pct
        (r1, 3, 6, "Copobras", "Caixa c/ 5000 un", 5000.0, "UN", 220.00), # 0.044/un
        (r1, 5, 6, "Altacoppo", "Caixa c/ 2500 un", 2500.0, "UN", 115.00), # 0.046/un
        (r1, 2, 9, "Pilão", "Pacote 500g", 1.0, "PCT", 18.50),
        (r1, 4, 9, "Melitta", "Fardo c/ 10 pct", 10.0, "PCT", 179.00), # 17.90/pct
        (r1, 1, 11, "Premisse", "Galão 5L", 1.0, "GALAO", 42.00),
        (r1, 2, 11, "Trilha", "Galão 5L", 1.0, "GALAO", 39.50),

        # --- RODADA 2 (Fevereiro 2026) ---
        (r2, 1, 1, "Ypê", "Caixa c/ 24 un", 24.0, "UN", 56.40),  # 2.35/un
        (r2, 2, 1, "Limpol", "Fardo c/ 12 un", 12.0, "UN", 27.00),  # 2.25/un
        (r2, 4, 1, "Minuano", "Caixa c/ 24 un", 24.0, "UN", 55.20),  # 2.30/un
        (r2, 1, 2, "Veja", "Galão 5L", 1.0, "GALAO", 31.00),
        (r2, 3, 2, "Pinho Sol", "Galão 5L", 1.0, "GALAO", 28.50),
        (r2, 1, 3, "Zulu", "Caixa c/ 12 frascos", 12.0, "FRASCO", 78.00), # 6.50/frasco
        (r2, 2, 3, "Itajá", "Caixa c/ 6 frascos", 6.0, "FRASCO", 40.20),   # 6.70/frasco
        (r2, 3, 5, "Sulleg", "Fardo c/ 8 pct", 8.0, "PCT", 124.00),
        (r2, 5, 5, "Melhoramentos", "Fardo c/ 10 pct", 10.0, "PCT", 150.00),
        (r2, 3, 6, "Copobras", "Caixa c/ 5000 un", 5000.0, "UN", 215.00),
        (r2, 5, 6, "Altacoppo", "Caixa c/ 5000 un", 5000.0, "UN", 210.00),
        (r2, 3, 7, "Embalixo", "Pacote c/ 100 un", 1.0, "PCT", 48.00),
        (r2, 5, 7, "Plastubos", "Pacote c/ 100 un", 1.0, "PCT", 45.00),
        (r2, 2, 9, "Pilão", "Pacote 500g", 1.0, "PCT", 17.90),
        (r2, 4, 9, "Melitta", "Fardo c/ 10 pct", 10.0, "PCT", 172.00),
        (r2, 1, 12, "Neve", "Fardo c/ 64 rolos", 64.0, "ROLO", 96.00),
        (r2, 1, 13, "Qboa", "Caixa c/ 6 un", 6.0, "UN", 45.00),
        (r2, 6, 13, "Dragão", "Caixa c/ 6 un", 6.0, "UN", 38.00),
        (r2, 3, 19, "Copobras", "Caixa c/ 5000 un", 5000.0, "UN", 135.00),
        (r2, 5, 19, "Altacoppo", "Caixa c/ 5000 un", 5000.0, "UN", 130.00),
        (r2, 2, 25, "Leão", "Caixa c/ 25 sachês", 25.0, "UN", 6.80),
        (r2, 7, 41, "Report", "Caixa c/ 10 resmas", 10.0, "CX", 260.00),

        # --- RODADA 3 (Março 2026) ---
        (r3, 1, 1, "Ypê", "Caixa c/ 24 un", 24.0, "UN", 54.00),  # 2.25/un
        (r3, 2, 1, "Limpol", "Fardo c/ 12 un", 12.0, "UN", 26.40),  # 2.20/un
        (r3, 3, 1, "Minuano", "Caixa c/ 24 un", 24.0, "UN", 56.40),  # 2.35/un
        (r3, 1, 2, "Veja", "Galão 5L", 1.0, "GALAO", 29.90),
        (r3, 2, 2, "Pinho Sol", "Galão 5L", 1.0, "GALAO", 28.00),
        (r3, 3, 2, "Sancler", "Galão 5L", 1.0, "GALAO", 27.50),
        (r3, 1, 3, "Zulu", "Caixa c/ 12 frascos", 12.0, "FRASCO", 75.60), # 6.30/frasco
        (r3, 4, 3, "Itajá", "Caixa c/ 12 frascos", 12.0, "FRASCO", 74.40), # 6.20/frasco
        (r3, 1, 4, "Omo", "Caixa c/ 24 cx", 24.0, "CX", 72.00),
        (r3, 2, 4, "Brilhante", "Caixa c/ 24 cx", 24.0, "CX", 69.60),
        (r3, 3, 5, "Sulleg", "Fardo c/ 8 pct", 8.0, "PCT", 120.00), # 15.00/pct
        (r3, 5, 5, "Melhoramentos", "Fardo c/ 10 pct", 10.0, "PCT", 142.00), # 14.20/pct
        (r3, 3, 6, "Copobras", "Caixa c/ 5000 un", 5000.0, "UN", 205.00),
        (r3, 5, 6, "Altacoppo", "Caixa c/ 5000 un", 5000.0, "UN", 200.00),
        (r3, 2, 9, "Pilão", "Pacote 500g", 1.0, "PCT", 17.50),
        (r3, 4, 9, "Melitta", "Fardo c/ 10 pct", 10.0, "PCT", 168.00),
        (r3, 2, 10, "União", "Fardo c/ 10 pct", 10.0, "PCT", 42.00),
        (r3, 4, 10, "Da Barra", "Fardo c/ 10 pct", 10.0, "PCT", 39.90),
        (r3, 1, 11, "Premisse", "Galão 5L", 1.0, "GALAO", 38.00),
        (r3, 2, 11, "Trilha", "Galão 5L", 1.0, "GALAO", 36.90),
        (r3, 1, 14, "Veja", "Caixa c/ 12 un", 12.0, "UN", 94.00),
        (r3, 2, 14, "Mr Músculo", "Caixa c/ 12 un", 12.0, "UN", 98.00),
        (r3, 1, 16, "Scotch-Brite", "Pacote c/ 10 un", 10.0, "UN", 23.00),
        (r3, 3, 16, "Bettanin", "Caixa c/ 60 un", 60.0, "UN", 92.00),
        (r3, 5, 20, "Copobras", "Pacote c/ 50 un", 50.0, "UN", 8.80),
        (r3, 2, 27, "Mabel", "Caixa c/ 20 pct", 20.0, "CX", 92.00),
        (r3, 8, 27, "Marilan", "Caixa c/ 20 pct", 20.0, "CX", 88.00),
        (r3, 5, 36, "Sulleg", "Fardo c/ 6 rolos", 6.0, "ROLO", 98.00),
        (r3, 4, 42, "BIC", "Caixa c/ 50 un", 50.0, "UN", 46.00),
        (r3, 7, 42, "Compactor", "Caixa c/ 50 un", 50.0, "UN", 39.50),

        # --- RODADA 4 (Atual - Abril 2026: Catálogo Completo para Comparação e Alocação) ---
        # 1. Detergente Líquido Neutro 500ml (4 cotações mantidas para integridade de stats)
        (r4, 1, 1, "Ypê", "Caixa c/ 24 un", 24.0, "UN", 52.80),  # 2.20/un (menor)
        (r4, 2, 1, "Limpol", "Fardo c/ 12 un", 12.0, "UN", 27.60),  # 2.30/un
        (r4, 3, 1, "Minuano", "Caixa c/ 24 un", 24.0, "UN", 57.60),  # 2.40/un
        (r4, 4, 1, "Barra", "Caixa c/ 24 un", 24.0, "UN", 54.00),  # 2.25/un

        # 2. Desinfetante Lavanda 5L
        (r4, 1, 2, "Veja", "Galão 5L", 1.0, "GALAO", 29.00),
        (r4, 2, 2, "Pinho Sol", "Galão 5L", 1.0, "GALAO", 27.50),        # 27.50 (menor)
        (r4, 3, 2, "Sancler", "Galão 5L", 1.0, "GALAO", 28.20),
        (r4, 6, 2, "Kalipto", "Galão 5L", 1.0, "GALAO", 27.90),

        # 3. Álcool Líquido 70% 1L
        (r4, 1, 3, "Zulu", "Caixa c/ 12 frascos", 12.0, "FRASCO", 72.00), # 6.00/frasco
        (r4, 2, 3, "Itajá", "Caixa c/ 6 frascos", 6.0, "FRASCO", 37.20),   # 6.20/frasco
        (r4, 4, 3, "Coperalcool", "Caixa c/ 12 frascos", 12.0, "FRASCO", 70.80), # 5.90/frasco (menor)

        # 4. Sabão em Pó 1kg
        (r4, 1, 4, "Omo", "Caixa c/ 24 un", 24.0, "CX", 180.00),  # 7.50/cx
        (r4, 2, 4, "Brilhante", "Caixa c/ 20 un", 20.0, "CX", 140.00), # 7.00/cx (menor)
        (r4, 6, 4, "Tixan", "Caixa c/ 10 un", 10.0, "CX", 72.00),  # 7.20/cx

        # 5. Papel Toalha Interfolha 2 Dobras
        (r4, 3, 5, "Sulleg", "Fardo c/ 8 pct", 8.0, "PCT", 116.00),      # 14.50/pct
        (r4, 5, 5, "Melhoramentos", "Fardo c/ 10 pct", 10.0, "PCT", 140.00),    # 14.00/pct (menor)
        (r4, 6, 5, "Santher", "Fardo c/ 8 pct", 8.0, "PCT", 114.00),     # 14.25/pct

        # 6. Copo Descartável 200ml
        (r4, 3, 6, "Copobras", "Caixa c/ 5000 un", 5000.0, "UN", 200.00), # 0.040/un (menor)
        (r4, 5, 6, "Altacoppo", "Caixa c/ 2500 un", 2500.0, "UN", 105.00), # 0.042/un
        (r4, 8, 6, "Plásticos PR", "Caixa c/ 5000 un", 5000.0, "UN", 205.00),

        # 7. Saco de Lixo Reforçado 100L
        (r4, 3, 7, "Embalixo", "Pacote c/ 100 un", 100.0, "UN", 45.00), # 0.45/un
        (r4, 5, 7, "Plastubos", "Pacote c/ 100 un", 100.0, "UN", 42.00), # 0.42/un (menor)

        # 8. Guardanapo de Papel 30x30
        (r4, 3, 8, "Kipapel", "Pacote c/ 500 un", 500.0, "UN", 18.00), # 0.036/un
        (r4, 5, 8, "Ripax", "Fardo c/ 10 pct (5000 un)", 5000.0, "UN", 170.00), # 0.034/un (menor)

        # 9. Café Torrado e Moído 500g
        (r4, 2, 9, "Pilão", "Pacote 500g", 1.0, "PCT", 17.20),
        (r4, 4, 9, "Melitta", "Fardo c/ 10 pct", 10.0, "PCT", 165.00),    # 16.50/pct (menor)
        (r4, 8, 9, "Caboclo", "Fardo c/ 10 pct", 10.0, "PCT", 168.00),

        # 10. Açúcar Refinado 1kg
        (r4, 2, 10, "União", "Fardo c/ 10 pct", 10.0, "PCT", 41.00),
        (r4, 4, 10, "Da Barra", "Fardo c/ 10 pct", 10.0, "PCT", 38.50),
        (r4, 8, 10, "Caravelas", "Fardo c/ 10 pct", 10.0, "PCT", 37.50), # 3.75/pct (menor)

        # 11. Sabonete Líquido Erva Doce 5L
        (r4, 1, 11, "Premisse", "Galão 5L", 1.0, "GALAO", 37.00),
        (r4, 2, 11, "Trilha", "Galão 5L", 1.0, "GALAO", 35.80),           # 35.80 (menor)
        (r4, 6, 11, "Olimpo", "Galão 5L", 1.0, "GALAO", 36.50),

        # 12. Papel Higiênico Folha Dupla 30m
        (r4, 1, 12, "Neve", "Fardo c/ 64 rolos", 64.0, "ROLO", 92.80), # 1.45/un (menor)
        (r4, 5, 12, "Personal", "Fardo c/ 32 rolos", 32.0, "ROLO", 48.00), # 1.50/un
        (r4, 6, 12, "Mili", "Fardo c/ 64 rolos", 64.0, "ROLO", 94.00),

        # 13. Água Sanitária 2L
        (r4, 1, 13, "Qboa", "Caixa c/ 6 un", 6.0, "UN", 42.00),
        (r4, 2, 13, "Candida", "Caixa c/ 6 un", 6.0, "UN", 39.00),
        (r4, 6, 13, "Dragão", "Caixa c/ 6 un", 6.0, "UN", 36.00), # 6.00/un (menor)

        # 14. Desengordurante Multiuso 500ml
        (r4, 1, 14, "Mr Músculo", "Caixa c/ 12 un", 12.0, "UN", 96.00),
        (r4, 2, 14, "Veja", "Caixa c/ 12 un", 12.0, "UN", 90.00), # 7.50/un (menor)

        # 15. Limpador Perfumado Floral 5L
        (r4, 1, 15, "Veja Perfumes", "Galão 5L", 1.0, "GALAO", 28.00),
        (r4, 6, 15, "Ajax", "Galão 5L", 1.0, "GALAO", 26.50), # menor

        # 16. Esponja Dupla Face Multiuso
        (r4, 1, 16, "Scotch-Brite", "Pacote c/ 10 un", 10.0, "UN", 22.00), # 2.20/un
        (r4, 3, 16, "Bettanin", "Caixa c/ 60 un", 60.0, "UN", 90.00),      # 1.50/un (menor)

        # 17. Lustra Móveis 200ml
        (r4, 2, 17, "Poliflor", "Caixa c/ 12 un", 12.0, "UN", 78.00),
        (r4, 6, 17, "Peroba", "Caixa c/ 12 un", 12.0, "UN", 72.00), # 6.00/un (menor)

        # 18. Amaciante Concentrado 2L
        (r4, 1, 18, "Downy", "Caixa c/ 6 un", 6.0, "UN", 96.00),
        (r4, 2, 18, "Comfort", "Caixa c/ 6 un", 6.0, "UN", 84.00),
        (r4, 6, 18, "Ypê", "Caixa c/ 6 un", 6.0, "UN", 60.00), # 10.00/un (menor)

        # 19. Copo Descartável Café 50ml
        (r4, 3, 19, "Copobras", "Caixa c/ 5000 un", 5000.0, "UN", 130.00), # 0.026/un
        (r4, 5, 19, "Altacoppo", "Caixa c/ 5000 un", 5000.0, "UN", 125.00), # 0.025/un (menor)

        # 20. Prato Descartável 15cm
        (r4, 3, 20, "Plásticos PR", "Caixa c/ 1000 un", 1000.0, "UN", 140.00),
        (r4, 5, 20, "Copobras", "Pacote c/ 50 un", 50.0, "UN", 8.50), # 0.17/un

        # 21. Garfo Descartável Reforçado
        (r4, 5, 21, "Copobras", "Caixa c/ 1000 un", 1000.0, "UN", 45.00),
        (r4, 8, 21, "Strawplast", "Caixa c/ 1000 un", 1000.0, "UN", 42.00), # 0.042/un (menor)

        # 22. Faca Descartável Reforçada
        (r4, 5, 22, "Copobras", "Caixa c/ 1000 un", 1000.0, "UN", 45.00),
        (r4, 8, 22, "Strawplast", "Caixa c/ 1000 un", 1000.0, "UN", 43.00), # 0.043/un (menor)

        # 23. Filme PVC 30cm x 100m
        (r4, 5, 23, "Wyda", "Rolo c/ 100m", 1.0, "ROLO", 24.00),
        (r4, 8, 23, "Alpfilm", "Rolo c/ 100m", 1.0, "ROLO", 22.50), # menor

        # 24. Papel Alumínio 30cm x 7.5m
        (r4, 5, 24, "Wyda", "Caixa c/ 25 rolos", 25.0, "ROLO", 110.00),
        (r4, 8, 24, "Boreda", "Caixa c/ 25 rolos", 25.0, "ROLO", 105.00), # menor

        # 25. Chá Camomila c/ 25
        (r4, 2, 25, "Leão", "Caixa c/ 25 sachês", 25.0, "UN", 6.50),
        (r4, 4, 25, "Dr. Oetker", "Caixa c/ 25 sachês", 25.0, "UN", 5.90), # menor

        # 26. Adoçante Sucralose 75ml
        (r4, 2, 26, "Linea", "Frasco 75ml", 1.0, "FRASCO", 11.50),
        (r4, 4, 26, "Zero-Cal", "Frasco 100ml", 1.0, "FRASCO", 12.00),

        # 27. Biscoito Cream Cracker 400g
        (r4, 2, 27, "Mabel", "Caixa c/ 20 pct", 20.0, "PCT", 90.00),
        (r4, 4, 27, "Bauducco", "Caixa c/ 20 pct", 20.0, "PCT", 95.00),
        (r4, 8, 27, "Marilan", "Caixa c/ 20 pct", 20.0, "PCT", 86.00), # 4.30/pct (menor)

        # 28. Biscoito Maizena 400g
        (r4, 2, 28, "Mabel", "Caixa c/ 20 pct", 20.0, "PCT", 88.00),
        (r4, 8, 28, "Marilan", "Caixa c/ 20 pct", 20.0, "PCT", 85.00), # 4.25/pct (menor)

        # 29. Leite UHT Integral 1L
        (r4, 2, 29, "Piracanjuba", "Caixa c/ 12 un", 12.0, "UN", 58.80), # 4.90/un
        (r4, 4, 29, "Itambé", "Caixa c/ 12 un", 12.0, "UN", 61.20),
        (r4, 8, 29, "Líder", "Caixa c/ 12 un", 12.0, "UN", 54.00),       # 4.50/un (menor)

        # 30. Achocolatado em Pó 400g
        (r4, 2, 30, "Nescau", "Fardo c/ 12 un", 12.0, "UN", 96.00),
        (r4, 4, 30, "Toddy", "Fardo c/ 12 un", 12.0, "UN", 90.00), # 7.50/un (menor)

        # 31. Filtro Papel nº 103
        (r4, 2, 31, "Melitta", "Caixa c/ 30 pct", 30.0, "PCT", 120.00),
        (r4, 4, 31, "Brigitta", "Caixa c/ 30 pct", 30.0, "PCT", 105.00), # 3.50/pct (menor)

        # 32. Mexedor Plástico de Café 11cm
        (r4, 5, 32, "Strawplast", "Pacote c/ 500 un", 500.0, "UN", 9.50),
        (r4, 7, 32, "Theoto", "Pacote c/ 500 un", 500.0, "UN", 8.90), # menor

        # 33. Álcool Gel 500ml
        (r4, 1, 33, "Asseptgel", "Caixa c/ 12 un", 12.0, "UN", 84.00),
        (r4, 6, 33, "Premisse", "Caixa c/ 12 un", 12.0, "UN", 78.00), # 6.50/un (menor)

        # 34. Dispenser Sabonete Líquido
        (r4, 1, 34, "Premisse", "Unidade", 1.0, "UN", 38.00),
        (r4, 6, 34, "Trilha", "Unidade", 1.0, "UN", 35.00), # menor

        # 35. Dispenser Papel Toalha
        (r4, 5, 35, "Premisse", "Unidade", 1.0, "UN", 45.00),
        (r4, 6, 35, "Melhoramentos", "Unidade", 1.0, "UN", 42.00), # menor

        # 36. Toalha Papel Bobina 200m
        (r4, 5, 36, "Sulleg", "Fardo c/ 6 rolos", 6.0, "ROLO", 96.00),
        (r4, 6, 36, "Santher", "Fardo c/ 6 rolos", 6.0, "ROLO", 90.00), # 15.00/rolo (menor)

        # 37. Luva Látex Limpeza M
        (r4, 1, 37, "Mucambo", "Par avulso", 1.0, "PAR", 5.50),
        (r4, 6, 37, "Sanro", "Caixa c/ 12 pares", 12.0, "PAR", 54.00), # 4.50/par (menor)

        # 38. Luva Látex Limpeza G
        (r4, 1, 38, "Mucambo", "Par avulso", 1.0, "PAR", 5.50),
        (r4, 6, 38, "Sanro", "Caixa c/ 12 pares", 12.0, "PAR", 54.00), # 4.50/par (menor)

        # 39. Pano Microfibra 40x60
        (r4, 1, 39, "Scotch-Brite", "Pacote c/ 3 un", 3.0, "UN", 18.00),
        (r4, 6, 39, "Nobre", "Pacote c/ 5 un", 5.0, "UN", 22.50), # 4.50/un (menor)

        # 40. Odorizador Aerossol 360ml
        (r4, 1, 40, "Bom Ar", "Caixa c/ 12 un", 12.0, "UN", 132.00),
        (r4, 6, 40, "Glade", "Caixa c/ 12 un", 12.0, "UN", 126.00), # 10.50/un (menor)

        # 41. Papel Sulfite A4 Resma 500f
        (r4, 4, 41, "Chamex", "Caixa c/ 10 resmas", 10.0, "RESMA", 265.00),
        (r4, 7, 41, "Report", "Caixa c/ 10 resmas", 10.0, "RESMA", 250.00),
        (r4, 8, 41, "Copimax", "Caixa c/ 10 resmas", 10.0, "RESMA", 245.00), # 24.50/resma (menor)

        # 42. Caneta Esferográfica Azul 1.0mm
        (r4, 4, 42, "BIC", "Caixa c/ 50 un", 50.0, "UN", 45.00),
        (r4, 7, 42, "Compactor", "Caixa c/ 50 un", 50.0, "UN", 38.00), # 0.76/un (menor)

        # 43. Caneta Esferográfica Preta 1.0mm
        (r4, 4, 43, "BIC", "Caixa c/ 50 un", 50.0, "UN", 45.00),
        (r4, 7, 43, "Compactor", "Caixa c/ 50 un", 50.0, "UN", 38.00), # 0.76/un (menor)

        # 44. Bloco Auto-adesivo 76x76mm
        (r4, 4, 44, "Adelbras", "Pacote c/ 4 un", 4.0, "UN", 16.00), # 4.00/un (menor)
        (r4, 7, 44, "Post-it 3M", "Pacote c/ 4 un", 4.0, "UN", 22.00),

        # 45. Grampeador Médio 26/6
        (r4, 4, 45, "Eagle", "Unidade", 1.0, "UN", 25.00), # menor
        (r4, 7, 45, "CIS", "Unidade", 1.0, "UN", 28.00),

        # 46. Vassoura Piaçava com Cabo
        (r4, 1, 46, "Bettanin", "Unidade", 1.0, "UN", 16.50),
        (r4, 3, 46, "Condor", "Caixa c/ 12 un", 12.0, "UN", 168.00), # 14.00/un (menor)

        # 47. Rodo Borracha 40cm
        (r4, 1, 47, "Bettanin", "Unidade", 1.0, "UN", 14.00),
        (r4, 3, 47, "Condor", "Caixa c/ 12 un", 12.0, "UN", 144.00), # 12.00/un (menor)

        # 48. Balde Plástico 15L
        (r4, 3, 48, "Araldite Plásticos", "Unidade", 1.0, "UN", 15.00),
        (r4, 8, 48, "Sanremo", "Caixa c/ 6 un", 6.0, "UN", 78.00), # 13.00/un (menor)

        # 49. Pá de Lixo Cabo Longo
        (r4, 1, 49, "Bettanin", "Unidade", 1.0, "UN", 19.50),
        (r4, 3, 49, "Condor", "Unidade", 1.0, "UN", 18.00), # menor

        # 50. Fita Adesiva Transparente 45mmx50m
        (r4, 5, 50, "3M Tartan", "Caixa c/ 16 rolos", 16.0, "ROLO", 96.00),
        (r4, 7, 50, "Adelbras", "Caixa c/ 16 rolos", 16.0, "ROLO", 80.00),
        (r4, 8, 50, "Eurocel", "Caixa c/ 16 rolos", 16.0, "ROLO", 76.00), # 4.75/rolo (menor)
    ]
    cursor.executemany(
        """
        INSERT INTO cotacoes (
            id_rodada, id_fornecedor, id_produto,
            marca, embalagem, qtd_por_embalagem, unidade, preco_embalagem
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        cotacoes_seed,
    )

    # ALOCAÇÕES HISTÓRICAS E ATIVAS
    alocacoes_seed = [
        # Rodada 1 (mantidas intactas)
        (r1, 1, 2, 100.0),
        (r1, 2, 2, 20.0),
        (r1, 5, 5, 40.0),
        (r1, 6, 3, 4000.0),
        (r1, 9, 4, 30.0),
        (r1, 11, 2, 15.0),
        # Rodada 2
        (r2, 1, 2, 120.0),
        (r2, 2, 3, 25.0),
        (r2, 3, 1, 30.0),
        (r2, 5, 5, 50.0),
        (r2, 6, 5, 5000.0),
        (r2, 7, 5, 20.0),
        (r2, 9, 4, 35.0),
        (r2, 12, 1, 10.0),
        # Rodada 3
        (r3, 1, 2, 150.0),
        (r3, 2, 3, 30.0),
        (r3, 3, 4, 40.0),
        (r3, 4, 2, 20.0),
        (r3, 5, 5, 60.0),
        (r3, 6, 5, 6000.0),
        (r3, 9, 4, 40.0),
        (r3, 10, 4, 50.0),
        (r3, 11, 2, 20.0),
        # Rodada 4 (Atual - em andamento, com 25 alocações distribuídas)
        (r4, 1, 1, 96.0),
        (r4, 1, 4, 48.0),
        (r4, 2, 2, 24.0),
        (r4, 3, 4, 35.0),
        (r4, 5, 5, 55.0),
        (r4, 6, 3, 5000.0),
        (r4, 9, 4, 45.0),
        (r4, 11, 2, 18.0),
        (r4, 12, 1, 12.0),
        (r4, 4, 2, 40.0),
        (r4, 7, 5, 10.0),
        (r4, 10, 8, 30.0),
        (r4, 13, 6, 18.0),
        (r4, 16, 3, 60.0),
        (r4, 18, 6, 24.0),
        (r4, 19, 5, 10000.0),
        (r4, 23, 8, 5.0),
        (r4, 27, 8, 20.0),
        (r4, 29, 8, 60.0),
        (r4, 33, 6, 24.0),
        (r4, 36, 6, 18.0),
        (r4, 41, 7, 20.0),
        (r4, 42, 7, 100.0),
        (r4, 46, 3, 12.0),
        (r4, 50, 7, 32.0),
    ]
    cursor.executemany(
        """
        INSERT INTO alocacoes (
            id_rodada, id_produto, id_fornecedor, quantidade
        ) VALUES (?, ?, ?, ?)
        """,
        alocacoes_seed,
    )

    save_db_setting(conn, "sistema_inicializado", "1")
    conn.commit()

    return {"sucesso": True, "tipo": "demo_completo"}

def seed_data(conn: sqlite3.Connection) -> None:
    """Função legada para compatibilidade de testes."""
    populate_demo_db_db(conn)
