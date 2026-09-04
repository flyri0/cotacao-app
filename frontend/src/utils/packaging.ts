/**
 * Regras de arredondamento de embalagem comercial e cálculo de sobras/subtotal.
 */

export interface PackagingResult {
  fator: number
  precoEmbalagem: number
  embalagensComprar: number
  quantidadeEfetiva: number
  embComprar: number
  qtdEfetiva: number
  sobra: number
  subtotal: number
}

/**
 * Calcula a quantidade de embalagens fechadas necessárias para cobrir
 * a quantidade solicitada, a quantidade efetiva a ser comprada, a sobra e o subtotal financeiro.
 */
export function calculatePackaging(
  quantidadeSolicitada: number,
  qtdPorEmbalagem?: number | null,
  precoEmbalagem?: number | null
): PackagingResult {
  const qtd = Number(quantidadeSolicitada) || 0
  const fator = qtdPorEmbalagem && Number(qtdPorEmbalagem) > 0 ? Number(qtdPorEmbalagem) : 1.0
  const preco = precoEmbalagem && Number(precoEmbalagem) > 0 ? Number(precoEmbalagem) : 0.0

  if (qtd <= 0) {
    return {
      fator,
      precoEmbalagem: preco,
      embalagensComprar: 0,
      quantidadeEfetiva: 0,
      embComprar: 0,
      qtdEfetiva: 0,
      sobra: 0,
      subtotal: 0,
    }
  }

  const embComprar = Math.ceil(qtd / fator)
  const qtdEfetiva = embComprar * fator
  const sobra = Math.max(0, Number((qtdEfetiva - qtd).toFixed(4)))
  const subtotal = Number((embComprar * preco).toFixed(2))

  return {
    fator,
    precoEmbalagem: preco,
    embalagensComprar: embComprar,
    quantidadeEfetiva: qtdEfetiva,
    embComprar,
    qtdEfetiva,
    sobra,
    subtotal,
  }
}
