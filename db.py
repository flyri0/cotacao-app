import base64
import json
import os
import sqlite3
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional


def get_app_config_path() -> str:
    """Retorna o caminho absoluto do arquivo app_config.json que armazena o local do último banco usado."""
    if getattr(sys, "frozen", False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "app_config.json")


def get_default_db_path() -> str:
    """Retorna o caminho padrão para o arquivo cotacao.db no diretório da aplicação."""
    if getattr(sys, "frozen", False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "cotacao.db")


def get_last_db_path() -> Optional[str]:
    """
    Retorna o caminho do último banco de dados utilizado registrado em app_config.json.
    Retorna None se a configuração não existir ou se o arquivo físico não for encontrado no disco.
    """
    config_file = get_app_config_path()
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                path = data.get("ultimo_banco_path")
                if path and os.path.exists(path):
                    return os.path.abspath(path)
        except Exception as e:
            print(f"Aviso ao ler app_config.json: {e}")
    return None


def set_last_db_path(db_path: str) -> None:
    """Registra o caminho do banco ativo no arquivo app_config.json."""
    config_file = get_app_config_path()
    try:
        data = {}
        if os.path.exists(config_file):
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        data["ultimo_banco_path"] = os.path.abspath(db_path)
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Aviso ao salvar app_config.json: {e}")


def get_db_path() -> str:
    """Retorna o caminho do banco SQLite ativo (último salvo se existir no disco, ou padrão)."""
    last = get_last_db_path()
    if last and os.path.exists(last):
        return last
    return get_default_db_path()


DB_PATH = get_db_path()


