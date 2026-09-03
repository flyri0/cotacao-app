import sqlite3
from datetime import datetime
from typing import List, Dict, Any

def list_rounds_with_metrics_db(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
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

def update_round_db(
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
        "total": cot + aloc,
        "total_historico": cot + aloc,
    }

def remove_round_db(conn: sqlite3.Connection, id_rodada: int) -> bool:
    """Remove uma rodada e seus vínculos de necessidades, cotações e alocações."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM alocacoes WHERE id_rodada = ?", (id_rodada,))
    cursor.execute("DELETE FROM cotacoes WHERE id_rodada = ?", (id_rodada,))
    cursor.execute("DELETE FROM necessidades WHERE id_rodada = ?", (id_rodada,))
    cursor.execute("DELETE FROM rodadas WHERE id = ?", (id_rodada,))
    conn.commit()
    return True

def duplicate_round_needs_db(
    conn: sqlite3.Connection, id_origem: int, id_destino: int
) -> int:
    """Copia todas as necessidades de uma rodada de origem para uma rodada de destino que ainda não as possua."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id_produto FROM necessidades WHERE id_rodada = ?",
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
                "INSERT INTO necessidades (id_rodada, id_produto) VALUES (?, ?)",
                (id_destino, item["id_produto"]),
            )
            inseridos += 1
    conn.commit()
    return inseridos



def verificar_rodada_aberta(conn: sqlite3.Connection, id_rodada: int) -> None:
    """Verifica se a rodada está aberta; se estiver fechada ou cancelada, lança ValueError."""
    cursor = conn.cursor()
    cursor.execute("SELECT status, descricao FROM rodadas WHERE id = ?", (id_rodada,))
    row = cursor.fetchone()
    if row:
        status = row["status"]
        if status in ("fechada", "cancelada"):
            raise ValueError(
                f"A rodada #{id_rodada} ('{row['descricao']}') está {status}. Modificações não são permitidas."
            )


def list_rounds_db(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    return list_rounds_with_metrics_db(conn)


def create_round_db(
    conn: sqlite3.Connection, descricao: str, duplicar_de_rodada_id: Any = None
) -> Dict[str, Any]:
    descricao = descricao.strip()
    if not descricao:
        raise ValueError("A descrição da rodada não pode ser vazia.")

    data_criacao = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO rodadas (descricao, status, data_criacao) VALUES (?, 'aberta', ?)",
        (descricao, data_criacao),
    )
    conn.commit()
    novo_id = cursor.lastrowid

    itens_duplicados = 0
    if duplicar_de_rodada_id:
        try:
            id_origem = int(duplicar_de_rodada_id)
            itens_duplicados = duplicate_round_needs_db(conn, id_origem, novo_id)
        except Exception as e:
            print(f"Aviso ao duplicar necessidades na criação da rodada: {e}")

    return {
        "id": novo_id,
        "descricao": descricao,
        "status": "aberta",
        "data_criacao": data_criacao,
        "itens_duplicados": itens_duplicados,
    }


def check_round_dependencies_db(conn: sqlite3.Connection, id_rodada: int) -> Dict[str, Any]:
    cursor = conn.cursor()
    cursor.execute("SELECT descricao FROM rodadas WHERE id = ?", (id_rodada,))
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Rodada #{id_rodada} não encontrada.")
    desc = row["descricao"]

    hist = verificar_historico_rodada_db(conn, id_rodada)
    return {
        "id": id_rodada,
        "descricao": desc,
        "total_necessidades": hist["necessidades"],
        "total_cotacoes": hist["cotacoes"],
        "total_alocacoes": hist["alocacoes"],
        "tem_vinculos": hist["total"] > 0,
    }
