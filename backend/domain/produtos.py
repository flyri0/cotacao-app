import sqlite3
from typing import List, Dict, Any, Optional

def get_product_statistics_db(conn: sqlite3.Connection, id_produto: int) -> Dict[str, Any]:
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

def update_product_db(
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



def list_products_db(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Lista todos os produtos cadastrados ordenados por nome."""
    cursor = conn.cursor()
    cursor.execute("SELECT id, nome, categoria, ativo FROM produtos ORDER BY nome ASC")
    return [dict(row) for row in cursor.fetchall()]


def create_product_db(
    conn: sqlite3.Connection, nome: str, categoria: Optional[str] = None
) -> Dict[str, Any]:
    """Cadastra um novo produto."""
    nome = nome.strip()
    if not nome:
        raise ValueError("O nome do produto não pode ser vazio.")

    categoria = categoria.strip() if categoria else None
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO produtos (nome, categoria, ativo) VALUES (?, ?, 1)",
        (nome, categoria),
    )
    conn.commit()
    novo_id = cursor.lastrowid
    return {"id": novo_id, "nome": nome, "categoria": categoria, "ativo": 1}


def remove_product_db(conn: sqlite3.Connection, id_produto: int) -> Dict[str, Any]:
    """Remove um produto apenas se ele não possuir histórico."""
    cursor = conn.cursor()
    cursor.execute("SELECT nome FROM produtos WHERE id = ?", (id_produto,))
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Produto #{id_produto} não encontrado.")
    nome_prod = row["nome"]

    hist = verificar_historico_produto_db(conn, id_produto)
    if hist["total"] > 0:
        detalhes = []
        if hist["cotacoes"] > 0:
            detalhes.append(f"{hist['cotacoes']} cotação(ões)")
        if hist["alocacoes"] > 0:
            detalhes.append(f"{hist['alocacoes']} alocação(ões)")
        if hist["necessidades"] > 0:
            detalhes.append(f"{hist['necessidades']} lista(s) de necessidades")
        msg = f"Não é possível excluir '{nome_prod}': possui " + ", ".join(detalhes) + " vinculadas."
        raise ValueError(msg)

    cursor.execute("DELETE FROM produtos WHERE id = ?", (id_produto,))
    conn.commit()
    return {"sucesso": True, "mensagem": f"Produto '{nome_prod}' excluído com sucesso."}
