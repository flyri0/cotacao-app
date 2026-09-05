import sqlite3
from typing import Any, Dict, List, Optional


def list_quotes_db(
    conn: sqlite3.Connection, id_rodada: int, id_fornecedor: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Lista cotações de uma rodada com preço unitário normalizado calculado."""
    cursor = conn.cursor()
    query = """
        SELECT 
            c.id,
            c.id_rodada,
            c.id_fornecedor,
            f.nome AS fornecedor_nome,
            f.pedido_minimo AS fornecedor_pedido_minimo,
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
        JOIN fornecedores f ON f.id = c.id_fornecedor
        JOIN produtos p ON p.id = c.id_produto
        WHERE c.id_rodada = ?
    """
    params: List[Any] = [id_rodada]

    if id_fornecedor:
        query += " AND c.id_fornecedor = ?"
        params.append(id_fornecedor)

    query += " ORDER BY p.nome ASC, (c.preco_embalagem / c.qtd_por_embalagem) ASC"
    cursor.execute(query, tuple(params))
    return [dict(row) for row in cursor.fetchall()]


def save_quote_db(
    conn: sqlite3.Connection,
    id_rodada: int,
    id_fornecedor: int,
    id_produto: Optional[int] = None,
    marca: Optional[str] = None,
    embalagem: str = "Unidade",
    qtd_por_embalagem: float = 1.0,
    unidade: str = "UN",
    preco_embalagem: float = 0.0,
    produto_nome: Optional[str] = None,
) -> Dict[str, Any]:
    """Salva ou atualiza uma cotação com normalização de preço e auto-cadastro de produto."""
    from backend.domain.rodadas import verificar_rodada_aberta

    verificar_rodada_aberta(conn, id_rodada)

    embalagem = embalagem.strip() if embalagem else ""
    if not embalagem:
        raise ValueError("A descrição da embalagem não pode ser vazia.")

    unidade = unidade.strip().upper() if unidade else ""
    if not unidade:
        raise ValueError("A unidade de medida não pode ser vazia.")

    if qtd_por_embalagem <= 0:
        raise ValueError("A quantidade por embalagem deve ser maior que zero.")

    if preco_embalagem < 0:
        raise ValueError("O preço da embalagem não pode ser negativo.")

    marca = marca.strip() if marca else None
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM fornecedores WHERE id = ?", (id_fornecedor,))
    if not cursor.fetchone():
        raise ValueError(f"Fornecedor #{id_fornecedor} não encontrado.")

    prod_id = id_produto
    if prod_id:
        cursor.execute("SELECT id FROM produtos WHERE id = ?", (prod_id,))
        if not cursor.fetchone():
            prod_id = None

    produto_novo = False
    if not prod_id and produto_nome and produto_nome.strip():
        nome_limpo = produto_nome.strip()
        cursor.execute("SELECT id FROM produtos WHERE LOWER(nome) = LOWER(?)", (nome_limpo,))
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

    # Garante inclusão nas necessidades da rodada
    cursor.execute(
        """
        INSERT INTO necessidades (id_rodada, id_produto)
        VALUES (?, ?)
        ON CONFLICT(id_rodada, id_produto) DO NOTHING
        """,
        (id_rodada, prod_id),
    )

    cursor.execute(
        """
        INSERT INTO cotacoes (
            id_rodada, id_fornecedor, id_produto,
            marca, embalagem, qtd_por_embalagem, unidade, preco_embalagem
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_rodada, id_fornecedor, id_produto) DO UPDATE SET
            marca = excluded.marca,
            embalagem = excluded.embalagem,
            qtd_por_embalagem = excluded.qtd_por_embalagem,
            unidade = excluded.unidade,
            preco_embalagem = excluded.preco_embalagem
        """,
        (
            id_rodada,
            id_fornecedor,
            prod_id,
            marca,
            embalagem,
            qtd_por_embalagem,
            unidade,
            preco_embalagem,
        ),
    )
    conn.commit()

    cursor.execute(
        """
        SELECT 
            c.id, c.id_rodada, c.id_fornecedor, f.nome AS fornecedor_nome,
            c.id_produto, p.nome AS produto_nome,
            c.marca, c.embalagem, c.qtd_por_embalagem, c.unidade, c.preco_embalagem,
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
        FROM cotacoes c
        JOIN fornecedores f ON f.id = c.id_fornecedor
        JOIN produtos p ON p.id = c.id_produto
        WHERE c.id_rodada = ? AND c.id_fornecedor = ? AND c.id_produto = ?
        """,
        (id_rodada, id_fornecedor, prod_id),
    )
    res = dict(cursor.fetchone())
    res["produto_novo"] = produto_novo
    return res


def update_quote_db(
    conn: sqlite3.Connection,
    id_cotacao: int,
    id_fornecedor: int,
    id_produto: Optional[int] = None,
    marca: Optional[str] = None,
    embalagem: str = "Unidade",
    qtd_por_embalagem: float = 1.0,
    unidade: str = "UN",
    preco_embalagem: float = 0.0,
    produto_nome: Optional[str] = None,
    produto_categoria: Optional[str] = None,
) -> Dict[str, Any]:
    """Atualiza uma cotação existente com normalização de preço e suporte a alteração de fornecedor/produto."""
    from backend.domain.rodadas import verificar_rodada_aberta

    cursor = conn.cursor()
    cursor.execute("SELECT id, id_rodada, id_produto, id_fornecedor FROM cotacoes WHERE id = ?", (id_cotacao,))
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Cotação #{id_cotacao} não encontrada.")

    id_rodada = row["id_rodada"]
    verificar_rodada_aberta(conn, id_rodada)

    embalagem = embalagem.strip() if embalagem else ""
    if not embalagem:
        raise ValueError("A descrição da embalagem não pode ser vazia.")

    unidade = unidade.strip().upper() if unidade else ""
    if not unidade:
        raise ValueError("A unidade de medida não pode ser vazia.")

    if qtd_por_embalagem <= 0:
        raise ValueError("A quantidade por embalagem deve ser maior que zero.")

    if preco_embalagem < 0:
        raise ValueError("O preço da embalagem não pode ser negativo.")

    marca = marca.strip() if marca else None

    # Validar fornecedor
    cursor.execute("SELECT id FROM fornecedores WHERE id = ?", (id_fornecedor,))
    if not cursor.fetchone():
        raise ValueError(f"Fornecedor #{id_fornecedor} não encontrado.")

    # Validar ou resolver produto
    prod_id = id_produto
    if prod_id:
        cursor.execute("SELECT id FROM produtos WHERE id = ?", (prod_id,))
        if not cursor.fetchone():
            prod_id = None

    produto_novo = False
    if not prod_id and produto_nome and produto_nome.strip():
        nome_limpo = produto_nome.strip()
        cursor.execute("SELECT id FROM produtos WHERE LOWER(nome) = LOWER(?)", (nome_limpo,))
        prod_row = cursor.fetchone()
        if prod_row:
            prod_id = prod_row["id"]
        else:
            cat = produto_categoria.strip() if (produto_categoria and produto_categoria.strip()) else None
            cursor.execute(
                "INSERT INTO produtos (nome, categoria, ativo) VALUES (?, ?, 1)",
                (nome_limpo, cat),
            )
            prod_id = cursor.lastrowid
            produto_novo = True

    if not prod_id:
        prod_id = row["id_produto"]

    # Se categoria foi passada e produto já existia, atualiza categoria se fornecida
    if produto_categoria is not None and prod_id and not produto_novo:
        cat = produto_categoria.strip() if produto_categoria.strip() else None
        cursor.execute("UPDATE produtos SET categoria = ? WHERE id = ?", (cat, prod_id))

    # Verifica se já existe OUTRA cotação com a mesma chave (id_rodada, id_fornecedor, prod_id)
    cursor.execute(
        "SELECT id FROM cotacoes WHERE id_rodada = ? AND id_fornecedor = ? AND id_produto = ? AND id != ?",
        (id_rodada, id_fornecedor, prod_id, id_cotacao),
    )
    if cursor.fetchone():
        raise ValueError("Já existe outra cotação registrada para este produto e fornecedor nesta rodada.")

    # Garante inclusão nas necessidades da rodada
    cursor.execute(
        """
        INSERT INTO necessidades (id_rodada, id_produto)
        VALUES (?, ?)
        ON CONFLICT(id_rodada, id_produto) DO NOTHING
        """,
        (id_rodada, prod_id),
    )

    cursor.execute(
        """
        UPDATE cotacoes SET
            id_fornecedor = ?,
            id_produto = ?,
            marca = ?,
            embalagem = ?,
            qtd_por_embalagem = ?,
            unidade = ?,
            preco_embalagem = ?
        WHERE id = ?
        """,
        (
            id_fornecedor,
            prod_id,
            marca,
            embalagem,
            qtd_por_embalagem,
            unidade,
            preco_embalagem,
            id_cotacao,
        ),
    )
    conn.commit()

    cursor.execute(
        """
        SELECT 
            c.id, c.id_rodada, c.id_fornecedor, f.nome AS fornecedor_nome,
            c.id_produto, p.nome AS produto_nome, p.categoria AS produto_categoria,
            c.marca, c.embalagem, c.qtd_por_embalagem, c.unidade, c.preco_embalagem,
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
        FROM cotacoes c
        JOIN fornecedores f ON f.id = c.id_fornecedor
        JOIN produtos p ON p.id = c.id_produto
        WHERE c.id = ?
        """,
        (id_cotacao,),
    )
    res = dict(cursor.fetchone())
    res["produto_novo"] = produto_novo
    return res


def remove_quote_db(conn: sqlite3.Connection, id_cotacao: int) -> Dict[str, Any]:
    """Remove uma cotação da rodada."""
    from backend.domain.rodadas import verificar_rodada_aberta

    cursor = conn.cursor()
    cursor.execute("SELECT id_rodada FROM cotacoes WHERE id = ?", (id_cotacao,))
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Cotação #{id_cotacao} não encontrada.")
    verificar_rodada_aberta(conn, row["id_rodada"])

    cursor.execute("DELETE FROM cotacoes WHERE id = ?", (id_cotacao,))
    conn.commit()
    return {"sucesso": True, "id": id_cotacao}


def get_quote_matrix_db(conn: sqlite3.Connection, id_rodada: int) -> Dict[str, Any]:
    """Constrói a matriz comparativa completa para a tela de Comparação."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT 
            n.id_produto,
            p.nome AS produto_nome,
            p.categoria AS produto_categoria
        FROM necessidades n
        JOIN produtos p ON p.id = n.id_produto
        WHERE n.id_rodada = ?
        ORDER BY p.nome ASC
        """,
        (id_rodada,),
    )
    produtos = [dict(row) for row in cursor.fetchall()]

    cursor.execute(
        """
        SELECT DISTINCT f.id, f.nome, f.pedido_minimo
        FROM fornecedores f
        JOIN cotacoes c ON c.id_fornecedor = f.id
        WHERE c.id_rodada = ?
        ORDER BY f.nome ASC
        """,
        (id_rodada,),
    )
    fornecedores = [dict(row) for row in cursor.fetchall()]

    cursor.execute(
        """
        SELECT 
            c.id,
            c.id_produto,
            c.id_fornecedor,
            c.marca,
            c.embalagem,
            c.qtd_por_embalagem,
            c.unidade,
            c.preco_embalagem,
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
        FROM cotacoes c
        WHERE c.id_rodada = ?
        """,
        (id_rodada,),
    )
    cotacoes_raw = [dict(row) for row in cursor.fetchall()]

    cotacoes_map: Dict[str, Dict[str, Any]] = {}
    for c in cotacoes_raw:
        chave = f"{c['id_produto']}_{c['id_fornecedor']}"
        cotacoes_map[chave] = c

    # Ranking de menores preços por produto
    menores_precos: Dict[int, Dict[str, Any]] = {}
    for prod in produtos:
        pid = prod["id_produto"]
        cotacoes_prod = [c for c in cotacoes_raw if c["id_produto"] == pid]
        if cotacoes_prod:
            ordenadas = sorted(cotacoes_prod, key=lambda x: x["preco_unitario"])
            vencedora = ordenadas[0]
            economia_vs_segundo = 0.0
            if len(ordenadas) > 1 and ordenadas[1]["preco_unitario"] > 0:
                p1 = vencedora["preco_unitario"]
                p2 = ordenadas[1]["preco_unitario"]
                economia_vs_segundo = ((p2 - p1) / p2) * 100.0

            menores_precos[pid] = {
                "id_fornecedor": vencedora["id_fornecedor"],
                "preco_unitario": vencedora["preco_unitario"],
                "marca": vencedora.get("marca"),
                "embalagem": vencedora["embalagem"],
                "unidade": vencedora["unidade"],
                "preco_embalagem": vencedora["preco_embalagem"],
                "economia_percentual": round(economia_vs_segundo, 1),
            }

    return {
        "produtos": produtos,
        "fornecedores": fornecedores,
        "cotacoes": cotacoes_map,
        "menores_precos": menores_precos,
    }


def get_global_quote_history_db(
    conn: sqlite3.Connection,
    limite: int = 500,
    categoria: Optional[str] = None,
    id_fornecedor: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Retorna o histórico unificado de cotações passadas de todas as rodadas."""
    cursor = conn.cursor()
    query = """
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
            (c.preco_embalagem / c.qtd_por_embalagem) AS preco_unitario
        FROM cotacoes c
        JOIN rodadas r ON r.id = c.id_rodada
        JOIN fornecedores f ON f.id = c.id_fornecedor
        JOIN produtos p ON p.id = c.id_produto
        WHERE 1=1
    """
    params: List[Any] = []

    if categoria and categoria.strip():
        query += " AND p.categoria = ?"
        params.append(categoria.strip())

    if id_fornecedor:
        query += " AND c.id_fornecedor = ?"
        params.append(id_fornecedor)

    query += " ORDER BY r.data_criacao DESC, p.nome ASC LIMIT ?"
    params.append(max(1, int(limite)))

    cursor.execute(query, tuple(params))
    return [dict(row) for row in cursor.fetchall()]


def get_global_quotes_history_db(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
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


def batch_remove_quotes_db(conn: sqlite3.Connection, ids_cotacoes: List[int]) -> Dict[str, Any]:
    """Remove múltiplas cotações em lote, garantindo que as rodadas estejam abertas."""
    from backend.domain.rodadas import verificar_rodada_aberta

    if not ids_cotacoes:
        return {"sucesso": True, "removidos": 0}

    cursor = conn.cursor()
    placeholders = ",".join("?" for _ in ids_cotacoes)

    cursor.execute(
        f"SELECT DISTINCT id_rodada FROM cotacoes WHERE id IN ({placeholders})",
        list(ids_cotacoes),
    )
    for row in cursor.fetchall():
        verificar_rodada_aberta(conn, row["id_rodada"])

    cursor.execute(
        f"DELETE FROM cotacoes WHERE id IN ({placeholders})",
        list(ids_cotacoes),
    )
    removidos = cursor.rowcount
    conn.commit()
    return {"sucesso": True, "removidos": removidos}


def batch_update_quotes_db(
    conn: sqlite3.Connection, ids_cotacoes: List[int], updates: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Atualiza informações em comum de múltiplas cotações em lote.
    Suporta: id_fornecedor, marca, embalagem, qtd_por_embalagem, unidade, preco_embalagem e percentual_reajuste.
    """
    from backend.domain.rodadas import verificar_rodada_aberta

    if not ids_cotacoes or not updates:
        return {"sucesso": True, "atualizados": 0, "ignorados": 0, "erros": []}

    cursor = conn.cursor()
    placeholders = ",".join("?" for _ in ids_cotacoes)

    cursor.execute(
        f"""
        SELECT id, id_rodada, id_fornecedor, id_produto, preco_embalagem, qtd_por_embalagem
        FROM cotacoes WHERE id IN ({placeholders})
        """,
        list(ids_cotacoes),
    )
    cotacoes_alvo = [dict(r) for r in cursor.fetchall()]

    rodadas_vistas = set()
    for c in cotacoes_alvo:
        if c["id_rodada"] not in rodadas_vistas:
            verificar_rodada_aberta(conn, c["id_rodada"])
            rodadas_vistas.add(c["id_rodada"])

    novo_fornecedor_id = updates.get("id_fornecedor")
    if novo_fornecedor_id is not None:
        cursor.execute("SELECT id FROM fornecedores WHERE id = ?", (novo_fornecedor_id,))
        if not cursor.fetchone():
            raise ValueError(f"Fornecedor #{novo_fornecedor_id} não encontrado.")

    atualizados = 0
    ignorados = 0
    erros: List[str] = []

    for c in cotacoes_alvo:
        cid = c["id"]
        rodada_id = c["id_rodada"]
        prod_id = c["id_produto"]
        target_forn = novo_fornecedor_id if novo_fornecedor_id is not None else c["id_fornecedor"]

        # Se for mudar de fornecedor, verifica unicidade na rodada
        if novo_fornecedor_id is not None and novo_fornecedor_id != c["id_fornecedor"]:
            cursor.execute(
                "SELECT id FROM cotacoes WHERE id_rodada = ? AND id_fornecedor = ? AND id_produto = ? AND id != ?",
                (rodada_id, target_forn, prod_id, cid),
            )
            if cursor.fetchone():
                ignorados += 1
                erros.append(f"Cotação #{cid}: produto já possui cotação no fornecedor destino.")
                continue

        # Monta campos para update
        campos_set = []
        valores = []

        if novo_fornecedor_id is not None:
            campos_set.append("id_fornecedor = ?")
            valores.append(target_forn)

        if "marca" in updates:
            marca_val = updates["marca"].strip() if (updates["marca"] and updates["marca"].strip()) else None
            campos_set.append("marca = ?")
            valores.append(marca_val)

        if "embalagem" in updates and updates["embalagem"]:
            emb_val = str(updates["embalagem"]).strip()
            if emb_val:
                campos_set.append("embalagem = ?")
                valores.append(emb_val)

        if "qtd_por_embalagem" in updates and updates["qtd_por_embalagem"] is not None:
            try:
                qtd_val = float(updates["qtd_por_embalagem"])
                if qtd_val > 0:
                    campos_set.append("qtd_por_embalagem = ?")
                    valores.append(qtd_val)
            except (ValueError, TypeError):
                pass

        if "unidade" in updates and updates["unidade"]:
            un_val = str(updates["unidade"]).strip().upper()
            if un_val:
                campos_set.append("unidade = ?")
                valores.append(un_val)

        if "preco_embalagem" in updates and updates["preco_embalagem"] is not None:
            try:
                p_val = float(updates["preco_embalagem"])
                if p_val >= 0:
                    campos_set.append("preco_embalagem = ?")
                    valores.append(p_val)
            except (ValueError, TypeError):
                pass
        elif "percentual_reajuste" in updates and updates["percentual_reajuste"] is not None:
            try:
                pct = float(updates["percentual_reajuste"])
                p_atual = float(c["preco_embalagem"])
                p_novo = max(0.0, round(p_atual * (1.0 + pct / 100.0), 2))
                campos_set.append("preco_embalagem = ?")
                valores.append(p_novo)
            except (ValueError, TypeError):
                pass

        if not campos_set:
            continue

        valores.append(cid)
        sql = f"UPDATE cotacoes SET {', '.join(campos_set)} WHERE id = ?"
        cursor.execute(sql, tuple(valores))
        atualizados += 1

    conn.commit()
    return {
        "sucesso": True,
        "atualizados": atualizados,
        "ignorados": ignorados,
        "erros": erros,
    }
