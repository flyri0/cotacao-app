import { useEffect } from 'react'

export type TabType =
  | 'produtos'
  | 'fornecedores'
  | 'rodadas'
  | 'necessidades'
  | 'cotacoes'
  | 'comparacao'
  | 'alocacao'
  | 'resumo'
  | 'pedido'
  | 'estatisticas'
  | 'configuracoes'

interface UseGlobalKeyboardShortcutsOptions {
  onSelectTab: (tab: TabType) => void
  onOpenHelp: () => void
  onIncreaseFontSize?: () => void
  onDecreaseFontSize?: () => void
}

/**
 * Listener nativo global de alta prioridade (fase de captura)
 * para alternância rápida de telas e ajuste de acessibilidade via atalhos do teclado.
 */
export function useGlobalKeyboardShortcuts({
  onSelectTab,
  onOpenHelp,
  onIncreaseFontSize,
  onDecreaseFontSize,
}: UseGlobalKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Atalhos de Zoom de Fonte com Ctrl+ e Ctrl-
      if (e.ctrlKey || e.metaKey) {
        const key = e.key
        const code = e.code

        if (key === '+' || key === '=' || code === 'Equal' || code === 'NumpadAdd') {
          e.preventDefault()
          e.stopPropagation()
          onIncreaseFontSize?.()
          return
        }

        if (key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract') {
          e.preventDefault()
          e.stopPropagation()
          onDecreaseFontSize?.()
          return
        }
      }

      // Atalhos combinados com Ctrl ou Alt (Ctrl+1 .. Ctrl+0)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const key = e.key
        const code = e.code

        if (key === '1' || code === 'Digit1' || code === 'Numpad1') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('produtos')
          return
        }
        if (key === '2' || code === 'Digit2' || code === 'Numpad2') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('fornecedores')
          return
        }
        if (key === '3' || code === 'Digit3' || code === 'Numpad3') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('necessidades')
          return
        }
        if (key === '4' || code === 'Digit4' || code === 'Numpad4') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('cotacoes')
          return
        }
        if (key === '5' || code === 'Digit5' || code === 'Numpad5') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('comparacao')
          return
        }
        if (key === '6' || code === 'Digit6' || code === 'Numpad6') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('alocacao')
          return
        }
        if (key === '7' || code === 'Digit7' || code === 'Numpad7') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('resumo')
          return
        }
        if (key === '8' || code === 'Digit8' || code === 'Numpad8') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('pedido')
          return
        }
        if (key === '9' || code === 'Digit9' || code === 'Numpad9') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('estatisticas')
          return
        }
        if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
          e.preventDefault()
          e.stopPropagation()
          onSelectTab('configuracoes')
          return
        }
        if (key === 'k' || key === 'K') {
          e.preventDefault()
          e.stopPropagation()
          onOpenHelp()
          return
        }
      }

      if (e.key === 'F1') {
        e.preventDefault()
        e.stopPropagation()
        onOpenHelp()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onSelectTab, onOpenHelp, onIncreaseFontSize, onDecreaseFontSize])
}

export default useGlobalKeyboardShortcuts
