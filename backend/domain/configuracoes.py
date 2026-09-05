import sqlite3
from typing import Dict


def seed_settings(conn: sqlite3.Connection) -> None:
    """Garante que as chaves de configuração básicas existam."""
    cursor = conn.cursor()
    configs_padrao = [
        ("app_nome", "Mapa de Cotações"),
        ("app_subtitulo", "Comparativo e Alocação Inteligente"),
        ("app_icone", "Scale"),
        ("app_theme_color", "blue"),
        ("app_color_scheme", "auto"),
        ("app_densidade", "compacto"),
        ("app_tamanho_fonte", "medio"),
        ("app_modo_execucao", "janela"),
        ("sistema_inicializado", "0"),
        ("backup_auto_ativo", "0"),
        ("backup_auto_diretorio", ""),
        ("backup_auto_gatilho", "abertura"),
        ("backup_auto_intervalo_horas", "4"),
        ("backup_auto_max_arquivos", "10"),
        ("backup_auto_ultimo_sucesso", ""),
        ("backup_auto_ultimo_status", ""),
        ("app_notificacao_posicao", "bottom-right"),
    ]
    for chave, valor in configs_padrao:
        cursor.execute(
            "INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)",
            (chave, valor),
        )
    conn.commit()


def get_db_settings(conn: sqlite3.Connection) -> Dict[str, str]:
    """Retorna todas as configurações como um dicionário chave-valor."""
    cursor = conn.cursor()
    cursor.execute("SELECT chave, valor FROM configuracoes")
    resultado = {}
    for row in cursor.fetchall():
        resultado[row["chave"]] = row["valor"]
    return resultado


def save_db_setting(conn: sqlite3.Connection, chave: str, valor: str) -> None:
    """Insere ou atualiza uma chave de configuração."""
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
        (chave, valor),
    )
    conn.commit()


def save_all_db_settings(conn: sqlite3.Connection, configs: Dict[str, str]) -> Dict[str, str]:
    """Salva múltiplas configurações de uma vez e retorna o estado atualizado."""
    for chave, valor in configs.items():
        save_db_setting(conn, chave, str(valor))
    return get_db_settings(conn)
