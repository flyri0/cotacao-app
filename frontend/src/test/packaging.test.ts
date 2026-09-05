import { describe, it, expect } from 'vitest'
import { calculatePackaging } from '../utils/packaging'

describe('calculatePackaging', () => {
  it('deve retornar zeros quando quantidadeSolicitada <= 0 ou inválida', () => {
    const zeroRes = calculatePackaging(0, 6, 12.5)
    expect(zeroRes.embalagensComprar).toBe(0)
    expect(zeroRes.quantidadeEfetiva).toBe(0)
    expect(zeroRes.embComprar).toBe(0)
    expect(zeroRes.qtdEfetiva).toBe(0)
    expect(zeroRes.sobra).toBe(0)
    expect(zeroRes.subtotal).toBe(0)
    expect(zeroRes.fator).toBe(6)
    expect(zeroRes.precoEmbalagem).toBe(12.5)

    const negRes = calculatePackaging(-10, 5, 20)
    expect(negRes.embalagensComprar).toBe(0)
    expect(negRes.subtotal).toBe(0)

    const nanRes = calculatePackaging(NaN, null, undefined)
    expect(nanRes.embalagensComprar).toBe(0)
    expect(nanRes.fator).toBe(1.0)
    expect(nanRes.precoEmbalagem).toBe(0.0)
  })

  it('deve usar fator padrão 1.0 quando qtdPorEmbalagem não for informado ou for <= 0', () => {
    const res1 = calculatePackaging(10, undefined, 5)
    expect(res1.fator).toBe(1.0)
    expect(res1.embalagensComprar).toBe(10)
    expect(res1.quantidadeEfetiva).toBe(10)
    expect(res1.sobra).toBe(0)
    expect(res1.subtotal).toBe(50)

    const res2 = calculatePackaging(10, 0, 5)
    expect(res2.fator).toBe(1.0)

    const res3 = calculatePackaging(10, -3, 5)
    expect(res3.fator).toBe(1.0)
  })

  it('deve usar precoEmbalagem padrão 0.0 quando precoEmbalagem for nulo ou <= 0', () => {
    const resNull = calculatePackaging(10, 5, null)
    expect(resNull.precoEmbalagem).toBe(0.0)
    expect(resNull.subtotal).toBe(0.0)

    const resNeg = calculatePackaging(10, 5, -15)
    expect(resNeg.precoEmbalagem).toBe(0.0)
    expect(resNeg.subtotal).toBe(0.0)
  })

  it('deve calcular corretamente quantidade exata de embalagens sem sobra', () => {
    // 12 unidades solicitadas, caixa de 6 por R$ 30,00 -> 2 caixas, 12 un, sobra 0, subtotal 60
    const res = calculatePackaging(12, 6, 30.0)
    expect(res.embalagensComprar).toBe(2)
    expect(res.quantidadeEfetiva).toBe(12)
    expect(res.sobra).toBe(0)
    expect(res.subtotal).toBe(60.0)
  })

  it('deve arredondar para cima e computar a sobra de embalagem', () => {
    // 7 unidades solicitadas, caixa de 6 por R$ 30,00 -> 2 caixas, 12 un, sobra 5, subtotal 60
    const res = calculatePackaging(7, 6, 30.0)
    expect(res.embalagensComprar).toBe(2)
    expect(res.quantidadeEfetiva).toBe(12)
    expect(res.sobra).toBe(5)
    expect(res.subtotal).toBe(60.0)
  })

  it('deve tratar cálculos fracionários e dízimas sem dízima espúria', () => {
    // 1.5 kg solicitados, embalagem de 0.5 kg por R$ 4.25
    const res = calculatePackaging(1.5, 0.5, 4.25)
    expect(res.embalagensComprar).toBe(3)
    expect(res.quantidadeEfetiva).toBe(1.5)
    expect(res.sobra).toBe(0)
    expect(res.subtotal).toBe(12.75)
  })
})