def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Retorna uma conexão com o banco SQLite configurada com suporte a chaves estrangeiras."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    """Cria as tabelas do sistema se não existirem e aplica migrações automáticas."""
    cursor = conn.cursor()

    # 1. Verifica se precisamos migrar o banco antigo (remover CASCADE e adicionar coluna 'ativo')
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='produtos'")
    if cursor.fetchone():
        cursor.execute("PRAGMA table_info(produtos)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "ativo" not in columns:
            conn.execute("PRAGMA foreign_keys = OFF;")
            cursor.execute("ALTER TABLE produtos ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1")
            cursor.execute("ALTER TABLE fornecedores ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1")
            
            # Renomeia tabelas com CASCADE para recriá-las com o novo schema
            for table in ["necessidades", "cotacoes", "alocacoes"]:
                cursor.execute(f"ALTER TABLE {table} RENAME TO {table}_old")
            conn.commit()

    # 2. Criação das tabelas atualizadas (Cria do zero ou usa as que já existem)
    cursor.executescript(
        """
        -- Configurações do Aplicativo (Identidade visual e preferências)
        CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT NOT NULL
        );

        -- Produtos (Cadastro mestre)
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            categoria TEXT,
            ativo INTEGER NOT NULL DEFAULT 1
        );

        -- Fornecedores (Cadastro mestre com pedido mínimo)
        CREATE TABLE IF NOT EXISTS fornecedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            contato TEXT,
            telefone TEXT,
            email TEXT,
            pedido_minimo REAL NOT NULL DEFAULT 0.0,
            ativo INTEGER NOT NULL DEFAULT 1
        );

        -- Rodadas de cotação
        CREATE TABLE IF NOT EXISTS rodadas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'aberta', -- 'aberta', 'fechada', 'cancelada'
            data_criacao TEXT NOT NULL
        );

        -- Necessidades da rodada (itens em falta selecionados para a rodada)
        CREATE TABLE IF NOT EXISTS necessidades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_rodada INTEGER NOT NULL,
            id_produto INTEGER NOT NULL,
            quantidade REAL NOT NULL DEFAULT 0.0,
            FOREIGN KEY (id_rodada) REFERENCES rodadas (id) ON DELETE CASCADE,
            FOREIGN KEY (id_produto) REFERENCES produtos (id),
            UNIQUE (id_rodada, id_produto)
        );

        -- Cotações recebidas de fornecedores para uma rodada
        CREATE TABLE IF NOT EXISTS cotacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_rodada INTEGER NOT NULL,
            id_fornecedor INTEGER NOT NULL,
            id_produto INTEGER NOT NULL,
            marca TEXT,
            embalagem TEXT NOT NULL,
            qtd_por_embalagem REAL NOT NULL,
            unidade TEXT NOT NULL DEFAULT 'UN',
            preco_embalagem REAL NOT NULL,
            FOREIGN KEY (id_rodada) REFERENCES rodadas (id) ON DELETE CASCADE,
            FOREIGN KEY (id_fornecedor) REFERENCES fornecedores (id),
            FOREIGN KEY (id_produto) REFERENCES produtos (id),
            UNIQUE (id_rodada, id_fornecedor, id_produto)
        );

        -- Alocações (Decisões de compra)
        CREATE TABLE IF NOT EXISTS alocacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_rodada INTEGER NOT NULL,
            id_produto INTEGER NOT NULL,
            id_fornecedor INTEGER NOT NULL,
            quantidade REAL NOT NULL,
            observacao TEXT,
            FOREIGN KEY (id_rodada) REFERENCES rodadas (id) ON DELETE CASCADE,
            FOREIGN KEY (id_produto) REFERENCES produtos (id),
            FOREIGN KEY (id_fornecedor) REFERENCES fornecedores (id)
        );
        """
    )
    conn.commit()


def seed_configuracoes(conn: sqlite3.Connection) -> None:
    """Garante que as chaves de configuração básicas existam."""
    cursor = conn.cursor()
    configs_padrao = [
        ("app_nome", "Mapa de Cotações"),
        ("app_subtitulo", "Comparativo e Alocação Inteligente"),
        ("app_icone", "Scale"),
        ("app_theme_color", "blue"),
        ("app_color_scheme", "light"),
        ("app_densidade", "compacto"),
        ("app_tamanho_fonte", "medio"),
        ("sistema_inicializado", "0"),
    ]
    for chave, valor in configs_padrao:
        cursor.execute(
            "INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)",
            (chave, valor),
        )
    conn.commit()


def verificar_status_banco_db(conn: sqlite3.Connection, db_path: Optional[str] = None) -> Dict[str, Any]:
    """Verifica se o banco de dados já foi inicializado pelo usuário."""
    if db_path and db_path != ":memory:" and not os.path.exists(db_path):
        return {
            "inicializado": False,
            "total_produtos": 0,
            "total_fornecedores": 0,
            "total_rodadas": 0,
            "caminho_banco": db_path,
        }

    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM produtos")
    total_produtos = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM fornecedores")
    total_fornecedores = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM rodadas")
    total_rodadas = cursor.fetchone()[0]

    cursor.execute("SELECT valor FROM configuracoes WHERE chave = 'sistema_inicializado'")
    row = cursor.fetchone()
    sistema_inicializado = row[0] if row else "0"

    # Considera inicializado se o usuário marcou o setup inicial OU se já existirem cadastros
    esta_inicializado = sistema_inicializado == "1" or total_produtos > 0 or total_fornecedores > 0 or total_rodadas > 0

    return {
        "inicializado": esta_inicializado,
        "total_produtos": total_produtos,
        "total_fornecedores": total_fornecedores,
        "total_rodadas": total_rodadas,
        "caminho_banco": db_path or get_db_path(),
    }


def inicializar_banco_em_branco_db(conn: sqlite3.Connection) -> Dict[str, Any]:
    """Marca o banco como inicializado em branco pronto para produção."""
    salvar_configuracao_db(conn, "sistema_inicializado", "1")
    return {"sucesso": True, "tipo": "em_branco"}


def popular_banco_demo_completo_db(conn: sqlite3.Connection) -> Dict[str, Any]:
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
    seed_configuracoes(conn)

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
    nec_r1 = [(r1, 1, 100.0), (r1, 2, 20.0), (r1, 5, 40.0), (r1, 6, 4000.0), (r1, 9, 30.0), (r1, 11, 15.0)]
    # Rodada 2 (Fevereiro)
    nec_r2 = [(r2, 1, 120.0), (r2, 2, 25.0), (r2, 3, 30.0), (r2, 5, 50.0), (r2, 6, 5000.0), (r2, 7, 20.0), (r2, 9, 35.0), (r2, 12, 10.0)]
    # Rodada 3 (Março)
    nec_r3 = [(r3, 1, 150.0), (r3, 2, 30.0), (r3, 3, 40.0), (r3, 4, 20.0), (r3, 5, 60.0), (r3, 6, 6000.0), (r3, 8, 25.0), (r3, 9, 40.0), (r3, 10, 50.0), (r3, 11, 20.0)]
    # Rodada 4 (Atual - Abril)
    nec_r4 = [(r4, 1, 140.0), (r4, 2, 24.0), (r4, 3, 35.0), (r4, 5, 55.0), (r4, 6, 5000.0), (r4, 9, 45.0), (r4, 11, 18.0), (r4, 12, 12.0)]

    cursor.executemany("INSERT INTO necessidades (id_rodada, id_produto, quantidade) VALUES (?, ?, ?)", nec_r1 + nec_r2 + nec_r3 + nec_r4)

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
        (r1, 1, 2, 100.0, "Compra concluída"),
        (r1, 2, 2, 20.0, "Compra concluída"),
        (r1, 5, 5, 40.0, "Compra concluída"),
        (r1, 6, 3, 4000.0, "Compra concluída"),
        (r1, 9, 4, 30.0, "Compra concluída"),
        (r1, 11, 2, 15.0, "Compra concluída"),
        # Rodada 2
        (r2, 1, 2, 120.0, "Compra concluída"),
        (r2, 2, 3, 25.0, "Compra concluída"),
        (r2, 3, 1, 30.0, "Compra concluída"),
        (r2, 5, 5, 50.0, "Compra concluída"),
        (r2, 6, 5, 5000.0, "Compra concluída"),
        (r2, 7, 5, 20.0, "Compra concluída"),
        (r2, 9, 4, 35.0, "Compra concluída"),
        (r2, 12, 1, 10.0, "Compra concluída"),
        # Rodada 3
        (r3, 1, 2, 150.0, "Compra concluída"),
        (r3, 2, 3, 30.0, "Compra concluída"),
        (r3, 3, 4, 40.0, "Compra concluída"),
        (r3, 4, 2, 20.0, "Compra concluída"),
        (r3, 5, 5, 60.0, "Compra concluída"),
        (r3, 6, 5, 6000.0, "Compra concluída"),
        (r3, 9, 4, 40.0, "Compra concluída"),
        (r3, 10, 4, 50.0, "Compra concluída"),
        (r3, 11, 2, 20.0, "Compra concluída"),
        # Rodada 4 (Atual - em andamento)
        (r4, 1, 1, 96.0, "Menor preço unitário"),
        (r4, 1, 4, 48.0, "Divisão para atingir mínimo"),
        (r4, 2, 2, 24.0, "Melhor cotação"),
        (r4, 3, 4, 35.0, "Melhor cotação"),
        (r4, 5, 5, 55.0, "Embalagem mais econômica"),
        (r4, 6, 3, 5000.0, "Caixa fechada"),
        (r4, 9, 4, 45.0, "Menor preço"),
        (r4, 11, 2, 18.0, "Melhor oferta"),
        (r4, 12, 1, 12.0, "Melhor custo por rolo"),
    ]
    cursor.executemany(
        """
        INSERT INTO alocacoes (
            id_rodada, id_produto, id_fornecedor, quantidade, observacao
        ) VALUES (?, ?, ?, ?, ?)
        """,
        alocacoes_seed,
    )

    salvar_configuracao_db(conn, "sistema_inicializado", "1")
    conn.commit()

    return {"sucesso": True, "tipo": "demo_completo"}


def seed_data(conn: sqlite3.Connection) -> None:
    """Função legada para compatibilidade de testes."""
    popular_banco_demo_completo_db(conn)


def obter_configuracoes_db(conn: sqlite3.Connection) -> Dict[str, str]:
    """Retorna todas as configurações como um dicionário chave-valor."""
    cursor = conn.cursor()
    cursor.execute("SELECT chave, valor FROM configuracoes")
    resultado = {}
    for row in cursor.fetchall():
        resultado[row["chave"]] = row["valor"]
    return resultado


def salvar_configuracao_db(conn: sqlite3.Connection, chave: str, valor: str) -> None:
    """Insere ou atualiza uma chave de configuração."""
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
        (chave, valor),
    )
    conn.commit()


def salvar_todas_configuracoes_db(conn: sqlite3.Connection, configs: Dict[str, str]) -> Dict[str, str]:
    """Salva múltiplas configurações de uma vez e retorna o estado atualizado."""
    for chave, valor in configs.items():
        salvar_configuracao_db(conn, chave, str(valor))
    return obter_configuracoes_db(conn)


def formatar_banco_dados_db(conn: sqlite3.Connection, com_seed: bool = False) -> bool:
    """
    Remove todos os dados do banco recriando as tabelas limpas.
    Se com_seed=True, popula com o modelo demo completo de teste.
    """
    cursor = conn.cursor()
    cursor.executescript(
        """
        DROP TABLE IF EXISTS alocacoes;
        DROP TABLE IF EXISTS cotacoes;
        DROP TABLE IF EXISTS necessidades;
        DROP TABLE IF EXISTS rodadas;
        DROP TABLE IF EXISTS fornecedores;
        DROP TABLE IF EXISTS produtos;
        DROP TABLE IF EXISTS configuracoes;
        """
    )
    conn.commit()
    create_schema(conn)
    seed_configuracoes(conn)

    if com_seed:
        popular_banco_demo_completo_db(conn)
    else:
        inicializar_banco_em_branco_db(conn)

    return True


def obter_estatisticas_produto_db(conn: sqlite3.Connection, id_produto: int) -> Dict[str, Any]:
    """Calcula estatísticas agregadas e histórico completo de cotações de um produto."""
    cursor = conn.cursor()

    # Informações do produto
    cursor.execute("SELECT * FROM produtos WHERE id = ?", (id_produto,))
    prod_row = cursor.fetchone()
    if not prod_row:
        raise ValueError(f"Produto #{id_produto} não encontrado.")

    produto = dict(prod_row)

    # Histórico de todas as cotações já registradas
    cursor.execute(
        """
        SELECT 
            c.id,
            c.id_rodada,
            r.descricao AS rodada_descricao,
            r.data_criacao AS rodada_data,
            c.id_fornecedor,
            f.nome AS fornecedor_nome,
            c.marca,
            c.embalagem,
            c.qtd_por_embalagem,
            c.unidade,
            c.preco_embalagem,
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
        FROM cotacoes c
        JOIN rodadas r ON r.id = c.id_rodada
        JOIN fornecedores f ON f.id = c.id_fornecedor
        WHERE c.id_produto = ?
        ORDER BY r.data_criacao DESC, preco_unitario ASC
        """,
        (id_produto,),
    )
    cotacoes = [dict(r) for r in cursor.fetchall()]

    if not cotacoes:
        return {
            "produto": produto,
            "total_cotacoes": 0,
            "total_rodadas": 0,
            "menor_preco": 0.0,
            "melhor_fornecedor": None,
            "maior_preco": 0.0,
            "preco_medio": 0.0,
            "variacao_percentual": 0.0,
            "cotacoes_historico": [],
            "ranking_fornecedores": [],
        }

    precos_unitarios = [c["preco_unitario"] for c in cotacoes]
    menor_preco = min(precos_unitarios)
    maior_preco = max(precos_unitarios)
    preco_medio = sum(precos_unitarios) / len(precos_unitarios)

    # Melhor fornecedor histórico (o que ofereceu o menor preço)
    melhor_cotacao = min(cotacoes, key=lambda c: c["preco_unitario"])
    melhor_fornecedor = melhor_cotacao["fornecedor_nome"]

    # Variação histórica entre a primeira e a última cotação
    cotacoes_cronologicas = sorted(cotacoes, key=lambda c: c["rodada_data"])
    primeiro_preco = cotacoes_cronologicas[0]["preco_unitario"]
    ultimo_preco = cotacoes_cronologicas[-1]["preco_unitario"]
    variacao_pct = (
        ((ultimo_preco - primeiro_preco) / primeiro_preco) * 100
        if primeiro_preco > 0
        else 0.0
    )

    # Ranking de Fornecedores mais frequentes/competitivos para este produto
    fornecedores_map: Dict[int, dict] = {}
    for c in cotacoes:
        f_id = c["id_fornecedor"]
        if f_id not in fornecedores_map:
            fornecedores_map[f_id] = {
                "id_fornecedor": f_id,
                "fornecedor_nome": c["fornecedor_nome"],
                "total_ofertas": 0,
                "menor_preco_oferecido": c["preco_unitario"],
                "preco_medio_oferecido": 0.0,
                "soma_precos": 0.0,
            }

        dados = fornecedores_map[f_id]
        dados["total_ofertas"] += 1
        dados["soma_precos"] += c["preco_unitario"]
        if c["preco_unitario"] < dados["menor_preco_oferecido"]:
            dados["menor_preco_oferecido"] = c["preco_unitario"]

    ranking_fornecedores = []
    for dados in fornecedores_map.values():
        dados["preco_medio_oferecido"] = dados["soma_precos"] / dados["total_ofertas"]
        ranking_fornecedores.append(dados)

    ranking_fornecedores.sort(key=lambda x: x["menor_preco_oferecido"])

    total_rodadas = len(set(c["id_rodada"] for c in cotacoes))

    return {
        "produto": produto,
        "total_cotacoes": len(cotacoes),
        "total_rodadas": total_rodadas,
        "menor_preco": menor_preco,
        "melhor_fornecedor": melhor_fornecedor,
        "maior_preco": maior_preco,
        "preco_medio": preco_medio,
        "variacao_percentual": variacao_pct,
        "cotacoes_historico": cotacoes,
        "ranking_fornecedores": ranking_fornecedores,
    }


def obter_estatisticas_fornecedor_db(conn: sqlite3.Connection, id_fornecedor: int) -> Dict[str, Any]:
    """Calcula indicadores de volume, histórico de ofertas e taxa de competitividade de um fornecedor."""
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM fornecedores WHERE id = ?", (id_fornecedor,))
    forn_row = cursor.fetchone()
    if not forn_row:
        raise ValueError(f"Fornecedor #{id_fornecedor} não encontrado.")

    fornecedor = dict(forn_row)

    # Cotações do fornecedor
    cursor.execute(
        """
        SELECT 
            c.id,
            c.id_rodada,
            r.descricao AS rodada_descricao,
            r.data_criacao AS rodada_data,
            c.id_produto,
            p.nome AS produto_nome,
            p.categoria AS produto_categoria,
            c.marca,
            c.embalagem,
            c.qtd_por_embalagem,
            c.unidade,
            c.preco_embalagem,
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
        FROM cotacoes c
        JOIN rodadas r ON r.id = c.id_rodada
        JOIN produtos p ON p.id = c.id_produto
        WHERE c.id_fornecedor = ?
        ORDER BY r.data_criacao DESC, p.nome ASC
        """,
        (id_fornecedor,),
    )
    cotacoes = [dict(r) for r in cursor.fetchall()]

    # Alocações (compras reais) feitas para este fornecedor
    cursor.execute(
        """
        SELECT 
            a.id,
            a.id_rodada,
            r.descricao AS rodada_descricao,
            r.data_criacao AS rodada_data,
            a.id_produto,
            p.nome AS produto_nome,
            a.quantidade,
            c.marca,
            c.embalagem,
            c.qtd_por_embalagem,
            c.unidade,
            c.preco_embalagem,
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
        FROM alocacoes a
        JOIN rodadas r ON r.id = a.id_rodada
        JOIN produtos p ON p.id = a.id_produto
        LEFT JOIN cotacoes c ON (
            c.id_rodada = a.id_rodada 
            AND c.id_fornecedor = a.id_fornecedor 
            AND c.id_produto = a.id_produto
        )
        WHERE a.id_fornecedor = ?
        ORDER BY r.data_criacao DESC, p.nome ASC
        """,
        (id_fornecedor,),
    )
    alocacoes = [dict(r) for r in cursor.fetchall()]

    # Total financeiro comprado com arredondamento em embalagens fechadas
    total_volume_financeiro = 0.0
    for aloc in alocacoes:
        qtd_alocada = aloc["quantidade"]
        fator = aloc["qtd_por_embalagem"] if aloc.get("qtd_por_embalagem") and aloc["qtd_por_embalagem"] > 0 else 1.0
        preco_emb = aloc["preco_embalagem"] if aloc.get("preco_embalagem") and aloc["preco_embalagem"] > 0 else 0.0
        emb_comprar = max(1, int(round((qtd_alocada / fator) + 0.4999)))
        total_volume_financeiro += emb_comprar * preco_emb

    # Quantas vezes este fornecedor teve o menor preço (1º lugar) nas rodadas em que participou
    primeiros_lugares = 0
    for cot in cotacoes:
        cursor.execute(
            """
            SELECT MIN(preco_embalagem / qtd_por_embalagem) as menor_preco
            FROM cotacoes
            WHERE id_rodada = ? AND id_produto = ?
            """,
            (cot["id_rodada"], cot["id_produto"]),
        )
        menor_row = cursor.fetchone()
        if menor_row and menor_row["menor_preco"] is not None:
            if abs(cot["preco_unitario"] - menor_row["menor_preco"]) < 0.0001:
                primeiros_lugares += 1

    taxa_vitoria = (primeiros_lugares / len(cotacoes) * 100) if cotacoes else 0.0

    return {
        "fornecedor": fornecedor,
        "total_cotacoes": len(cotacoes),
        "total_alocacoes": len(alocacoes),
        "volume_financeiro_alocado": total_volume_financeiro,
        "primeiros_lugares_count": primeiros_lugares,
        "taxa_competitividade_pct": taxa_vitoria,
        "cotacoes_historico": cotacoes,
        "alocacoes_historico": alocacoes,
    }


def obter_historico_global_cotacoes_db(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Retorna todas as cotações de todas as rodadas com joins completos e status de compra alocada."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT 
            c.id,
            c.id_rodada,
            r.descricao AS rodada_descricao,
            r.data_criacao AS rodada_data,
            c.id_fornecedor,
            f.nome AS fornecedor_nome,
            c.id_produto,
            p.nome AS produto_nome,
            p.categoria AS produto_categoria,
            c.marca,
            c.embalagem,
            c.qtd_por_embalagem,
            c.unidade,
            c.preco_embalagem,
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario,
            EXISTS(
                SELECT 1 FROM alocacoes a 
                WHERE a.id_rodada = c.id_rodada 
                  AND a.id_produto = c.id_produto 
                  AND a.id_fornecedor = c.id_fornecedor
            ) AS foi_alocado
        FROM cotacoes c
        JOIN rodadas r ON r.id = c.id_rodada
        JOIN fornecedores f ON f.id = c.id_fornecedor
        JOIN produtos p ON p.id = c.id_produto
        ORDER BY r.data_criacao DESC, p.nome ASC, preco_unitario ASC
        LIMIT 2000
        """
    )
    return [dict(r) for r in cursor.fetchall()]


