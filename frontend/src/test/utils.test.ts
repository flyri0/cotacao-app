import { describe, it, expect, vi } from 'vitest'
import { downloadBase64File } from '../utils/fileDownload'
import { getVirtualizedTableProps } from '../utils/tableDefaults'

describe('utils', () => {
  describe('downloadBase64File', () => {
    it('deve decodificar base64, gerar link temporário e disparar download', () => {
      const clickSpy = vi.fn()
      const appendSpy = vi.spyOn(document.body, 'appendChild')
      const removeSpy = vi.spyOn(document.body, 'removeChild')

      const originalCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName)
        if (tagName === 'a') {
          el.click = clickSpy
        }
        return el
      })

      // Base64 simples ("Teste")
      const b64 = btoa('Teste de download')
      downloadBase64File(b64, 'teste.xlsx')

      expect(clickSpy).toHaveBeenCalled()
      expect(appendSpy).toHaveBeenCalled()
      expect(removeSpy).toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('getVirtualizedTableProps', () => {
    it('deve retornar configurações padrão da tabela MRT virtualizada', () => {
      const props = getVirtualizedTableProps()

      expect(props.enablePagination).toBe(false)
      expect(props.enableBottomToolbar).toBe(false)
      expect(props.enableTopToolbar).toBe(true)
      expect(props.enableStickyHeader).toBe(true)
      expect(props.initialState?.density).toBe('xs')
      expect(props.rowVirtualizerOptions).toBeUndefined()
    })

    it('deve aplicar configurações customizadas de virtualização e sobreposição', () => {
      const props = getVirtualizedTableProps({
        enableRowVirtualization: true,
        overscan: 12,
        enableTopToolbar: false,
      })

      expect(props.enableRowVirtualization).toBe(true)
      expect(props.enableTopToolbar).toBe(false)
      expect(props.rowVirtualizerOptions).toEqual({ overscan: 12 })
    })
  })
})
