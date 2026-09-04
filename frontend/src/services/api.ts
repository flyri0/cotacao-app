import type { PywebviewApi } from '../types'
import {
  apiCache,
  getCacheConfigForRead,
  getInvalidationTagsForMutation,
} from './apiCache'

export { apiCache }

let cachedApi: PywebviewApi | null = null
let heartbeatStarted = false

/**
 * Envolve a API nativa ou HTTP com uma camada transparente de Cache em RAM.
 * Leituras retornam em 0ms quando em cache.
 * Mutações invalidam automaticamente as tags afetadas.
 */
function createCachedApiProxy(targetApi: PywebviewApi): PywebviewApi {
  return new Proxy(targetApi, {
    get: (target, prop: string) => {
      const original = (target as any)[prop]
      if (typeof original !== 'function') {
        return original
      }

      return async (...args: any[]) => {
        // 1. Verifica se é método de leitura cacheável
        const cacheConfig = getCacheConfigForRead(prop, args)
        if (cacheConfig && apiCache.has(cacheConfig.key)) {
          return apiCache.get(cacheConfig.key)
        }

        // 2. Executa a chamada real na bridge/HTTP
        const result = await original.apply(target, args)

        // Se era leitura cacheável, armazena no cache
        if (cacheConfig) {
          apiCache.set(cacheConfig.key, result, cacheConfig.tags)
        }

        // 3. Se for mutação, invalida as tags correspondentes
        const tagsToInvalidate = getInvalidationTagsForMutation(prop, args)
        if (tagsToInvalidate === 'ALL') {
          apiCache.clear()
        } else if (Array.isArray(tagsToInvalidate) && tagsToInvalidate.length > 0) {
          apiCache.invalidateTags(tagsToInvalidate)
        }

        return result
      }
    },
  })
}

/**
 * Invalida manualmente tags do cache ou limpa todo o cache.
 */
export function invalidateApiCache(tag?: string): void {
  if (!tag) {
    apiCache.clear()
  } else {
    apiCache.invalidateTags([tag])
  }
}

/**
 * Inicia o heartbeat de conexão quando executando no navegador padrão.
 */
function iniciarHeartbeat() {
  if (heartbeatStarted) return
  heartbeatStarted = true

  const ping = async () => {
    try {
      await fetch('/api/ping', { method: 'POST' })
    } catch {
      // Ignora falhas temporárias de rede
    }
  }

  // Ping a cada 5 segundos
  setInterval(ping, 5000)
}

/**
 * Cria um Proxy universal para redirecionar chamadas da API para requisições HTTP REST
 * quando a aplicação estiver rodando no navegador padrão sem a janela pywebview.
 */
function createHttpApiProxy(): PywebviewApi {
  iniciarHeartbeat()

  return new Proxy({} as PywebviewApi, {
    get: (_, prop: string) => {
      // Métodos especiais ou propriedades nativas do JS
      if (prop === 'then' || prop === 'catch' || typeof prop === 'symbol') {
        return undefined
      }

      return async (...args: any[]) => {
        try {
          const res = await fetch(`/api/${prop}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ args }),
          })

          const data = await res.json()

          if (!res.ok) {
            throw new Error(
              data.erro || data.mensagem || `Erro na chamada do método ${prop} (HTTP ${res.status})`,
            )
          }

          // Se a resposta tiver um erro explícito retornado pelo Python
          if (data && typeof data === 'object' && data.sucesso === false && data.erro) {
            throw new Error(data.erro)
          }

          return data
        } catch (err: any) {
          console.error(`[API Proxy] Falha ao executar ${prop}:`, err)
          throw err
        }
      }
    },
  })
}

/**
 * Retorna a instância da API (pywebview bridge nativa ou HTTP Proxy para navegador)
 * encapsulada com a camada de cache em memória.
 */
export async function getApi(): Promise<PywebviewApi> {
  if (cachedApi) {
    return cachedApi
  }

  // 1. Se pywebview já estiver injetado no window
  if (window.pywebview?.api) {
    cachedApi = createCachedApiProxy(window.pywebview.api)
    return cachedApi
  }

  // 2. Aguarda até 350ms para verificar se o evento pywebviewready dispara (ambiente desktop)
  const pywebviewApi = await new Promise<PywebviewApi | null>((resolve) => {
    let timer: any = null

    const handleReady = () => {
      clearTimeout(timer)
      window.removeEventListener('pywebviewready', handleReady)
      if (window.pywebview?.api) {
        resolve(window.pywebview.api)
      } else {
        resolve(null)
      }
    }

    window.addEventListener('pywebviewready', handleReady)

    timer = setTimeout(() => {
      window.removeEventListener('pywebviewready', handleReady)
      if (window.pywebview?.api) {
        resolve(window.pywebview.api)
      } else {
        resolve(null)
      }
    }, 350)
  })

  if (pywebviewApi) {
    cachedApi = createCachedApiProxy(pywebviewApi)
    return cachedApi
  }

  // 3. Caso não seja pywebview, retorna o Proxy HTTP transparente para navegador padrão
  console.info('[Modo de Execução] Operando via Navegador Padrão com micro-servidor local.')
  cachedApi = createCachedApiProxy(createHttpApiProxy())
  return cachedApi
}

/**
 * Retorna se a aplicação está rodando em um navegador comum (fora do pywebview).
 */
export function isBrowserMode(): boolean {
  return !window.pywebview?.api
}
