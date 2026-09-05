import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDataCacheSubscription } from '../hooks/useDataCacheSubscription'
import { apiCache } from '../services/apiCache'

describe('useDataCacheSubscription', () => {
  it('deve disparar callback quando a tag única for invalidada', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useDataCacheSubscription('products', callback))

    apiCache.invalidateTags(['products'])
    expect(callback).toHaveBeenCalledTimes(1)

    unmount()
    apiCache.invalidateTags(['products'])
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('deve se inscrever em múltiplas tags quando passado um array', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() =>
      useDataCacheSubscription(['needs', 'quotes'], callback)
    )

    apiCache.invalidateTags(['needs'])
    expect(callback).toHaveBeenCalledTimes(1)

    apiCache.invalidateTags(['quotes'])
    expect(callback).toHaveBeenCalledTimes(2)

    apiCache.invalidateTags(['unrelated_tag'])
    expect(callback).toHaveBeenCalledTimes(2)

    unmount()
    apiCache.invalidateTags(['needs', 'quotes'])
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('deve utilizar sempre a referência mais recente do callback', () => {
    let count = 0
    const { rerender } = renderHook(
      ({ cb }) => useDataCacheSubscription('test_tag', cb),
      {
        initialProps: {
          cb: () => {
            count += 1
          },
        },
      }
    )

    apiCache.invalidateTags(['test_tag'])
    expect(count).toBe(1)

    rerender({
      cb: () => {
        count += 10
      },
    })

    apiCache.invalidateTags(['test_tag'])
    expect(count).toBe(11)
  })
})
