import os
import sqlite3
from typing import Dict, Any, Optional

from backend.core.config import get_db_path, DEFAULT_DB_NAME
from backend.core.database import get_connection

DB_PATH = get_db_path()

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

    # Migração da coluna id_fornecedor_selecionado na tabela necessidades
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='necessidades'")
    if cursor.fetchone():
        cursor.execute("PRAGMA table_info(necessidades)")
        nec_cols = [row["name"] for row in cursor.fetchall()]
        if "id_fornecedor_selecionado" not in nec_cols:
            cursor.execute("ALTER TABLE necessidades ADD COLUMN id_fornecedor_selecionado INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL")
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
            id_fornecedor_selecionado INTEGER,
            FOREIGN KEY (id_rodada) REFERENCES rodadas (id) ON DELETE CASCADE,
            FOREIGN KEY (id_produto) REFERENCES produtos (id),
            FOREIGN KEY (id_fornecedor_selecionado) REFERENCES fornecedores (id) ON DELETE SET NULL,
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
            FOREIGN KEY (id_rodada) REFERENCES rodadas (id) ON DELETE CASCADE,
            FOREIGN KEY (id_produto) REFERENCES produtos (id),
            FOREIGN KEY (id_fornecedor) REFERENCES fornecedores (id)
        );

        -- Índices para otimização de performance (Evitar table scans em exclusões/verificações de histórico)
        CREATE INDEX IF NOT EXISTS idx_necessidades_produto ON necessidades(id_produto);
        CREATE INDEX IF NOT EXISTS idx_cotacoes_produto ON cotacoes(id_produto);
        CREATE INDEX IF NOT EXISTS idx_cotacoes_fornecedor ON cotacoes(id_fornecedor);
        CREATE INDEX IF NOT EXISTS idx_alocacoes_rodada ON alocacoes(id_rodada);
        CREATE INDEX IF NOT EXISTS idx_alocacoes_produto ON alocacoes(id_produto);
        CREATE INDEX IF NOT EXISTS idx_alocacoes_fornecedor ON alocacoes(id_fornecedor);
        """
    )
    conn.commit()

def check_db_status_db(conn: sqlite3.Connection, db_path: Optional[str] = None) -> Dict[str, Any]:
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

def initialize_empty_db_db(conn: sqlite3.Connection) -> Dict[str, Any]:
    """Marca o banco como inicializado em branco pronto para produção."""
    from backend.domain.configuracoes import save_db_setting
    save_db_setting(conn, "sistema_inicializado", "1")
    return {"sucesso": True, "tipo": "em_branco"}

def format_database_db(conn: sqlite3.Connection, com_seed: bool = False) -> bool:
    """
    Remove todos os dados do banco recriando as tabelas limpas.
    Se com_seed=True, popula com o modelo demo completo de teste.
    """
    import sys
    db_mod = sys.modules.get("db")
    from backend.domain.configuracoes import seed_settings
    from backend.services.demo_service import populate_demo_db_db

    create_schema_fn = getattr(db_mod, "create_schema", create_schema)
    seed_settings_fn = getattr(db_mod, "seed_settings", seed_settings)
    populate_demo_fn = getattr(db_mod, "populate_demo_db_db", populate_demo_db_db)

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
    create_schema_fn(conn)
    seed_settings_fn(conn)

    if com_seed:
        populate_demo_fn(conn)
    else:
        initialize_empty_db_db(conn)

    return True

def reset_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Apaga o banco existente e recria o schema com o seed atualizado."""
    import sys
    if db_path is None:
        db_path = get_db_path()

    db_mod = sys.modules.get("db")
    from backend.services.demo_service import seed_data
    get_conn_fn = getattr(db_mod, "get_connection", get_connection)
    create_schema_fn = getattr(db_mod, "create_schema", create_schema)
    seed_data_fn = getattr(db_mod, "seed_data", seed_data)

    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception as e:
            print(f"Aviso ao remover banco anterior: {e}")

    conn = get_conn_fn(db_path)
    create_schema_fn(conn)
    seed_data_fn(conn)
    return conn

def init_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Inicializa o banco de dados: cria o schema e configurações básicas sem injetar dados fictícios automaticamente."""
    import sys
    if db_path is None:
        db_path = get_db_path()

    db_mod = sys.modules.get("db")
    from backend.domain.configuracoes import seed_settings
    get_conn_fn = getattr(db_mod, "get_connection", get_connection)
    create_schema_fn = getattr(db_mod, "create_schema", create_schema)
    seed_settings_fn = getattr(db_mod, "seed_settings", seed_settings)

    conn = get_conn_fn(db_path)
    create_schema_fn(conn)
    seed_settings_fn(conn)
    return conn

