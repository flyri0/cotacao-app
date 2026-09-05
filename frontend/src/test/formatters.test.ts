import { describe, it, expect } from 'vitest'
import { formatMoney, formatPercent, formatNumber } from '../utils/formatters'

describe('formatters', () => {
  describe('formatMoney', () => {
    it('deve formatar valores monetários em padrão BRL', () => {
      const res = formatMoney(1234.56)
      // Normaliza espaços não quebráveis (\u00A0 ou \u202F) comuns no Intl BRL
      const normalized = res.replace(/[\s\u00A0\u202F]/g, ' ')
      expect(normalized).toContain('R$')
      expect(normalized).toContain('1.234,56')
    })

    it('deve formatar valores nulos, indefinidos ou zero como R$ 0,00', () => {
      expect(formatMoney(0).replace(/[\s\u00A0\u202F]/g, ' ')).toContain('0,00')
      expect(formatMoney(null).replace(/[\s\u00A0\u202F]/g, ' ')).toContain('0,00')
      expect(formatMoney(undefined).replace(/[\s\u00A0\u202F]/g, ' ')).toContain('0,00')
    })

    it('deve respeitar maxDigits para preços unitários fracionados', () => {
      const formatted = formatMoney(0.0432, 4).replace(/[\s\u00A0\u202F]/g, ' ')
      expect(formatted).toContain('0,0432')
    })
  })

  describe('formatPercent', () => {
    it('deve formatar percentuais com casas decimais configuráveis', () => {
      expect(formatPercent(45.67)).toBe('45.7%')
      expect(formatPercent(45.67, 2)).toBe('45.67%')
      expect(formatPercent(100, 0)).toBe('100%')
    })

    it('deve tratar null e undefined como 0%', () => {
      expect(formatPercent(null)).toBe('0.0%')
      expect(formatPercent(undefined)).toBe('0.0%')
      expect(formatPercent(0)).toBe('0.0%')
    })
  })

  describe('formatNumber', () => {
    it('deve formatar números com separadores pt-BR', () => {
      const res = formatNumber(1000)
      expect(res).toBe('1.000')

      const resDec = formatNumber(1234.5, 2)
      expect(resDec).toBe('1.234,5')
    })

    it('deve tratar null e undefined como 0', () => {
      expect(formatNumber(null)).toBe('0')
      expect(formatNumber(undefined)).toBe('0')
      expect(formatNumber(0)).toBe('0')
    })
  })
})
