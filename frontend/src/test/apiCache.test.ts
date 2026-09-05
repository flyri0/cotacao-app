import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  apiCache,
  getCacheConfigForRead,
  getInvalidationTagsForMutation,
} from '../services/apiCache'

describe('apiCache', () => {
  beforeEach(() => {
    apiCache.clear()
  })

  it('deve armazenar, verificar e recuperar entradas no cache', () => {
    expect(apiCache.has('key1')).toBe(false)
    expect(apiCache.get('key1')).toBeUndefined()

    apiCache.set('key1', { nome: 'Item 1' }, ['tag1'])
    expect(apiCache.has('key1')).toBe(true)
    expect(apiCache.get('key1')).toEqual({ nome: 'Item 1' })
  })

  it('deve invalidar entradas associadas às tags e notificar ouvintes', () => {
    const callbackTag1 = vi.fn()
    const callbackTag2 = vi.fn()

    const unsub1 = apiCache.subscribe('tag1', callbackTag1)
    const unsub2 = apiCache.subscribe('tag2', callbackTag2)

    apiCache.set('item1', 'data1', ['tag1'])
    apiCache.set('item2', 'data2', ['tag2'])
    apiCache.set('item3', 'data3', ['tag1', 'tag2'])

    // Invalidação vazia não deve fazer nada
    apiCache.invalidateTags([])
    expect(apiCache.has('item1')).toBe(true)

    // Invalida tag1
    apiCache.invalidateTags(['tag1'])
    expect(apiCache.has('item1')).toBe(false)
    expect(apiCache.has('item3')).toBe(false)
    expect(apiCache.has('item2')).toBe(true)
    expect(callbackTag1).toHaveBeenCalledTimes(1)
    expect(callbackTag2).toHaveBeenCalledTimes(0)

    // Desinscrever e verificar que não recebe mais chamadas
    unsub1()
    apiCache.invalidateTags(['tag1'])
    expect(callbackTag1).toHaveBeenCalledTimes(1)

    unsub2()
  })

  it('deve lidar com erros em ouvintes durante invalidação sem interromper o fluxo', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const faultyListener = vi.fn(() => {
      throw new Error('Falha simulada no ouvinte')
    })
    const normalListener = vi.fn()

    apiCache.subscribe('err_tag', faultyListener)
    apiCache.subscribe('err_tag', normalListener)

    apiCache.invalidateTags(['err_tag'])

    expect(faultyListener).toHaveBeenCalled()
    expect(normalListener).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('deve limpar todas as entradas e notificar listeners ao chamar clear()', () => {
    const listener = vi.fn()
    apiCache.subscribe('tag_clear', listener)
    apiCache.set('c1', 'v1', ['tag_clear'])

    apiCache.clear()
    expect(apiCache.has('c1')).toBe(false)
    expect(listener).toHaveBeenCalled()
  })

  describe('getCacheConfigForRead', () => {
    it('deve mapear métodos de leitura suportados com suas chaves e tags', () => {
      expect(getCacheConfigForRead('list_products', [false])).toEqual({
        key: 'products:false',
        tags: ['products'],
      })
      expect(getCacheConfigForRead('list_products', [true])).toEqual({
        key: 'products:true',
        tags: ['products'],
      })
      expect(getCacheConfigForRead('list_suppliers', [true])).toEqual({
        key: 'suppliers:true',
        tags: ['suppliers'],
      })
      expect(getCacheConfigForRead('list_rounds', [])).toEqual({
        key: 'rounds:all',
        tags: ['rounds'],
      })
      expect(getCacheConfigForRead('list_rounds_with_metrics', [])).toEqual({
        key: 'rounds:metrics',
        tags: ['rounds'],
      })
      expect(getCacheConfigForRead('list_needs', [10])).toEqual({
        key: 'needs:10',
        tags: ['needs', 'needs:10'],
      })
      expect(getCacheConfigForRead('list_needs', [])).toBeNull()

      expect(getCacheConfigForRead('list_quotes', [5])).toEqual({
        key: 'quotes:5',
        tags: ['quotes', 'quotes:5'],
      })
      expect(getCacheConfigForRead('list_quotes', [])).toBeNull()

      expect(getCacheConfigForRead('list_allocations', [3])).toEqual({
        key: 'allocations:3',
        tags: ['allocations', 'allocations:3'],
      })
      expect(getCacheConfigForRead('list_allocations', [])).toBeNull()

      expect(getCacheConfigForRead('get_settings', [])).toEqual({
        key: 'settings',
        tags: ['settings'],
      })
      expect(getCacheConfigForRead('check_db_status', [])).toEqual({
        key: 'db_status',
        tags: ['db_status'],
      })
      expect(getCacheConfigForRead('get_product_statistics', [12])).toEqual({
        key: 'stats:prod:12',
        tags: ['stats', 'products', 'quotes'],
      })
      expect(getCacheConfigForRead('get_supplier_statistics', [8])).toEqual({
        key: 'stats:forn:8',
        tags: ['stats', 'suppliers', 'quotes', 'allocations'],
      })
      expect(getCacheConfigForRead('get_global_quotes_history', [])).toEqual({
        key: 'quotes:global_history',
        tags: ['quotes', 'stats'],
      })
      expect(getCacheConfigForRead('unknown_read_method', [])).toBeNull()
    })
  })

  describe('getInvalidationTagsForMutation', () => {
    it('deve retornar "ALL" para operações estruturais e reset de banco', () => {
      expect(getInvalidationTagsForMutation('initialize_empty_db', [])).toBe('ALL')
      expect(getInvalidationTagsForMutation('populate_demo_db', [])).toBe('ALL')
      expect(getInvalidationTagsForMutation('format_database', [])).toBe('ALL')
      expect(getInvalidationTagsForMutation('import_database', [])).toBe('ALL')
    })

    it('deve retornar tags corretas para produtos e fornecedores', () => {
      expect(getInvalidationTagsForMutation('create_product', [])).toEqual([
        'products',
        'needs',
        'quotes',
        'stats',
        'rounds',
      ])
      expect(getInvalidationTagsForMutation('create_supplier', [])).toEqual([
        'suppliers',
        'quotes',
        'stats',
        'allocations',
        'rounds',
      ])
    })

    it('deve retornar tags corretas para rodadas', () => {
      expect(getInvalidationTagsForMutation('create_round', [])).toEqual([
        'rounds',
        'needs',
        'quotes',
        'allocations',
        'stats',
      ])
    })

    it('deve retornar tags corretas para necessidades', () => {
      expect(getInvalidationTagsForMutation('create_need', [4])).toEqual([
        'needs',
        'rounds',
        'stats',
        'needs:4',
      ])
      expect(getInvalidationTagsForMutation('create_need', [])).toEqual([
        'needs',
        'rounds',
        'stats',
      ])
    })

    it('deve retornar tags corretas para cotações', () => {
      expect(getInvalidationTagsForMutation('create_quote', [7])).toEqual([
        'quotes',
        'rounds',
        'stats',
        'allocations',
        'products',
        'needs',
        'quotes:7',
        'needs:7',
      ])
      expect(getInvalidationTagsForMutation('create_quote', [])).toEqual([
        'quotes',
        'rounds',
        'stats',
        'allocations',
        'products',
        'needs',
      ])
    })

    it('deve retornar tags corretas para alocações', () => {
      expect(getInvalidationTagsForMutation('save_allocations', [9])).toEqual([
        'allocations',
        'stats',
        'allocations:9',
      ])
      expect(getInvalidationTagsForMutation('save_allocations', [])).toEqual([
        'allocations',
        'stats',
      ])
    })

    it('deve retornar tags corretas para configurações e operações desconhecidas', () => {
      expect(getInvalidationTagsForMutation('save_settings', [])).toEqual(['settings'])
      expect(getInvalidationTagsForMutation('unknown_mutation', [])).toBeNull()
    })
  })
})
