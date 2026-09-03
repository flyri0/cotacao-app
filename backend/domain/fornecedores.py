import sqlite3
from typing import List, Dict, Any, Optional

def get_supplier_statistics_db(conn: sqlite3.Connection, id_fornecedor: int) -> Dict[str, Any]:
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

def update_supplier_db(
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



def list_suppliers_db(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Lista todos os fornecedores cadastrados ordenados por nome."""
    cursor = conn.cursor()
    cursor.execute("SELECT id, nome, contato, telefone, email, pedido_minimo, ativo FROM fornecedores ORDER BY nome ASC")
    return [dict(row) for row in cursor.fetchall()]


def create_supplier_db(
    conn: sqlite3.Connection,
    nome: str,
    contato: Optional[str] = None,
    telefone: Optional[str] = None,
    email: Optional[str] = None,
    pedido_minimo: float = 0.0,
) -> Dict[str, Any]:
    """Cadastra um novo fornecedor com pedido mínimo."""
    nome = nome.strip()
    if not nome:
        raise ValueError("O nome do fornecedor não pode ser vazio.")

    contato = contato.strip() if contato else None
    telefone = telefone.strip() if telefone else None
    email = email.strip() if email else None
    pedido_minimo = max(0.0, float(pedido_minimo or 0.0))

    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO fornecedores (nome, contato, telefone, email, pedido_minimo, ativo)
        VALUES (?, ?, ?, ?, ?, 1)
        """,
        (nome, contato, telefone, email, pedido_minimo),
    )
    conn.commit()
    novo_id = cursor.lastrowid
    return {
        "id": novo_id,
        "nome": nome,
        "contato": contato,
        "telefone": telefone,
        "email": email,
        "pedido_minimo": pedido_minimo,
        "ativo": 1,
    }


def remove_supplier_db(conn: sqlite3.Connection, id_fornecedor: int) -> Dict[str, Any]:
    """Remove um fornecedor apenas se ele não possuir histórico."""
    cursor = conn.cursor()
    cursor.execute("SELECT nome FROM fornecedores WHERE id = ?", (id_fornecedor,))
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Fornecedor #{id_fornecedor} não encontrado.")
    nome_forn = row["nome"]

    hist = verificar_historico_fornecedor_db(conn, id_fornecedor)
    if hist["total"] > 0:
        detalhes = []
        if hist["cotacoes"] > 0:
            detalhes.append(f"{hist['cotacoes']} cotação(ões)")
        if hist["alocacoes"] > 0:
            detalhes.append(f"{hist['alocacoes']} compra(s)/alocação(ões)")
        msg = f"Não é possível excluir o fornecedor '{nome_forn}': possui " + " e ".join(detalhes) + " vinculadas."
        raise ValueError(msg)

    cursor.execute("DELETE FROM fornecedores WHERE id = ?", (id_fornecedor,))
    conn.commit()
    return {"sucesso": True, "mensagem": f"Fornecedor '{nome_forn}' excluído com sucesso."}
