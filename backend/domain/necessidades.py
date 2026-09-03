import sqlite3
from typing import List, Dict, Any, Optional


def list_needs_db(conn: sqlite3.Connection, id_rodada: int) -> List[Dict[str, Any]]:
    """Lista todos os itens em falta da rodada."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT 
            n.id,
            n.id_rodada,
            n.id_produto,
            n.id_fornecedor_selecionado,
            p.nome AS produto_nome,
            p.categoria AS produto_categoria
        FROM necessidades n
        JOIN produtos p ON p.id = n.id_produto
        WHERE n.id_rodada = ?
        ORDER BY p.nome ASC
        """,
        (id_rodada,),
    )
    return [dict(row) for row in cursor.fetchall()]


def create_need_db(
    conn: sqlite3.Connection,
    id_rodada: int,
    id_produto: Optional[int] = None,
    produto_nome: Optional[str] = None,
) -> Dict[str, Any]:
    """Adiciona um produto à lista de necessidades da rodada com suporte a auto-cadastro."""
    from backend.domain.rodadas import verificar_rodada_aberta

    verificar_rodada_aberta(conn, id_rodada)
    cursor = conn.cursor()
    prod_id = id_produto
    produto_novo = False

    if prod_id:
        cursor.execute("SELECT id, nome FROM produtos WHERE id = ?", (prod_id,))
        prod_row = cursor.fetchone()
        if not prod_row:
            prod_id = None

    if not prod_id and produto_nome and produto_nome.strip():
        nome_limpo = produto_nome.strip()
        cursor.execute("SELECT id, nome FROM produtos WHERE LOWER(nome) = LOWER(?)", (nome_limpo,))
        prod_row = cursor.fetchone()
        if prod_row:
            prod_id = prod_row["id"]
        else:
            cursor.execute(
                "INSERT INTO produtos (nome, categoria, ativo) VALUES (?, NULL, 1)",
                (nome_limpo,),
            )
            prod_id = cursor.lastrowid
            produto_novo = True

    if not prod_id:
        raise ValueError("Informe um produto existente ou o nome do produto para cadastro automático.")

    cursor.execute(
        """
        INSERT INTO necessidades (id_rodada, id_produto)
        VALUES (?, ?)
        ON CONFLICT(id_rodada, id_produto) DO NOTHING
        """,
        (id_rodada, prod_id),
    )
    conn.commit()

    cursor.execute(
        """
        SELECT n.id, n.id_rodada, n.id_produto, n.id_fornecedor_selecionado, p.nome AS produto_nome, p.categoria AS produto_categoria
        FROM necessidades n
        JOIN produtos p ON p.id = n.id_produto
        WHERE n.id_rodada = ? AND n.id_produto = ?
        """,
        (id_rodada, prod_id),
    )
    res = dict(cursor.fetchone())
    res["produto_novo"] = produto_novo
    return res


def set_selected_supplier_db(
    conn: sqlite3.Connection,
    id_rodada: int,
    id_produto: int,
    id_fornecedor: Optional[int],
) -> Dict[str, Any]:
    """
    Define o fornecedor pré-selecionado para um produto na rodada (decisão feita na Comparação).
    Sincroniza automaticamente a alocação existente caso já exista quantidade registrada.
    """
    from backend.domain.rodadas import verificar_rodada_aberta

    verificar_rodada_aberta(conn, id_rodada)
    cursor = conn.cursor()

    # Valida se o produto está nas necessidades da rodada
    cursor.execute(
        "SELECT id FROM necessidades WHERE id_rodada = ? AND id_produto = ?",
        (id_rodada, id_produto),
    )
    nec_row = cursor.fetchone()
    if not nec_row:
        raise ValueError(f"Produto #{id_produto} não consta nas necessidades da rodada #{id_rodada}.")

    # Se fornecedor informado, valida existência
    if id_fornecedor is not None and id_fornecedor > 0:
        cursor.execute("SELECT id, nome FROM fornecedores WHERE id = ?", (id_fornecedor,))
        forn_row = cursor.fetchone()
        if not forn_row:
            raise ValueError(f"Fornecedor #{id_fornecedor} não encontrado.")
        id_forn_val = id_fornecedor
    else:
        id_forn_val = None

    cursor.execute(
        """
        UPDATE necessidades
        SET id_fornecedor_selecionado = ?
        WHERE id_rodada = ? AND id_produto = ?
        """,
        (id_forn_val, id_rodada, id_produto),
    )

    # Se já existir exatamente 1 linha de alocação salva para o produto, sincroniza o id_fornecedor
    if id_forn_val is not None:
        cursor.execute(
            "SELECT id FROM alocacoes WHERE id_rodada = ? AND id_produto = ?",
            (id_rodada, id_produto),
        )
        aloc_rows = cursor.fetchall()
        if len(aloc_rows) == 1:
            cursor.execute(
                "UPDATE alocacoes SET id_fornecedor = ? WHERE id = ?",
                (id_forn_val, aloc_rows[0]["id"]),
            )

    conn.commit()
    return {
        "sucesso": True,
        "id_rodada": id_rodada,
        "id_produto": id_produto,
        "id_fornecedor_selecionado": id_forn_val,
    }


def reset_selected_suppliers_db(conn: sqlite3.Connection, id_rodada: int) -> Dict[str, Any]:
    """Restaura as decisões da rodada para o fornecedor padrão (menor preço natural)."""
    from backend.domain.rodadas import verificar_rodada_aberta

    verificar_rodada_aberta(conn, id_rodada)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE necessidades SET id_fornecedor_selecionado = NULL WHERE id_rodada = ?",
        (id_rodada,),
    )
    conn.commit()
    return {"sucesso": True, "id_rodada": id_rodada}


def remove_need_db(conn: sqlite3.Connection, id_necessidade: int) -> Dict[str, Any]:
    """Remove um item da lista de necessidades da rodada."""
    from backend.domain.rodadas import verificar_rodada_aberta

    cursor = conn.cursor()
    cursor.execute("SELECT id_rodada FROM necessidades WHERE id = ?", (id_necessidade,))
    row = cursor.fetchone()
    if row:
        verificar_rodada_aberta(conn, row["id_rodada"])

    cursor.execute("DELETE FROM necessidades WHERE id = ?", (id_necessidade,))
    conn.commit()
    return {"sucesso": True, "id": id_necessidade}


def duplicate_round_needs_db(
    conn: sqlite3.Connection, id_origem: int, id_destino: int
) -> int:
    """Copia os itens de necessidade de uma rodada para outra."""
    from backend.domain.rodadas import verificar_rodada_aberta

    verificar_rodada_aberta(conn, id_destino)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR IGNORE INTO necessidades (id_rodada, id_produto)
        SELECT ?, id_produto
        FROM necessidades
        WHERE id_rodada = ?
        """,
        (id_destino, id_origem),
    )
    conn.commit()
    return cursor.rowcount
