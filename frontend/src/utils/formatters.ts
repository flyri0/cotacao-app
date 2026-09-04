/**
 * Funções utilitárias de formatação padronizadas para o aplicativo.
 */

/**
 * Formatação inteligente de valores monetários em Real (BRL).
 * Por padrão, utiliza no mínimo 2 casas (R$ 5,00) e permite até maxDigits (padrão 4)
 * para exibir com precisão preços unitários fracionados (ex: R$ 0,0432).
 */
export function formatMoney(valor: number | null | undefined, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

/**
 * Formata um valor numérico como percentual.
 */
export function formatPercent(valor: number | null | undefined, decimals = 1): string {
  return `${(valor || 0).toFixed(decimals)}%`
}

/**
 * Formata um número comum com separador de milhar pt-BR.
 */
export function formatNumber(valor: number | null | undefined, maxDecimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(valor || 0)
}
