import { useState, useRef, useEffect, useCallback } from 'react'

export type AutosaveStatus = 'salvo' | 'salvando' | 'erro'

interface UseAutosaveOptions<T> {
  data: T
  onSave: (data: T) => Promise<void>
  debounceMs?: number
  enabled?: boolean
}

/**
 * Hook para gerenciamento de autosave silencioso com debounce e feedback de status.
 */
export function useAutosave<T>({
  data,
  onSave,
  debounceMs = 600,
  enabled = true,
}: UseAutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('salvo')
  const initialLoadDone = useRef(false)
  const timerRef = useRef<number | null>(null)
  const dataRef = useRef<T>(data)
  dataRef.current = data

  const executeSave = useCallback(
    async (currentData: T) => {
      if (!enabled) return
      try {
        setStatus('salvando')
        await onSave(currentData)
        setStatus('salvo')
      } catch (err) {
        console.error('[Autosave] Erro ao salvar:', err)
        setStatus('erro')
      }
    },
    [onSave, enabled],
  )

  // Dispara o salvamento com debounce quando os dados mudam
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      return
    }

    if (!enabled) return

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      executeSave(dataRef.current)
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [data, debounceMs, enabled, executeSave])

  // Salva imediatamente ao desmontar
  useEffect(() => {
    return () => {
      if (initialLoadDone.current && enabled) {
        executeSave(dataRef.current)
      }
    }
  }, [enabled, executeSave])

  const saveImmediate = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    return executeSave(dataRef.current)
  }, [executeSave])

  return {
    status,
    setStatus,
    saveImmediate,
  }
}

export default useAutosave