def listar_rodadas_com_metricas_db(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Retorna todas as rodadas com contagens de necessidades, cotações, alocações e total financeiro alocado."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT 
            r.id,
            r.descricao,
            r.status,
            r.data_criacao,
            (SELECT COUNT(*) FROM necessidades n WHERE n.id_rodada = r.id) AS total_necessidades,
            (SELECT COUNT(*) FROM cotacoes c WHERE c.id_rodada = r.id) AS total_cotacoes,
            (SELECT COUNT(*) FROM alocacoes a WHERE a.id_rodada = r.id) AS total_alocacoes,
            (
                SELECT COALESCE(SUM(
                    MAX(1, CAST(ROUND((a.quantidade / CASE WHEN c.qtd_por_embalagem IS NULL OR c.qtd_por_embalagem <= 0 THEN 1.0 ELSE c.qtd_por_embalagem END) + 0.4999) AS INT)) 
                    * CASE WHEN c.preco_embalagem IS NULL THEN 0.0 ELSE c.preco_embalagem END
                ), 0.0)
                FROM alocacoes a
                LEFT JOIN cotacoes c ON (
                    c.id_rodada = a.id_rodada 
                    AND c.id_fornecedor = a.id_fornecedor 
                    AND c.id_produto = a.id_produto
                )
                WHERE a.id_rodada = r.id
            ) AS valor_total_alocado
        FROM rodadas r
        ORDER BY r.id DESC
        """
    )
    return [dict(row) for row in cursor.fetchall()]


def atualizar_rodada_db(
    conn: sqlite3.Connection, id_rodada: int, descricao: str, status: str
) -> Dict[str, Any]:
    """Atualiza a descrição e o status ('aberta', 'fechada' ou 'cancelada') de uma rodada."""
    descricao = descricao.strip()
    if not descricao:
        raise ValueError("A descrição da rodada não pode ser vazia.")
    if status not in ("aberta", "fechada", "cancelada"):
        raise ValueError("O status da rodada deve ser 'aberta', 'fechada' ou 'cancelada'.")

    cursor = conn.cursor()
    cursor.execute(
        "UPDATE rodadas SET descricao = ?, status = ? WHERE id = ?",
        (descricao, status, id_rodada),
    )
    conn.commit()

    cursor.execute(
        "SELECT id, descricao, status, data_criacao FROM rodadas WHERE id = ?",
        (id_rodada,),
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Rodada #{id_rodada} não encontrada.")
    return dict(row)


def verificar_historico_rodada_db(conn: sqlite3.Connection, id_rodada: int) -> Dict[str, int]:
    """Retorna a contagem de cotações, alocações e necessidades vinculadas a uma rodada."""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM necessidades WHERE id_rodada = ?", (id_rodada,))
    nec = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM cotacoes WHERE id_rodada = ?", (id_rodada,))
    cot = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM alocacoes WHERE id_rodada = ?", (id_rodada,))
    aloc = cursor.fetchone()[0]
    return {
        "necessidades": nec,
        "cotacoes": cot,
        "alocacoes": aloc,
        "total_historico": cot + aloc,
    }


def remover_rodada_db(conn: sqlite3.Connection, id_rodada: int) -> bool:
    """Remove uma rodada e seus vínculos de necessidades, cotações e alocações."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM alocacoes WHERE id_rodada = ?", (id_rodada,))
    cursor.execute("DELETE FROM cotacoes WHERE id_rodada = ?", (id_rodada,))
    cursor.execute("DELETE FROM necessidades WHERE id_rodada = ?", (id_rodada,))
    cursor.execute("DELETE FROM rodadas WHERE id = ?", (id_rodada,))
    conn.commit()
    return True


