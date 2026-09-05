import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncManager } from '../services/syncService'
import { apiCache } from '../services/apiCache'
import type { PywebviewApi, SyncStatus } from '../types'

describe('syncService (SyncManager)', () => {
  let mockApi: Partial<PywebviewApi>

  beforeEach(() => {
    vi.useFakeTimers()
    apiCache.clear()
    syncManager.destroy()

    mockApi = {
      get_sync_status: vi.fn().mockResolvedValue({
        current_revision: 5,
        tags: [],
        reset: false,
      } as SyncStatus),
    }
    syncManager.setApiGetter(async () => mockApi as PywebviewApi)
  })

  afterEach(() => {
    syncManager.destroy()
    vi.useRealTimers()
  })

  it('deve inicializar e registrar timers e listeners corretamente', async () => {
    const clearSpy = vi.spyOn(apiCache, 'clear')
    syncManager.init()

    // Segunda chamada deve ser no-op
    syncManager.init()

    // Avança o timer inicial de 150ms
    await vi.advanceTimersByTimeAsync(200)
    expect(mockApi.get_sync_status).toHaveBeenCalledWith(0)

    // Avança timer de polling de 2500ms
    await vi.advanceTimersByTimeAsync(2500)
    expect(mockApi.get_sync_status).toHaveBeenCalledTimes(2)

    clearSpy.mockRestore()
  })

  it('deve reagir a eventos de foco e visibilidade', async () => {
    syncManager.init()

    // Simula evento focus na janela
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(50)
    expect(mockApi.get_sync_status).toHaveBeenCalled()

    // Simula visibilitychange
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(50)
    expect(mockApi.get_sync_status).toHaveBeenCalled()
  })

  it('deve invalidar cache ao receber status.reset = true do backend', async () => {
    const clearSpy = vi.spyOn(apiCache, 'clear')
    mockApi.get_sync_status = vi.fn().mockResolvedValue({
      current_revision: 10,
      tags: [],
      reset: true,
    })

    syncManager.init()
    await syncManager.checkSync()

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('deve invalidar tags específicas quando backend retornar revisão maior com tags', async () => {
    const invalidateSpy = vi.spyOn(apiCache, 'invalidateTags')
    mockApi.get_sync_status = vi.fn().mockResolvedValue({
      current_revision: 8,
      tags: ['products', 'needs'],
      reset: false,
    })

    syncManager.init()
    await syncManager.checkSync()

    expect(invalidateSpy).toHaveBeenCalledWith(['products', 'needs'])
    invalidateSpy.mockRestore()
  })

  it('deve notificar mutação local via BroadcastChannel e disparar checkSync com delay', async () => {
    syncManager.init()

    syncManager.notifyLocalMutation(['quotes'])
    expect(mockApi.get_sync_status).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    expect(mockApi.get_sync_status).toHaveBeenCalled()
  })

  it('deve processar mensagem de BroadcastChannel recebida de outra aba', async () => {
    const invalidateSpy = vi.spyOn(apiCache, 'invalidateTags')
    const clearSpy = vi.spyOn(apiCache, 'clear')

    syncManager.init()

    // Instancia um canal com o mesmo nome para simular outra aba
    const otherChannel = new BroadcastChannel('cotacao_sync_channel')

    // Mensagem com tags
    otherChannel.postMessage({
      type: 'MUTATION',
      tags: ['suppliers'],
      senderId: 'other-client-id',
      revision: 12,
    })

    expect(invalidateSpy).toHaveBeenCalledWith(['suppliers'])

    // Mensagem com ALL
    otherChannel.postMessage({
      type: 'MUTATION',
      tags: 'ALL',
      senderId: 'other-client-id',
    })
    expect(clearSpy).toHaveBeenCalled()

    otherChannel.close()
    invalidateSpy.mockRestore()
    clearSpy.mockRestore()
  })

  it('deve tratar exceções silenciosamente durante checkSync', async () => {
    mockApi.get_sync_status = vi.fn().mockRejectedValue(new Error('Falha de rede simulada'))
    syncManager.init()

    await expect(syncManager.checkSync()).resolves.not.toThrow()
  })
})
