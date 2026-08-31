import type { PywebviewApi } from '../types'

/**
 * Retorna a instância da API pywebview, aguardando o evento 'pywebviewready' caso necessário.
 */
export async function getApi(): Promise<PywebviewApi> {
  if (window.pywebview?.api) {
    return window.pywebview.api
  }

  return new Promise((resolve) => {
    const handleReady = () => {
      window.removeEventListener('pywebviewready', handleReady)
      if (window.pywebview?.api) {
        resolve(window.pywebview.api)
      }
    }

    window.addEventListener('pywebviewready', handleReady)

    // Fallback caso o evento já tenha disparado antes do listener
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      if (window.pywebview?.api) {
        clearInterval(interval)
        window.removeEventListener('pywebviewready', handleReady)
        resolve(window.pywebview.api)
      } else if (attempts > 30) {
        clearInterval(interval)
        console.warn('pywebview API não detectada após 3 segundos.')
      }
    }, 100)
  })
}
