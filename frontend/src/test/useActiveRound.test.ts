import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useActiveRound } from '../hooks/useActiveRound'
import * as apiModule from '../services/api'
import type { Rodada, PywebviewApi } from '../types'

describe('useActiveRound', () => {
  const mockRodadas: Rodada[] = [
    {
      id: 1,
      descricao: 'Rodada 1 (Fechada)',
      data_criacao: '2026-01-01',
      status: 'fechada',
    },
    {
      id: 2,
      descricao: 'Rodada 2 (Aberta)',
      data_criacao: '2026-02-01',
      status: 'aberta',
    },
  ]

  let mockApi: Partial<PywebviewApi>

  beforeEach(() => {
    mockApi = {
      list_rounds: vi.fn().mockResolvedValue(mockRodadas),
    }
    vi.spyOn(apiModule, 'getApi').mockResolvedValue(mockApi as PywebviewApi)
  })

  it('deve carregar rodadas e selecionar automaticamente a rodada aberta quando nenhuma for informada', async () => {
    const onRodadaChange = vi.fn()
    const { result } = renderHook(() => useActiveRound(undefined, onRodadaChange))

    expect(result.current.loadingRodadas).toBe(true)

    await act(async () => {
      await result.current.carregarRodadas()
    })

    expect(result.current.loadingRodadas).toBe(false)
    expect(result.current.rodadas).toHaveLength(2)
    // Deve ter selecionado a aberta (id 2)
    expect(result.current.selectedRodadaId).toBe(2)
    expect(result.current.rodadaAtual?.id).toBe(2)
    expect(result.current.isFechada).toBe(false)
    expect(onRodadaChange).toHaveBeenCalledWith(2)
  })

  it('deve respeitar rodadaAtivaId fornecida e identificar status fechada', async () => {
    const { result } = renderHook(() => useActiveRound(1))

    await act(async () => {
      await result.current.carregarRodadas()
    })

    expect(result.current.selectedRodadaId).toBe(1)
    expect(result.current.rodadaAtual?.status).toBe('fechada')
    expect(result.current.isFechada).toBe(true)
  })

  it('deve permitir alterar rodada manualmente via setSelectedRodadaId', async () => {
    const onRodadaChange = vi.fn()
    const { result } = renderHook(() => useActiveRound(2, onRodadaChange))

    await act(async () => {
      await result.current.carregarRodadas()
    })

    act(() => {
      result.current.setSelectedRodadaId(1)
    })

    expect(result.current.selectedRodadaId).toBe(1)
    expect(result.current.isFechada).toBe(true)
    expect(onRodadaChange).toHaveBeenCalledWith(1)
  })

  it('deve suportar carregarRodadas em modo silent sem alterar loadingRodadas', async () => {
    const { result } = renderHook(() => useActiveRound(2))

    await act(async () => {
      await result.current.carregarRodadas(undefined, true)
    })

    expect(result.current.rodadas).toHaveLength(2)
  })

  it('deve recarregar rodadas quando a tag "rounds" for invalidada no cache', async () => {
    const { result } = renderHook(() => useActiveRound(2))

    await act(async () => {
      await result.current.carregarRodadas()
    })

    await act(async () => {
      apiModule.apiCache.invalidateTags(['rounds'])
    })

    expect(mockApi.list_rounds).toHaveBeenCalledTimes(2)
  })
})
