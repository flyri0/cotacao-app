import type { PywebviewApi } from '../types'

let cachedApi: PywebviewApi | null = null
let heartbeatStarted = false

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
 * Retorna a instância da API (pywebview bridge nativa ou HTTP Proxy para navegador).
 */
export async function getApi(): Promise<PywebviewApi> {
  if (cachedApi) {
    return cachedApi
  }

  // 1. Se pywebview já estiver injetado no window
  if (window.pywebview?.api) {
    cachedApi = window.pywebview.api
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
    cachedApi = pywebviewApi
    return cachedApi
  }

  // 3. Caso não seja pywebview, retorna o Proxy HTTP transparente para navegador padrão
  console.info('[Modo de Execução] Operando via Navegador Padrão com micro-servidor local.')
  cachedApi = createHttpApiProxy()
  return cachedApi
}

/**
 * Retorna se a aplicação está rodando em um navegador comum (fora do pywebview).
 */
export function isBrowserMode(): boolean {
  return !window.pywebview?.api
}
