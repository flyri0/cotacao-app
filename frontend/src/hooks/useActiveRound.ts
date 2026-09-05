import { useState, useCallback, useMemo } from 'react'
import { getApi } from '../services/api'
import type { Rodada } from '../types'
import { useDataCacheSubscription } from './useDataCacheSubscription'

/**
 * Hook centralizado para gerenciar a seleção de rodadas e sincronização de estado
 * compartilhado entre telas dependentes de rodadas de cotação.
 */
export function useActiveRound(
  rodadaAtivaId?: number,
  onRodadaChange?: (id: number) => void,
) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaIdState] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [loadingRodadas, setLoadingRodadas] = useState(true)

  useDataCacheSubscription('rounds', () => {
    carregarRodadas(undefined, true)
  })

  const carregarRodadas = useCallback(
    async (forcarId?: number, silent = false): Promise<number | null> => {
      try {
        if (!silent) setLoadingRodadas(true)
        const api = await getApi()
        const lista = await api.list_rounds()
        setRodadas(lista)

        let idAlvo = forcarId || selectedRodadaId
        if (!idAlvo && lista.length > 0) {
          const aberta = lista.find((r) => r.status === 'aberta')
          idAlvo = aberta ? aberta.id : lista[0].id
          setSelectedRodadaIdState(idAlvo)
          onRodadaChange?.(idAlvo)
        }
        return idAlvo
      } finally {
        if (!silent) setLoadingRodadas(false)
      }
    },
    [selectedRodadaId, onRodadaChange],
  )

  const setSelectedRodadaId = useCallback(
    (id: number) => {
      setSelectedRodadaIdState(id)
      onRodadaChange?.(id)
    },
    [onRodadaChange],
  )

  const rodadaAtual = useMemo(
    () => rodadas.find((r) => r.id === selectedRodadaId),
    [rodadas, selectedRodadaId],
  )

  const isFechada = useMemo(
    () => rodadaAtual?.status === 'fechada' || rodadaAtual?.status === 'cancelada',
    [rodadaAtual],
  )

  return {
    rodadas,
    setRodadas,
    selectedRodadaId,
    setSelectedRodadaId,
    rodadaAtual,
    isFechada,
    loadingRodadas,
    carregarRodadas,
  }
}

export default useActiveRound
