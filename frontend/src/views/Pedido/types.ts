import type { Fornecedor } from '../../types'

export interface ItemPedidoLinha {
  id_produto: number
  produto_nome: string
  marca?: string | null
  unidade: string
  quantidade_solicitada: number
  embalagem: string
  qtd_por_embalagem: number
  preco_embalagem: number
  preco_unitario: number
  embalagens_comprar: number
  quantidade_efetiva: number
  sobra: number
  subtotal: number
}

export interface PedidoPorFornecedor {
  fornecedor: Fornecedor
  itens: ItemPedidoLinha[]
  total_pedido: number
  status_minimo: 'ok' | 'abaixo' | 'sem_minimo'
  diferenca_minimo: number
  texto_formatado: string
}
