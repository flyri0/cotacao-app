export interface ResumoFornecedorRow {
  id_fornecedor: number
  fornecedor_nome: string
  pedido_minimo: number
  total_alocado: number
  diferenca: number
  percentual_atingido: number
  status: 'ok' | 'abaixo' | 'sem_compras'
  itens_comprados_count: number
  itens_detalhes: {
    produto_nome: string
    quantidade: number
    unidade: string
    embalagens: number
    embalagem_desc: string
    subtotal: number
  }[]
}