def duplicar_necessidades_rodada_db(
    conn: sqlite3.Connection, id_origem: int, id_destino: int
) -> int:
    """Copia todas as necessidades de uma rodada de origem para uma rodada de destino que ainda não as possua."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id_produto, quantidade FROM necessidades WHERE id_rodada = ?",
        (id_origem,),
    )
    itens_origem = cursor.fetchall()
    inseridos = 0
    for item in itens_origem:
        cursor.execute(
            "SELECT id FROM necessidades WHERE id_rodada = ? AND id_produto = ?",
            (id_destino, item["id_produto"]),
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO necessidades (id_rodada, id_produto, quantidade) VALUES (?, ?, ?)",
                (id_destino, item["id_produto"], item["quantidade"]),
            )
            inseridos += 1
    conn.commit()
    return inseridos


def atualizar_produto_db(
    conn: sqlite3.Connection,
    id_produto: int,
    nome: str,
    categoria: Optional[str] = None,
) -> Dict[str, Any]:
    """Atualiza os dados de um produto existente, validando campos obrigatórios e unicidade do nome."""
    nome = nome.strip()
    if not nome:
        raise ValueError("O nome do produto não pode ser vazio.")

    categoria = categoria.strip() if categoria and categoria.strip() else None

    cursor = conn.cursor()

    # Verifica se o produto existe
    cursor.execute("SELECT id FROM produtos WHERE id = ?", (id_produto,))
    if not cursor.fetchone():
        raise ValueError(f"Produto #{id_produto} não encontrado.")

    # Verifica unicidade de nome para outros produtos
    cursor.execute(
        "SELECT id FROM produtos WHERE LOWER(nome) = LOWER(?) AND id != ?",
        (nome, id_produto),
    )
    if cursor.fetchone():
        raise ValueError(f"Já existe outro produto cadastrado com o nome '{nome}'.")

    cursor.execute(
        """
        UPDATE produtos
        SET nome = ?, categoria = ?
        WHERE id = ?
        """,
        (nome, categoria, id_produto),
    )
    conn.commit()

    cursor.execute(
        "SELECT id, nome, categoria, ativo FROM produtos WHERE id = ?",
        (id_produto,),
    )
    return dict(cursor.fetchone())


def atualizar_fornecedor_db(
    conn: sqlite3.Connection,
    id_fornecedor: int,
    nome: str,
    contato: Optional[str] = None,
    telefone: Optional[str] = None,
    email: Optional[str] = None,
    pedido_minimo: float = 0.0,
) -> Dict[str, Any]:
    """Atualiza os dados de um fornecedor existente, validando campos obrigatórios e unicidade de razão social."""
    nome = nome.strip()
    if not nome:
        raise ValueError("O nome do fornecedor não pode ser vazio.")

    contato = contato.strip() if contato and contato.strip() else None
    telefone = telefone.strip() if telefone and telefone.strip() else None
    email = email.strip() if email and email.strip() else None
    pedido_minimo = max(0.0, float(pedido_minimo or 0.0))

    cursor = conn.cursor()

    # Verifica se o fornecedor existe
    cursor.execute("SELECT id FROM fornecedores WHERE id = ?", (id_fornecedor,))
    if not cursor.fetchone():
        raise ValueError(f"Fornecedor #{id_fornecedor} não encontrado.")

    # Verifica unicidade de nome para outros fornecedores
    cursor.execute(
        "SELECT id FROM fornecedores WHERE LOWER(nome) = LOWER(?) AND id != ?",
        (nome, id_fornecedor),
    )
    if cursor.fetchone():
        raise ValueError(f"Já existe outro fornecedor cadastrado com o nome '{nome}'.")

    cursor.execute(
        """
        UPDATE fornecedores
        SET nome = ?, contato = ?, telefone = ?, email = ?, pedido_minimo = ?
        WHERE id = ?
        """,
        (nome, contato, telefone, email, pedido_minimo, id_fornecedor),
    )
    conn.commit()

    cursor.execute(
        "SELECT id, nome, contato, telefone, email, pedido_minimo FROM fornecedores WHERE id = ?",
        (id_fornecedor,),
    )
    return dict(cursor.fetchone())


def verificar_historico_produto_db(conn: sqlite3.Connection, id_produto: int) -> Dict[str, int]:
    """Retorna a contagem de registros vinculados a um produto em necessidades, cotações e alocações."""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM necessidades WHERE id_produto = ?", (id_produto,))
    nec = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM cotacoes WHERE id_produto = ?", (id_produto,))
    cot = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM alocacoes WHERE id_produto = ?", (id_produto,))
    aloc = cursor.fetchone()[0]
    return {
        "necessidades": nec,
        "cotacoes": cot,
        "alocacoes": aloc,
        "total": nec + cot + aloc,
    }


def verificar_historico_fornecedor_db(conn: sqlite3.Connection, id_fornecedor: int) -> Dict[str, int]:
    """Retorna a contagem de registros vinculados a um fornecedor em cotações e alocações."""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM cotacoes WHERE id_fornecedor = ?", (id_fornecedor,))
    cot = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM alocacoes WHERE id_fornecedor = ?", (id_fornecedor,))
    aloc = cursor.fetchone()[0]
    return {
        "cotacoes": cot,
        "alocacoes": aloc,
        "total": cot + aloc,
    }


def alternar_status_produto_db(
    conn: sqlite3.Connection, id_produto: int, ativo: Optional[int] = None
) -> bool:
    """Alterna ou define explicitamente o status ativo (1 ou 0) de um produto."""
    cursor = conn.cursor()
    if ativo is None:
        cursor.execute(
            "UPDATE produtos SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (id_produto,),
        )
    else:
        cursor.execute(
            "UPDATE produtos SET ativo = ? WHERE id = ?",
            (1 if ativo else 0, id_produto),
        )
    conn.commit()
    return cursor.rowcount > 0


def alternar_status_fornecedor_db(
    conn: sqlite3.Connection, id_fornecedor: int, ativo: Optional[int] = None
) -> bool:
    """Alterna ou define explicitamente o status ativo (1 ou 0) de um fornecedor."""
    cursor = conn.cursor()
    if ativo is None:
        cursor.execute(
            "UPDATE fornecedores SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (id_fornecedor,),
        )
    else:
        cursor.execute(
            "UPDATE fornecedores SET ativo = ? WHERE id = ?",
            (1 if ativo else 0, id_fornecedor),
        )
    conn.commit()
    return cursor.rowcount > 0



def reset_db(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Apaga o banco existente e recria o schema com o seed atualizado."""
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception as e:
            print(f"Aviso ao remover banco anterior: {e}")

    conn = get_connection(db_path)
    create_schema(conn)
    seed_data(conn)
    return conn


def init_db(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Inicializa o banco de dados: cria o schema e configurações básicas sem injetar dados fictícios automaticamente."""
    conn = get_connection(db_path)
    create_schema(conn)
    seed_configuracoes(conn)
    return conn


if __name__ == "__main__":
    conn = reset_db()
    cursor = conn.cursor()
    print("Banco de dados resetado e populado com sucesso!")
    print("\n--- Configurações cadastradas ---")
    for row in cursor.execute("SELECT * FROM configuracoes"):
        print(dict(row))
    print("\n--- Produtos cadastrados ---")
    for row in cursor.execute("SELECT * FROM produtos"):
        print(dict(row))
    conn.close()
