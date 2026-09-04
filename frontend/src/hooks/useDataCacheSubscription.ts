import { useEffect, useRef } from 'react'
import { apiCache } from '../services/api'

/**
 * Hook para se inscrever em uma ou mais tags do cache da API.
 * Quando qualquer uma das tags for invalidada por uma mutação em qualquer tela,
 * o callback informado é executado para sincronizar os dados em segundo plano.
 */
export function useDataCacheSubscription(
  tags: string | string[],
  onInvalidated: () => void,
  _deps?: any[],
) {
  const callbackRef = useRef(onInvalidated)
  callbackRef.current = onInvalidated

  const tagKey = Array.isArray(tags) ? tags.join(',') : tags

  useEffect(() => {
    const tagList = Array.isArray(tags) ? tags : [tags]
    const unsubscribes = tagList.map((tag) =>
      apiCache.subscribe(tag, () => {
        callbackRef.current()
      }),
    )

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [tagKey])
}
