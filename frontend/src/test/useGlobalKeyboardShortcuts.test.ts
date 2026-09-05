import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGlobalKeyboardShortcuts } from '../hooks/useGlobalKeyboardShortcuts'

describe('useGlobalKeyboardShortcuts', () => {
  it('deve disparar onIncreaseFontSize com Ctrl+ / Ctrl=', () => {
    const onSelectTab = vi.fn()
    const onOpenHelp = vi.fn()
    const onIncreaseFontSize = vi.fn()
    const onDecreaseFontSize = vi.fn()

    renderHook(() =>
      useGlobalKeyboardShortcuts({
        onSelectTab,
        onOpenHelp,
        onIncreaseFontSize,
        onDecreaseFontSize,
      })
    )

    // Ctrl + '+'
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true })
    )
    expect(onIncreaseFontSize).toHaveBeenCalledTimes(1)

    // Ctrl + '='
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: '=', ctrlKey: true, bubbles: true })
    )
    expect(onIncreaseFontSize).toHaveBeenCalledTimes(2)
  })

  it('deve disparar onDecreaseFontSize com Ctrl- / Minus', () => {
    const onSelectTab = vi.fn()
    const onOpenHelp = vi.fn()
    const onDecreaseFontSize = vi.fn()

    renderHook(() =>
      useGlobalKeyboardShortcuts({
        onSelectTab,
        onOpenHelp,
        onDecreaseFontSize,
      })
    )

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: '-', ctrlKey: true, bubbles: true })
    )
    expect(onDecreaseFontSize).toHaveBeenCalledTimes(1)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Minus', ctrlKey: true, bubbles: true })
    )
    expect(onDecreaseFontSize).toHaveBeenCalledTimes(2)
  })

  it('deve alternar abas com atalhos numéricos Ctrl+1 a Ctrl+0', () => {
    const onSelectTab = vi.fn()
    const onOpenHelp = vi.fn()

    renderHook(() =>
      useGlobalKeyboardShortcuts({
        onSelectTab,
        onOpenHelp,
      })
    )

    const expectedTabs = [
      { key: '1', tab: 'produtos' },
      { key: '2', tab: 'fornecedores' },
      { key: '3', tab: 'necessidades' },
      { key: '4', tab: 'cotacoes' },
      { key: '5', tab: 'comparacao' },
      { key: '6', tab: 'alocacao' },
      { key: '7', tab: 'resumo' },
      { key: '8', tab: 'pedido' },
      { key: '9', tab: 'estatisticas' },
      { key: '0', tab: 'configuracoes' },
    ]

    expectedTabs.forEach(({ key, tab }) => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true })
      )
      expect(onSelectTab).toHaveBeenCalledWith(tab)
    })
  })

  it('deve abrir ajuda ao pressionar F1 ou Ctrl+K', () => {
    const onSelectTab = vi.fn()
    const onOpenHelp = vi.fn()

    renderHook(() =>
      useGlobalKeyboardShortcuts({
        onSelectTab,
        onOpenHelp,
      })
    )

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }))
    expect(onOpenHelp).toHaveBeenCalledTimes(1)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    )
    expect(onOpenHelp).toHaveBeenCalledTimes(2)
  })

  it('deve desinscrever listener no unmount', () => {
    const onSelectTab = vi.fn()
    const onOpenHelp = vi.fn()

    const { unmount } = renderHook(() =>
      useGlobalKeyboardShortcuts({
        onSelectTab,
        onOpenHelp,
      })
    )

    unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }))
    expect(onOpenHelp).not.toHaveBeenCalled()
  })
})
