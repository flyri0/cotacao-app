/**
 * Gerenciador de Cache em Memória RAM para a API do Frontend.
 *
 * Elimina reconsultas repetidas ao alternar de abas e proporciona
 * resposta instantânea (0ms) para leituras frequentes sem violar
 * a regra de persistência (o estado canônico permanece no SQLite).
 */

interface CacheEntry<T = any> {
  data: T
  tags: string[]
  timestamp: number
}

type InvalidateListener = () => void

class ApiCacheManager {
  private cache = new Map<string, CacheEntry>()
  private listeners = new Map<string, Set<InvalidateListener>>()

  /**
   * Obtém um dado do cache se existir.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    return entry.data as T
  }

  /**
   * Verifica se uma chave existe no cache.
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Armazena um resultado no cache associado a tags para invalidação.
   */
  set<T>(key: string, data: T, tags: string[]): void {
    this.cache.set(key, {
      data,
      tags,
      timestamp: Date.now(),
    })
  }

  /**
   * Invalida todas as entradas que possuam uma ou mais das tags informadas.
   */
  invalidateTags(tags: string[]): void {
    if (tags.length === 0) return

    const tagsSet = new Set(tags)
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      const match = entry.tags.some((tag) => tagsSet.has(tag))
      if (match) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
    }

    // Notifica listeners registrados para cada tag
    for (const tag of tags) {
      const tagListeners = this.listeners.get(tag)
      if (tagListeners) {
        tagListeners.forEach((callback) => {
          try {
            callback()
          } catch (err) {
            console.error(`[ApiCache] Erro no listener de invalidação da tag ${tag}:`, err)
          }
        })
      }
    }
  }

  /**
   * Inscreve um callback para ser disparado quando uma tag for invalidada.
   * Retorna uma função para cancelar a inscrição.
   */
  subscribe(tag: string, callback: InvalidateListener): () => void {
    if (!this.listeners.has(tag)) {
      this.listeners.set(tag, new Set())
    }
    this.listeners.get(tag)!.add(callback)

    return () => {
      const set = this.listeners.get(tag)
      if (set) {
        set.delete(callback)
        if (set.size === 0) {
          this.listeners.delete(tag)
        }
      }
    }
  }

  /**
   * Limpa todo o cache (usado ao restaurar ou formatar banco).
   */
  clear(): void {
    this.cache.clear()
    // Notifica todos os listeners
    for (const set of this.listeners.values()) {
      set.forEach((cb) => {
        try {
          cb()
        } catch {}
      })
    }
  }
}

export const apiCache = new ApiCacheManager()

/**
 * Métodos de leitura cacheáveis e suas tags associadas.
 */
export function getCacheConfigForRead(method: string, args: any[]): { key: string; tags: string[] } | null {
  switch (method) {
    case 'list_products': {
      const apenasAtivos = args[0] === true
      return {
        key: `products:${apenasAtivos}`,
        tags: ['products'],
      }
    }
    case 'list_suppliers': {
      const apenasAtivos = args[0] === true
      return {
        key: `suppliers:${apenasAtivos}`,
        tags: ['suppliers'],
      }
    }
    case 'list_rounds': {
      return {
        key: 'rounds:all',
        tags: ['rounds'],
      }
    }
    case 'list_rounds_with_metrics': {
      return {
        key: 'rounds:metrics',
        tags: ['rounds'],
      }
    }
    case 'list_needs': {
      const roundId = args[0]
      if (!roundId) return null
      return {
        key: `needs:${roundId}`,
        tags: ['needs', `needs:${roundId}`],
      }
    }
    case 'list_quotes': {
      const roundId = args[0]
      if (!roundId) return null
      return {
        key: `quotes:${roundId}`,
        tags: ['quotes', `quotes:${roundId}`],
      }
    }
    case 'list_allocations': {
      const roundId = args[0]
      if (!roundId) return null
      return {
        key: `allocations:${roundId}`,
        tags: ['allocations', `allocations:${roundId}`],
      }
    }
    case 'get_settings': {
      return {
        key: 'settings',
        tags: ['settings'],
      }
    }
    case 'check_db_status': {
      return {
        key: 'db_status',
        tags: ['db_status'],
      }
    }
    case 'get_product_statistics': {
      const prodId = args[0]
      return {
        key: `stats:prod:${prodId}`,
        tags: ['stats', 'products', 'quotes'],
      }
    }
    case 'get_supplier_statistics': {
      const fornId = args[0]
      return {
        key: `stats:forn:${fornId}`,
        tags: ['stats', 'suppliers', 'quotes', 'allocations'],
      }
    }
    case 'get_global_quotes_history': {
      return {
        key: 'quotes:global_history',
        tags: ['quotes', 'stats'],
      }
    }
    default:
      return null
  }
}

/**
 * Retorna as tags que devem ser invalidadas quando um método de escrita (mutação) é executado.
 */
export function getInvalidationTagsForMutation(method: string, args: any[]): string[] | 'ALL' | null {
  switch (method) {
    // Banco completo ou dados estruturais
    case 'initialize_empty_db':
    case 'populate_demo_db':
    case 'format_database':
    case 'import_database':
      return 'ALL'

    // Produtos
    case 'create_product':
    case 'update_product':
    case 'remove_product':
    case 'toggle_product_status':
    case 'alternar_status_produto':
    case 'batch_update_products_category':
    case 'batch_toggle_products_active':
    case 'batch_delete_products':
    case 'import_products_excel':
      // Criar/atualizar produtos pode impactar necessidades da rodada (auto-cadastro) e estatísticas
      return ['products', 'needs', 'quotes', 'stats', 'rounds']

    // Fornecedores
    case 'create_supplier':
    case 'update_supplier':
    case 'remove_supplier':
    case 'toggle_supplier_status':
    case 'alternar_status_fornecedor':
    case 'import_suppliers_excel':
      return ['suppliers', 'quotes', 'stats', 'allocations', 'rounds']

    // Rodadas
    case 'create_round':
    case 'update_round':
    case 'remove_round':
    case 'duplicate_round_needs':
      return ['rounds', 'needs', 'quotes', 'allocations', 'stats']

    // Necessidades
    case 'create_need':
    case 'remove_need':
    case 'set_selected_supplier':
    case 'reset_selected_suppliers':
    case 'batch_remove_needs': {
      const roundId = args[0]
      const tags = ['needs', 'rounds', 'stats']
      if (roundId) tags.push(`needs:${roundId}`)
      return tags
    }

    // Cotações
    case 'create_quote':
    case 'update_quote':
    case 'remove_quote':
    case 'batch_remove_quotes':
    case 'batch_update_quotes': {
      const roundId = args[0]
      const tags = ['quotes', 'rounds', 'stats', 'allocations', 'products', 'needs']
      if (roundId) {
        tags.push(`quotes:${roundId}`)
        tags.push(`needs:${roundId}`)
      }
      return tags
    }

    // Alocações
    case 'save_allocations':
    case 'remove_allocation': {
      const roundId = args[0]
      const tags = ['allocations', 'stats']
      if (roundId) tags.push(`allocations:${roundId}`)
      return tags
    }

    // Configurações
    case 'save_settings':
      return ['settings']

    default:
      return null
  }
}
