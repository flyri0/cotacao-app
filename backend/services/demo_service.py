import sqlite3
from datetime import datetime
from typing import Dict, Any

from backend.core.schema import create_schema
from backend.domain.configuracoes import seed_settings, save_db_setting

def populate_demo_db_db(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Popula o banco com um conjunto rico de demonstração:
    - 12 produtos em 4 categorias
    - 5 fornecedores completos
    - 3 rodadas concluídas (históricas) com cotações e compras
    - 1 rodada aberta (em andamento) com cotações e alocações ativas
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

    # 1. 12 PRODUTOS EM 4 CATEGORIAS
    produtos = [
        # Limpeza
        ("Detergente Líquido Neutro 500ml", "Limpeza"),
        ("Desinfetante Lavanda 5L", "Limpeza"),
        ("Álcool Líquido 70% 1L", "Limpeza"),
        ("Sabão em Pó 1kg", "Limpeza"),
        # Descartáveis
        ("Papel Toalha Interfolha 2 Dobras", "Descartáveis"),
        ("Copo Descartável 200ml", "Descartáveis"),
        ("Saco de Lixo Reforçado 100L", "Descartáveis"),
        ("Guardanapo de Papel 30x30", "Descartáveis"),
        # Alimentos & Copa
        ("Café Torrado e Moído 500g", "Alimentos & Copa"),
        ("Açúcar Refinado 1kg", "Alimentos & Copa"),
        # Higiene & Papelaria
        ("Sabonete Líquido Erva Doce 5L", "Higiene"),
        ("Papel Higiênico Folha Dupla 30m", "Higiene"),
    ]
    cursor.executemany(
        "INSERT INTO produtos (nome, categoria) VALUES (?, ?)",
        produtos,
    )

    # 2. 5 FORNECEDORES
    fornecedores = [
        ("Distribuidora Alvorada", "Carlos Silva", "(11) 98765-4321", "vendas@alvorada.com.br", 600.0),
        ("Comercial Silva & Filhos", "Mariana Costa", "(11) 91234-5678", "cotacao@silvafilhos.com.br", 450.0),
        ("Atacado Brasil Suprimentos", "Roberto Santos", "(11) 99887-1122", "pedidos@atacadobrasil.com.br", 800.0),
        ("Suprimentos Express", "Patricia Lima", "(11) 97654-3210", "atendimento@expresssuprimentos.com.br", 350.0),
        ("Central Descartáveis & Embalagens", "Felipe Moura", "(11) 94321-8765", "contato@centraldescartaveis.com.br", 500.0),
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
    # Rodada 1 (Janeiro)
    nec_r1 = [(r1, 1), (r1, 2), (r1, 5), (r1, 6), (r1, 9), (r1, 11)]
    # Rodada 2 (Fevereiro)
    nec_r2 = [(r2, 1), (r2, 2), (r2, 3), (r2, 5), (r2, 6), (r2, 7), (r2, 9), (r2, 12)]
    # Rodada 3 (Março)
    nec_r3 = [(r3, 1), (r3, 2), (r3, 3), (r3, 4), (r3, 5), (r3, 6), (r3, 8), (r3, 9), (r3, 10), (r3, 11)]
    # Rodada 4 (Atual - Abril)
    nec_r4 = [(r4, 1), (r4, 2), (r4, 3), (r4, 5), (r4, 6), (r4, 9), (r4, 11), (r4, 12)]

    cursor.executemany("INSERT INTO necessidades (id_rodada, id_produto) VALUES (?, ?)", nec_r1 + nec_r2 + nec_r3 + nec_r4)

    # COTAÇÕES HISTÓRICAS (Evolução de preços para gráficos e estatísticas)
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

        # --- RODADA 4 (Atual - Abril 2026) ---
        (r4, 1, 1, "Ypê", "Caixa c/ 24 un", 24.0, "UN", 52.80),  # 2.20/un (menor)
        (r4, 2, 1, "Limpol", "Fardo c/ 12 un", 12.0, "UN", 27.60),  # 2.30/un
        (r4, 3, 1, "Minuano", "Caixa c/ 24 un", 24.0, "UN", 57.60),  # 2.40/un
        (r4, 4, 1, "Barra", "Caixa c/ 24 un", 24.0, "UN", 54.00),  # 2.25/un
        (r4, 1, 2, "Veja", "Galão 5L", 1.0, "GALAO", 29.00),
        (r4, 2, 2, "Pinho Sol", "Galão 5L", 1.0, "GALAO", 27.50),        # 27.50 (menor)
        (r4, 3, 2, "Sancler", "Galão 5L", 1.0, "GALAO", 28.20),
        (r4, 1, 3, "Zulu", "Caixa c/ 12 frascos", 12.0, "FRASCO", 72.00), # 6.00/frasco
        (r4, 2, 3, "Itajá", "Caixa c/ 6 frascos", 6.0, "FRASCO", 37.20),   # 6.20/frasco
        (r4, 4, 3, "Coperalcool", "Caixa c/ 12 frascos", 12.0, "FRASCO", 70.80), # 5.90/frasco (menor)
        (r4, 3, 5, "Sulleg", "Fardo c/ 8 pct", 8.0, "PCT", 116.00),      # 14.50/pct
        (r4, 5, 5, "Melhoramentos", "Fardo c/ 10 pct", 10.0, "PCT", 140.00),    # 14.00/pct (menor)
        (r4, 3, 6, "Copobras", "Caixa c/ 5000 un", 5000.0, "UN", 200.00), # 0.040/un (menor)
        (r4, 5, 6, "Altacoppo", "Caixa c/ 2500 un", 2500.0, "UN", 105.00), # 0.042/un
        (r4, 2, 9, "Pilão", "Pacote 500g", 1.0, "PCT", 17.20),
        (r4, 4, 9, "Melitta", "Fardo c/ 10 pct", 10.0, "PCT", 165.00),    # 16.50/pct (menor)
        (r4, 1, 11, "Premisse", "Galão 5L", 1.0, "GALAO", 37.00),
        (r4, 2, 11, "Trilha", "Galão 5L", 1.0, "GALAO", 35.80),           # 35.80 (menor)
        (r4, 1, 12, "Neve", "Fardo c/ 64 rolos", 64.0, "ROLO", 92.80), # 1.45/un (menor)
        (r4, 5, 12, "Personal", "Fardo c/ 32 rolos", 32.0, "ROLO", 48.00), # 1.50/un
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
        # Rodada 1
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
        # Rodada 4 (Atual - em andamento)
        (r4, 1, 1, 96.0),
        (r4, 1, 4, 48.0),
        (r4, 2, 2, 24.0),
        (r4, 3, 4, 35.0),
        (r4, 5, 5, 55.0),
        (r4, 6, 3, 5000.0),
        (r4, 9, 4, 45.0),
        (r4, 11, 2, 18.0),
        (r4, 12, 1, 12.0),
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

