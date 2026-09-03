import sqlite3
from typing import List, Dict, Any


def list_allocations_db(conn: sqlite3.Connection, id_rodada: int) -> List[Dict[str, Any]]:
    """
    Lista todas as alocações da rodada ativa.
    Pode haver múltiplas linhas de alocação para o mesmo produto na mesma rodada.
    """
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT 
            a.id,
            a.id_rodada,
            a.id_produto,
            p.nome AS produto_nome,
            p.categoria AS produto_categoria,
            a.id_fornecedor,
            f.nome AS fornecedor_nome,
            f.pedido_minimo AS fornecedor_pedido_minimo,
            a.quantidade,
            c.marca,
            c.embalagem,
            c.qtd_por_embalagem,
            c.unidade,
            c.preco_embalagem,
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
        FROM alocacoes a
        JOIN produtos p ON p.id = a.id_produto
        JOIN fornecedores f ON f.id = a.id_fornecedor
        LEFT JOIN cotacoes c ON (
            c.id_rodada = a.id_rodada 
            AND c.id_fornecedor = a.id_fornecedor 
            AND c.id_produto = a.id_produto
        )
        WHERE a.id_rodada = ?
        ORDER BY p.nome ASC, a.id ASC
        """,
        (id_rodada,),
    )
    rows = [dict(row) for row in cursor.fetchall()]

    for row in rows:
        qtd_alocada = row["quantidade"]
        fator = row["qtd_por_embalagem"] if row.get("qtd_por_embalagem") and row["qtd_por_embalagem"] > 0 else 1.0
        preco_emb = row["preco_embalagem"] if row.get("preco_embalagem") and row["preco_embalagem"] > 0 else 0.0

        emb_comprar = max(1, int(round((qtd_alocada / fator) + 0.4999)))
        qtd_efetiva = emb_comprar * fator
        sobra = round(qtd_efetiva - qtd_alocada, 4)
        subtotal = round(emb_comprar * preco_emb, 2)

        row["embalagens_comprar"] = emb_comprar
        row["quantidade_efetiva"] = qtd_efetiva
        row["sobra"] = sobra
        row["subtotal"] = subtotal

    return rows


def save_allocations_db(
    conn: sqlite3.Connection, id_rodada: int, alocacoes: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Salva todas as alocações da rodada em lote, substituindo as anteriores de forma atômica."""
    from backend.domain.rodadas import verificar_rodada_aberta

    verificar_rodada_aberta(conn, id_rodada)

    fornecedores_validos = set()
    itens_inserir = []
    for item in alocacoes:
        try:
            id_p = int(item["id_produto"])
            id_f = int(item["id_fornecedor"])
            qtd = float(item["quantidade"])
        except (ValueError, TypeError, KeyError):
            raise ValueError(f"Dados inválidos no item de alocação: {item}")

        if qtd > 0:
            itens_inserir.append((id_rodada, id_p, id_f, qtd))
            fornecedores_validos.add(id_f)

    cursor = conn.cursor()
    cursor.execute("DELETE FROM alocacoes WHERE id_rodada = ?", (id_rodada,))
    if itens_inserir:
        cursor.executemany(
            """
            INSERT INTO alocacoes (id_rodada, id_produto, id_fornecedor, quantidade)
            VALUES (?, ?, ?, ?)
            """,
            itens_inserir,
        )
    conn.commit()

    return {
        "sucesso": True,
        "id_rodada": id_rodada,
        "total_alocacoes": len(itens_inserir),
        "total_fornecedores": len(fornecedores_validos),
    }


def remove_allocation_db(conn: sqlite3.Connection, id_alocacao: int) -> Dict[str, Any]:
    """Remove uma linha de alocação específica."""
    from backend.domain.rodadas import verificar_rodada_aberta

    cursor = conn.cursor()
    cursor.execute("SELECT id_rodada FROM alocacoes WHERE id = ?", (id_alocacao,))
    row = cursor.fetchone()
    if row:
        verificar_rodada_aberta(conn, row["id_rodada"])

    cursor.execute("DELETE FROM alocacoes WHERE id = ?", (id_alocacao,))
    conn.commit()
    return {"sucesso": True, "id": id_alocacao}
