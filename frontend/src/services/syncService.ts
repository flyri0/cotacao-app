import { apiCache } from './apiCache'
import type { PywebviewApi, SyncStatus } from '../types'

/**
 * Gerenciador de Sincronização em Tempo Real Cross-Client.
 *
 * Garante que alterações feitas em uma janela/aba (desktop pywebview ou navegador web)
 * sejam refletidas instantaneamente (0ms) em outras abas via BroadcastChannel e
 * rapidamente (<2.5s ou ao focar) entre instâncias separadas via get_sync_status (<0.1ms em RAM).
 */
class SyncManager {
  private localRevision = 0
  private channel: BroadcastChannel | null = null
  private pollIntervalId: any = null
  private initialized = false
  private isChecking = false
  private clientId = Math.random().toString(36).substring(2, 9)
  private apiGetter: (() => Promise<PywebviewApi>) | null = null

  /**
   * Configura o getter da API para evitar dependência circular direta com api.ts.
   */
  setApiGetter(getter: () => Promise<PywebviewApi>): void {
    this.apiGetter = getter
  }

  /**
   * Inicializa os ouvintes de sincronização (BroadcastChannel, foco da janela e polling).
   */
  init(): void {
    if (this.initialized) return
    this.initialized = true

    // 1. Canal de comunicação cross-tab no mesmo navegador (0ms latência)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('cotacao_sync_channel')
        this.channel.onmessage = (event) => {
          const data = event.data
          if (!data || data.senderId === this.clientId) return

          if (data.tags === 'ALL') {
            apiCache.clear()
          } else if (Array.isArray(data.tags) && data.tags.length > 0) {
            apiCache.invalidateTags(data.tags)
          }

          if (typeof data.revision === 'number' && data.revision > this.localRevision) {
            this.localRevision = data.revision
          }
        }
      } catch (err) {
        console.warn('[SyncManager] BroadcastChannel indisponível, utilizando fallback por polling:', err)
      }
    }

    // 2. Sincronização imediata ao reativar a janela ou alternar de aba
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.checkSync()
      })

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.checkSync()
          }
        })
      }
    }

    // 3. Polling ultraleve de revisão em background (a cada 2.5s)
    this.pollIntervalId = setInterval(() => {
      this.checkSync()
    }, 2500)

    // Executa verificação inicial após curto intervalo
    setTimeout(() => {
      this.checkSync()
    }, 150)
  }

  /**
   * Disparado imediatamente após uma mutação local na janela atual.
   * Notifica outras abas locais via BroadcastChannel e sincroniza o contador de revisão.
   */
  notifyLocalMutation(tags: string[] | 'ALL'): void {
    // Notifica outras abas locais via BroadcastChannel instantaneamente
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: 'MUTATION',
          tags,
          senderId: this.clientId,
        })
      } catch (err) {
        console.warn('[SyncManager] Erro ao enviar mensagem no BroadcastChannel:', err)
      }
    }

    // Atualiza a revisão local em segundo plano com um pequeno delay após a mutação
    setTimeout(() => {
      this.checkSync()
    }, 80)
  }

  /**
   * Consulta a revisão atual do backend e invalida as tags alteradas por outros clientes.
   */
  async checkSync(): Promise<void> {
    if (this.isChecking || !this.apiGetter) return
    this.isChecking = true

    try {
      const api = await this.apiGetter()
      if (typeof api.get_sync_status !== 'function') return

      const status: SyncStatus = await api.get_sync_status(this.localRevision)
      if (!status) return

      if (status.reset) {
        this.localRevision = status.current_revision
        apiCache.clear()
      } else if (status.current_revision > this.localRevision) {
        this.localRevision = status.current_revision
        if (status.tags && status.tags.length > 0) {
          apiCache.invalidateTags(status.tags)
        }
      } else if (status.current_revision) {
        this.localRevision = status.current_revision
      }
    } catch {
      // Falhas silenciosas para evitar poluição no console se o backend estiver encerrando
    } finally {
      this.isChecking = false
    }
  }

  /**
   * Encerra ouvintes e timers caso necessário.
   */
  destroy(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId)
      this.pollIntervalId = null
    }
    if (this.channel) {
      this.channel.close()
      this.channel = null
    }
    this.initialized = false
  }
}

export const syncManager = new SyncManager()
