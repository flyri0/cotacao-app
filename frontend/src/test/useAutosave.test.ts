import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from '../hooks/useAutosave'

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('não deve disparar salvamento no primeiro carregamento', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAutosave({
        data: { valor: 10 },
        onSave,
      })
    )

    expect(result.current.status).toBe('salvo')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('deve disparar salvamento com debounce ao alterar os dados', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    let currentData = { valor: 10 }

    const { result, rerender } = renderHook(
      ({ d }) =>
        useAutosave({
          data: d,
          onSave,
          debounceMs: 500,
        }),
      { initialProps: { d: currentData } }
    )

    // Altera dados
    currentData = { valor: 20 }
    rerender({ d: currentData })

    // Antes do debounce expirar não deve ter salvado
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(onSave).not.toHaveBeenCalled()

    // Completa o tempo de debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(onSave).toHaveBeenCalledWith({ valor: 20 })
    expect(result.current.status).toBe('salvo')
  })

  it('deve atualizar status para "erro" se onSave rejeitar', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onSave = vi.fn().mockRejectedValue(new Error('Falha no banco'))
    let currentData = { valor: 1 }

    const { result, rerender } = renderHook(
      ({ d }) =>
        useAutosave({
          data: d,
          onSave,
          debounceMs: 100,
        }),
      { initialProps: { d: currentData } }
    )

    currentData = { valor: 2 }
    rerender({ d: currentData })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(result.current.status).toBe('erro')

    consoleSpy.mockRestore()
  })

  it('deve permitir salvamento imediato via saveImmediate cancelando timer pendente', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    let currentData = { valor: 50 }
    const { result, rerender } = renderHook(
      ({ d }) =>
        useAutosave({
          data: d,
          onSave,
          debounceMs: 500,
        }),
      { initialProps: { d: currentData } }
    )

    // Modifica os dados duas vezes rapidamente para cancelar o primeiro timer pendente
    currentData = { valor: 60 }
    rerender({ d: currentData })
    currentData = { valor: 70 }
    rerender({ d: currentData })

    // Dispara saveImmediate com o timer ainda pendente
    await act(async () => {
      await result.current.saveImmediate()
    })

    expect(onSave).toHaveBeenCalledWith({ valor: 70 })
  })

  it('não deve salvar quando enabled for false', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    let currentData = { valor: 1 }

    const { rerender } = renderHook(
      ({ d, enabled }) =>
        useAutosave({
          data: d,
          onSave,
          enabled,
          debounceMs: 100,
        }),
      { initialProps: { d: currentData, enabled: false } }
    )

    currentData = { valor: 2 }
    rerender({ d: currentData, enabled: false })

    await vi.advanceTimersByTimeAsync(200)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('deve salvar ao desmontar o componente se houver dados modificados', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    let currentData = { valor: 100 }

    const { rerender, unmount } = renderHook(
      ({ d }) =>
        useAutosave({
          data: d,
          onSave,
          debounceMs: 1000,
        }),
      { initialProps: { d: currentData } }
    )

    currentData = { valor: 200 }
    rerender({ d: currentData })

    unmount()
    expect(onSave).toHaveBeenCalledWith({ valor: 200 })
  })
})
