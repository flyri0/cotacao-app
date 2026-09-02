import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  Center,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartBar,
  IconCoins,
  IconFilter,
  IconHistory,
  IconListCheck,
  IconPackage,
  IconReceipt,
  IconScale,
  IconSearch,
  IconTrendingUp,
  IconTrophy,
  IconTruck,
} from '@tabler/icons-react'
import { LineChart, BarChart } from '@mantine/charts'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../locales/mrtPtBr'
import { PageHeader } from './common/PageHeader'
import { AppAutocomplete, AppSelect } from './common/AppSelect'
import { getApi } from '../services/api'
import type {
  CotacaoHistoricoItem,
  EstatisticasFornecedor,
  EstatisticasProduto,
  Fornecedor,
  HistoricoGlobalCotacaoItem,
  Produto,
  RankingFornecedorItem,
  Rodada,
} from '../types'

function formatMoney(valor: number, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

export function EstatisticasView({ themeColor = 'blue' }: { themeColor?: string }) {
  const [activeTab, setActiveTab] = useState<string | null>('produto')

  // Dados mestres
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [rodadas, setRodadas] = useState<Rodada[]>([])

  // Estado Aba 1: Por Produto
  const [produtoBusca, setProdutoBusca] = useState<string>('')
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<number | null>(null)
  const [estatisticasProduto, setEstatisticasProduto] = useState<EstatisticasProduto | null>(null)
  const [loadingProdStats, setLoadingProdStats] = useState(false)

  // Estado Aba 2: Por Fornecedor
  const [fornecedorSelecionadoId, setFornecedorSelecionadoId] = useState<number | null>(null)
  const [estatisticasFornecedor, setEstatisticasFornecedor] = useState<EstatisticasFornecedor | null>(null)
  const [loadingFornStats, setLoadingFornStats] = useState(false)

  // Estado Aba 3: Histórico Global com Filtros
  const [historicoGlobal, setHistoricoGlobal] = useState<HistoricoGlobalCotacaoItem[]>([])
  const [loadingGlobal, setLoadingGlobal] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [filtroFornecedor, setFiltroFornecedor] = useState<string | null>(null)
  const [filtroRodada, setFiltroRodada] = useState<string | null>(null)
  const [filtroStatusAlocacao, setFiltroStatusAlocacao] = useState<string | null>(null)

  const carregarDadosIniciais = async () => {
    try {
      const api = await getApi()
      const [prods, forns, rods] = await Promise.all([
        api.list_products(),
        api.list_suppliers(),
        api.list_rounds(),
      ])
      setProdutos(prods)
      setFornecedores(forns)
      setRodadas(rods)

      if (prods.length > 0 && !produtoSelecionadoId) {
        const primeiro = prods[0]
        setProdutoSelecionadoId(primeiro.id)
        setProdutoBusca(primeiro.nome)
        carregarEstatisticasProduto(primeiro.id)
      }

      if (forns.length > 0 && !fornecedorSelecionadoId) {
        const primeiroForn = forns[0]
        setFornecedorSelecionadoId(primeiroForn.id)
        carregarEstatisticasFornecedor(primeiroForn.id)
      }
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error)
    }
  }

  const carregarEstatisticasProduto = async (idProduto: number) => {
    try {
      setLoadingProdStats(true)
      const api = await getApi()
      const stats = await api.get_product_statistics(idProduto)
      setEstatisticasProduto(stats)
    } catch (error: any) {
      console.error('Erro ao obter estatísticas do produto:', error)
    } finally {
      setLoadingProdStats(false)
    }
  }

  const carregarEstatisticasFornecedor = async (idFornecedor: number) => {
    try {
      setLoadingFornStats(true)
      const api = await getApi()
      const stats = await api.get_supplier_statistics(idFornecedor)
      setEstatisticasFornecedor(stats)
    } catch (error: any) {
      console.error('Erro ao obter estatísticas do fornecedor:', error)
    } finally {
      setLoadingFornStats(false)
    }
  }

  const carregarHistoricoGlobal = async () => {
    try {
      setLoadingGlobal(true)
      const api = await getApi()
      const lista = await api.get_global_quotes_history()
      setHistoricoGlobal(lista)
    } catch (error: any) {
      console.error('Erro ao obter histórico global:', error)
    } finally {
      setLoadingGlobal(false)
    }
  }

  useEffect(() => {
    carregarDadosIniciais()
    carregarHistoricoGlobal()
  }, [])

  const handleSelectProdutoNome = (nome: string) => {
    setProdutoBusca(nome)
    const prod = produtos.find(
      (p) => p.nome.trim().toLowerCase() === nome.trim().toLowerCase(),
    )
    if (prod) {
      setProdutoSelecionadoId(prod.id)
      carregarEstatisticasProduto(prod.id)
    }
  }

  const handleSelectFornecedor = (val: string | null) => {
    if (val) {
      const id = parseInt(val, 10)
      setFornecedorSelecionadoId(id)
      carregarEstatisticasFornecedor(id)
    }
  }

  const nomesProdutos = useMemo(() => produtos.map((p) => p.nome), [produtos])
  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>()
    produtos.forEach((p) => {
      if (p.categoria) cats.add(p.categoria)
    })
    return Array.from(cats)
  }, [produtos])

  // =========================================================================
  // TABELAS DA ABA 1 (PRODUTO)
  // =========================================================================
  const columnsHistoricoProd = useMemo<MRT_ColumnDef<CotacaoHistoricoItem>[]>(
    () => [
      {
        accessorKey: 'rodada_descricao',
        header: 'Rodada',
        size: 160,
        minSize: 120,
        maxSize: 250,
        Cell: ({ row }) => (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <Text fw={600} size="xs" truncate="end">
              {row.original.rodada_descricao}
            </Text>
            <Text size="10px" c="dimmed" truncate="end">
              Data: {row.original.rodada_data}
            </Text>
          </div>
        ),
      },
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 160,
        minSize: 135,
        maxSize: 300,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'marca',
        header: 'Marca',
        size: 110,
        minSize: 95,
        maxSize: 200,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return (
            <Text size="xs" truncate="end" c={!val ? 'dimmed' : undefined}>
              {val || '-'}
            </Text>
          )
        },
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem',
        size: 140,
        minSize: 125,
        maxSize: 250,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'qtd_por_embalagem',
        header: 'Qtd / Emb.',
        size: 110,
        minSize: 105,
        maxSize: 150,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell, row }) => (
          <Text size="xs">
            {cell.getValue<number>()} {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb.',
        size: 130,
        minSize: 125,
        maxSize: 180,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs">
            {formatMoney(cell.getValue<number>(), 2)}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário',
        size: 150,
        minSize: 145,
        maxSize: 220,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell, row }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(cell.getValue<number>())} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
    ],
    [],
  )

  const columnsRankingProd = useMemo<MRT_ColumnDef<RankingFornecedorItem>[]>(
    () => [
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 200,
        minSize: 140,
        maxSize: 350,
        Cell: ({ cell }) => (
          <Text fw={600} size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'total_ofertas',
        header: 'Cotações Enviadas',
        size: 160,
        minSize: 155,
        maxSize: 220,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ cell }) => (
          <Text size="xs">
            {cell.getValue<number>()} {cell.getValue<number>() === 1 ? 'rodada' : 'rodadas'}
          </Text>
        ),
      },
      {
        accessorKey: 'menor_preco_oferecido',
        header: 'Menor Preço',
        size: 140,
        minSize: 135,
        maxSize: 200,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_medio_oferecido',
        header: 'Preço Médio',
        size: 140,
        minSize: 135,
        maxSize: 200,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs" c="dimmed">
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
    ],
    [],
  )

  const tableHistoricoProd = useMantineReactTable({
    enableDensityToggle: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    columns: columnsHistoricoProd,
    data: estatisticasProduto?.cotacoes_historico || [],
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    initialState: { density: 'xs', pagination: { pageSize: 10, pageIndex: 0 } },
    mantineTableHeadCellProps: {
      style: {
        padding: '6px 8px',
        fontSize: 'var(--app-font-base, 13px)',
        whiteSpace: 'nowrap',
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: '4px 8px',
        fontSize: 'var(--app-font-base, 13px)',
      },
    },
    mantineTableProps: { striped: true, highlightOnHover: true, withTableBorder: true },
    mantinePaperProps: { withBorder: true, radius: 'sm', shadow: 'none' },
  })

  const tableRankingProd = useMantineReactTable({
    enableDensityToggle: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    columns: columnsRankingProd,
    data: estatisticasProduto?.ranking_fornecedores || [],
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: false,
    enableBottomToolbar: false,
    enableTopToolbar: false,
    initialState: { density: 'xs' },
    mantineTableHeadCellProps: {
      style: {
        padding: '6px 8px',
        fontSize: 'var(--app-font-base, 13px)',
        whiteSpace: 'nowrap',
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: '4px 8px',
        fontSize: 'var(--app-font-base, 13px)',
      },
    },
    mantineTableProps: { striped: true, highlightOnHover: true, withTableBorder: true },
    mantinePaperProps: { withBorder: true, radius: 'sm', shadow: 'none' },
  })

  // =========================================================================
  // TABELA DA ABA 2 (FORNECEDOR)
  // =========================================================================
  const columnsHistoricoForn = useMemo<MRT_ColumnDef<CotacaoHistoricoItem>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto Ofertado',
        size: 200,
        minSize: 155,
        maxSize: 350,
        Cell: ({ row }) => (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <Text fw={600} size="xs" truncate="end">
              {row.original.produto_nome}
            </Text>
            {row.original.produto_categoria && (
              <Text size="10px" c="dimmed" truncate="end">
                {row.original.produto_categoria}
              </Text>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'rodada_descricao',
        header: 'Rodada',
        size: 160,
        minSize: 120,
        maxSize: 250,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem',
        size: 140,
        minSize: 125,
        maxSize: 220,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb.',
        size: 130,
        minSize: 125,
        maxSize: 180,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs">
            {formatMoney(cell.getValue<number>(), 2)}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário',
        size: 150,
        minSize: 145,
        maxSize: 220,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell, row }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(cell.getValue<number>())} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
    ],
    [],
  )

  const tableHistoricoForn = useMantineReactTable({
    enableDensityToggle: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    columns: columnsHistoricoForn,
    data: estatisticasFornecedor?.cotacoes_historico || [],
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    initialState: { density: 'xs', pagination: { pageSize: 10, pageIndex: 0 } },
    mantineTableHeadCellProps: {
      style: {
        padding: '6px 8px',
        fontSize: 'var(--app-font-base, 13px)',
        whiteSpace: 'nowrap',
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: '4px 8px',
        fontSize: 'var(--app-font-base, 13px)',
      },
    },
    mantineTableProps: { striped: true, highlightOnHover: true, withTableBorder: true },
    mantinePaperProps: { withBorder: true, radius: 'sm', shadow: 'none' },
  })

  // =========================================================================
  // TABELA DA ABA 3 (HISTÓRICO GLOBAL COM FILTROS)
  // =========================================================================
  const dadosFiltradosGlobal = useMemo(() => {
    return historicoGlobal.filter((item) => {
      if (filtroCategoria && item.produto_categoria !== filtroCategoria) {
        return false
      }
      if (filtroFornecedor && item.fornecedor_nome !== filtroFornecedor) {
        return false
      }
      if (filtroStatusAlocacao === 'comprados' && !item.foi_alocado) {
        return false
      }
      if (filtroStatusAlocacao === 'apenas_cotados' && item.foi_alocado) {
        return false
      }
      return true
    })
  }, [
    historicoGlobal,
    filtroCategoria,
    filtroFornecedor,
    filtroStatusAlocacao,
  ])

  const columnsGlobal = useMemo<MRT_ColumnDef<HistoricoGlobalCotacaoItem>[]>(
    () => [
      {
        accessorKey: 'rodada_descricao',
        header: 'Rodada',
        size: 160,
        minSize: 120,
        maxSize: 250,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 200,
        minSize: 140,
        maxSize: 350,
        Cell: ({ row }) => (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <Text fw={600} size="xs" truncate="end">
              {row.original.produto_nome}
            </Text>
            {row.original.produto_categoria && (
              <Text size="10px" c="dimmed" truncate="end">
                {row.original.produto_categoria}
              </Text>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 160,
        minSize: 135,
        maxSize: 300,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem',
        size: 140,
        minSize: 125,
        maxSize: 220,
        Cell: ({ row }) => (
          <Text size="xs" truncate="end">
            {row.original.marca ? `[${row.original.marca}] ` : ''}{row.original.embalagem}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb.',
        size: 130,
        minSize: 125,
        maxSize: 180,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs">
            {formatMoney(cell.getValue<number>(), 2)}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário',
        size: 150,
        minSize: 145,
        maxSize: 220,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell, row }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(cell.getValue<number>())} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        accessorKey: 'foi_alocado',
        header: 'Status Compra',
        size: 140,
        minSize: 135,
        maxSize: 180,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ cell }) => {
          const comprado = !!cell.getValue<boolean>()
          return comprado ? (
            <Badge color="teal" variant="filled" size="xs">
              ✓ Comprado
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="xs">
              Cotado
            </Badge>
          )
        },
      },
    ],
    [],
  )

  const tableGlobal = useMantineReactTable({
    enableDensityToggle: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    columns: columnsGlobal,
    data: dadosFiltradosGlobal,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    initialState: { density: 'xs', pagination: { pageSize: 15, pageIndex: 0 } },
    mantineTableHeadCellProps: {
      style: {
        padding: '6px 8px',
        fontSize: 'var(--app-font-base, 13px)',
        whiteSpace: 'nowrap',
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: '4px 8px',
        fontSize: 'var(--app-font-base, 13px)',
      },
    },
    mantineTableProps: { striped: true, highlightOnHover: true, withTableBorder: true },
    mantinePaperProps: {
      withBorder: true,
      radius: 'sm',
      shadow: 'none',
    },
  })

  // =========================================================================
  // MEMOIZERS DOS GRÁFICOS INTERATIVOS
  // =========================================================================
  // Dados do Gráfico de Evolução de Preços do Produto (Aba 1)
  const dadosGraficoEvolucaoProd = useMemo(() => {
    if (!estatisticasProduto || !estatisticasProduto.cotacoes_historico) return []

    // Agrupa cotações por rodada
    const rodadasMap = new Map<string, { rodada: string; menor_preco: number; [key: string]: any }>()

    estatisticasProduto.cotacoes_historico.forEach((c) => {
      const nomeRodada = c.rodada_descricao || `Rodada #${c.id_rodada}`
      if (!rodadasMap.has(nomeRodada)) {
        rodadasMap.set(nomeRodada, {
          rodada: nomeRodada,
          menor_preco: c.preco_unitario,
        })
      }
      const item = rodadasMap.get(nomeRodada)!
      if (c.preco_unitario < item.menor_preco) {
        item.menor_preco = c.preco_unitario
      }
      item[c.fornecedor_nome] = c.preco_unitario
    })

    return Array.from(rodadasMap.values())
  }, [estatisticasProduto])

  // Séries do Gráfico de Evolução (Menor Preço + Fornecedores)
  const seriesGraficoEvolucaoProd = useMemo(() => {
    if (!estatisticasProduto || !estatisticasProduto.ranking_fornecedores) return []
    const cores = ['indigo.6', 'blue.6', 'cyan.6', 'grape.6', 'violet.6', 'orange.6']

    const series = [
      { name: 'menor_preco', color: 'teal.6', label: 'Menor Preço' },
    ]

    estatisticasProduto.ranking_fornecedores.slice(0, 4).forEach((r, idx) => {
      series.push({
        name: r.fornecedor_nome,
        color: cores[idx % cores.length],
        label: r.fornecedor_nome,
      })
    })

    return series
  }, [estatisticasProduto])

  // Dados do Gráfico de Ranking de Fornecedores do Produto (Aba 1)
  const dadosGraficoRankingProd = useMemo(() => {
    if (!estatisticasProduto || !estatisticasProduto.ranking_fornecedores) return []
    return estatisticasProduto.ranking_fornecedores.map((r) => ({
      fornecedor: r.fornecedor_nome,
      preco_medio: r.preco_medio_oferecido,
      menor_preco: r.menor_preco_oferecido,
    }))
  }, [estatisticasProduto])

  // Dados do Gráfico de Atividade do Fornecedor por Rodada (Aba 2)
  const dadosGraficoFornecedor = useMemo(() => {
    if (!estatisticasFornecedor || !estatisticasFornecedor.cotacoes_historico) return []

    const map = new Map<string, { rodada: string; total_cotacoes: number; total_alocados: number }>()

    estatisticasFornecedor.cotacoes_historico.forEach((c) => {
      const nomeRodada = c.rodada_descricao || `Rodada #${c.id_rodada}`
      if (!map.has(nomeRodada)) {
        map.set(nomeRodada, { rodada: nomeRodada, total_cotacoes: 0, total_alocados: 0 })
      }
      map.get(nomeRodada)!.total_cotacoes += 1
    })

    if (estatisticasFornecedor.alocacoes_historico) {
      estatisticasFornecedor.alocacoes_historico.forEach((a) => {
        const rod = rodadas.find((r) => r.id === a.id_rodada)
        const nomeRodada = rod?.descricao || `Rodada #${a.id_rodada}`
        if (!map.has(nomeRodada)) {
          map.set(nomeRodada, { rodada: nomeRodada, total_cotacoes: 0, total_alocados: 0 })
        }
        map.get(nomeRodada)!.total_alocados += 1
      })
    }

    return Array.from(map.values())
  }, [estatisticasFornecedor, rodadas])

  // Dados do Gráfico de Distribuição por Categoria (Aba 3)
  const dadosGraficoCategoriasGlobal = useMemo(() => {
    const map = new Map<string, { categoria: string; total_cotacoes: number; total_comprados: number }>()

    dadosFiltradosGlobal.forEach((item) => {
      const cat = item.produto_categoria || 'Sem Categoria'
      if (!map.has(cat)) {
        map.set(cat, { categoria: cat, total_cotacoes: 0, total_comprados: 0 })
      }
      const entry = map.get(cat)!
      entry.total_cotacoes += 1
      if (item.foi_alocado) {
        entry.total_comprados += 1
      }
    })
return Array.from(map.values())
  }, [dadosFiltradosGlobal])

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <PageHeader
        icon={IconHistory}
        iconColor={themeColor}
        title="Estatísticas & Histórico Comercial"
        subtitle="Inteligência de compras, evolução temporal e comparativos"
      />

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="sm">
        <Tabs.List>
          <Tabs.Tab value="produto" leftSection={<IconPackage size={15} />}>
            Por Produto
          </Tabs.Tab>
          <Tabs.Tab value="fornecedor" leftSection={<IconTruck size={15} />}>
            Por Fornecedor
          </Tabs.Tab>
          <Tabs.Tab value="global" leftSection={<IconTrendingUp size={15} />}>
            Visão Geral
          </Tabs.Tab>
        </Tabs.List>

        {/* ================================================================= */}
        {/* ABA 1: ANÁLISE POR PRODUTO                                        */}
        {/* ================================================================= */}
        <Tabs.Panel value="produto" pt="xs">
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="xs" fw={600}>
                Pesquise e selecione um produto para auditar seu histórico:
              </Text>
              <AppAutocomplete
                placeholder="Digite o nome do produto..."
                size="xs"
                data={nomesProdutos}
                value={produtoBusca}
                onChange={setProdutoBusca}
                onOptionSubmit={handleSelectProdutoNome}
                style={{ width: 300 }}
                limit={8}
                leftSection={<IconSearch size={14} />}
              />
            </Group>

            {loadingProdStats ? (
              <Center p="xl">
                <Loader size="lg" />
              </Center>
            ) : estatisticasProduto ? (
              <Stack gap="xs">
                <Paper withBorder p="xs" radius="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <ThemeIcon size={28} radius="sm" color={themeColor} variant="light">
                        <IconPackage size={16} />
                      </ThemeIcon>
                      <div>
                        <Title order={4} style={{ fontSize: '0.95rem' }}>{estatisticasProduto.produto.nome}</Title>
                        <Group gap={4} mt={2}>
                          {estatisticasProduto.produto.categoria ? (
                            <Badge color="teal" variant="dot" size="xs">
                              {estatisticasProduto.produto.categoria}
                            </Badge>
                          ) : (
                            <Badge color="gray" variant="light" size="xs">
                              Geral
                            </Badge>
                          )}
                        </Group>
                      </div>
                    </Group>
                    <Badge size="xs" color="blue" variant="light">
                      {estatisticasProduto.total_cotacoes} cotações em{' '}
                      {estatisticasProduto.total_rodadas} rodadas
                    </Badge>
                  </Group>
                </Paper>

                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xs">
                  <Paper withBorder p="xs" radius="sm">
                    <Group justify="space-between">
                      <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                        Menor Preço Histórico
                      </Text>
                      <ThemeIcon color="teal" variant="light" size={24} radius="sm">
                        <IconTrophy size={14} />
                      </ThemeIcon>
                    </Group>
                    <Title order={3} c="teal.8" style={{ fontSize: '1.2rem', marginTop: 2 }}>
                      {estatisticasProduto.menor_preco > 0
                        ? formatMoney(estatisticasProduto.menor_preco)
                        : 'R$ 0,00'}
                    </Title>
                    <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
                      {estatisticasProduto.melhor_fornecedor
                        ? `Por ${estatisticasProduto.melhor_fornecedor}`
                        : 'Sem cotações'}
                    </Text>
                  </Paper>

                  <Paper withBorder p="xs" radius="sm">
                    <Group justify="space-between">
                      <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                        Preço Médio Histórico
                      </Text>
                      <ThemeIcon color="blue" variant="light" size={24} radius="sm">
                        <IconScale size={14} />
                      </ThemeIcon>
                    </Group>
                    <Title order={3} c="blue.8" style={{ fontSize: '1.2rem', marginTop: 2 }}>
                      {estatisticasProduto.preco_medio > 0
                        ? formatMoney(estatisticasProduto.preco_medio)
                        : 'R$ 0,00'}
                    </Title>
                    <Text size="10px" c="dimmed" mt={2}>
                      Média geral
                    </Text>
                  </Paper>

                  <Paper withBorder p="xs" radius="sm">
                    <Group justify="space-between">
                      <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                        Maior Preço Registrado
                      </Text>
                      <ThemeIcon color="red" variant="light" size={24} radius="sm">
                        <IconReceipt size={14} />
                      </ThemeIcon>
                    </Group>
                    <Title order={3} c="red.8" style={{ fontSize: '1.2rem', marginTop: 2 }}>
                      {estatisticasProduto.maior_preco > 0
                        ? formatMoney(estatisticasProduto.maior_preco)
                        : 'R$ 0,00'}
                    </Title>
                    <Text size="10px" c="dimmed" mt={2}>
                      Teto máximo
                    </Text>
                  </Paper>

                  <Paper withBorder p="xs" radius="sm">
                    <Group justify="space-between">
                      <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                        Variação Cronológica
                      </Text>
                      <ThemeIcon
                        color={
                          estatisticasProduto.variacao_percentual <= 0
                            ? 'teal'
                            : 'orange'
                        }
                        variant="light"
                        size={24}
                        radius="sm"
                      >
                        {estatisticasProduto.variacao_percentual <= 0 ? (
                          <IconArrowDownRight size={14} />
                        ) : (
                          <IconArrowUpRight size={14} />
                        )}
                      </ThemeIcon>
                    </Group>
                    <Title
                      order={3}
                      c={
                        estatisticasProduto.variacao_percentual <= 0
                          ? 'teal.8'
                          : 'orange.8'
                      }
                      style={{ fontSize: '1.2rem', marginTop: 2 }}
                    >
                      {estatisticasProduto.variacao_percentual > 0 ? '+' : ''}
                      {estatisticasProduto.variacao_percentual.toFixed(1)}%
                    </Title>
                    <Text size="10px" c="dimmed" mt={2}>
                      Evolução de preço
                    </Text>
                  </Paper>
                </SimpleGrid>

                {/* Gráficos Analíticos do Produto */}
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between" mb="xs">
                      <div>
                        <Text fw={600} size="sm">
                          Evolução Histórica de Preços (R$/un)
                        </Text>
                        <Text size="xs" c="dimmed">
                          Tendência de preços cotados por rodada
                        </Text>
                      </div>
                      <Badge variant="light" color="teal" size="xs">
                        Linha Temporal
                      </Badge>
                    </Group>
                    {dadosGraficoEvolucaoProd.length > 0 ? (
                      <LineChart
                        h={240}
                        data={dadosGraficoEvolucaoProd}
                        dataKey="rodada"
                        series={seriesGraficoEvolucaoProd}
                        curveType="monotone"
                        valueFormatter={(value) => formatMoney(value)}
                        withLegend
                        withTooltip
                        strokeWidth={2}
                      />
                    ) : (
                      <Center h={240}>
                        <Text size="xs" c="dimmed">
                          Sem dados cronológicos suficientes para gerar o gráfico
                        </Text>
                      </Center>
                    )}
                  </Paper>

                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between" mb="xs">
                      <div>
                        <Text fw={600} size="sm">
                          Comparativo por Fornecedor (R$/un)
                        </Text>
                        <Text size="xs" c="dimmed">
                          Preço médio vs menor oferta por parceiro
                        </Text>
                      </div>
                      <Badge variant="light" color="indigo" size="xs">
                        Competitividade
                      </Badge>
                    </Group>
                    {dadosGraficoRankingProd.length > 0 ? (
                      <BarChart
                        h={240}
                        data={dadosGraficoRankingProd}
                        dataKey="fornecedor"
                        series={[
                          { name: 'menor_preco', color: 'teal.6', label: 'Menor Preço' },
                          { name: 'preco_medio', color: 'indigo.6', label: 'Preço Médio' },
                        ]}
                        valueFormatter={(value) => formatMoney(value)}
                        withLegend
                        withTooltip
                      />
                    ) : (
                      <Center h={240}>
                        <Text size="xs" c="dimmed">
                          Sem dados de fornecedores suficientes
                        </Text>
                      </Center>
                    )}
                  </Paper>
                </SimpleGrid>

                <Stack gap="xs">
                  <Title order={4} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconTruck size={20} />
                    Ranking de Fornecedores para este Produto
                  </Title>
                  <MantineReactTable table={tableRankingProd} />
                </Stack>

                <Stack gap="xs">
                  <Title order={4} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconHistory size={20} />
                    Histórico Cronológico de Cotações
                  </Title>
                  <MantineReactTable table={tableHistoricoProd} />
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Tabs.Panel>

        {/* ================================================================= */}
        {/* ABA 2: ESTATÍSTICAS POR FORNECEDOR */}
        {/* ================================================================= */}
        <Tabs.Panel value="fornecedor" pt="xs">
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="xs" fw={600}>
                Selecione o fornecedor para auditar histórico comercial:
              </Text>
              <AppSelect
                placeholder="Selecione o fornecedor"
                size="xs"
                data={fornecedores.map((f) => ({
                  value: f.id.toString(),
                  label: f.nome,
                }))}
                value={fornecedorSelecionadoId ? fornecedorSelecionadoId.toString() : null}
                onChange={handleSelectFornecedor}
                style={{ width: 280 }}
                allowDeselect={false}
              />
            </Group>

            {loadingFornStats ? (
              <Center p="xl">
                <Loader size="lg" />
              </Center>
            ) : estatisticasFornecedor ? (
              <Stack gap="xs">
                <Paper withBorder p="xs" radius="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <ThemeIcon size={28} radius="sm" color="teal" variant="light">
                        <IconTruck size={16} />
                      </ThemeIcon>
                      <div>
                        <Title order={4} style={{ fontSize: '0.95rem' }}>{estatisticasFornecedor.fornecedor.nome}</Title>
                        <Text size="11px" c="dimmed">
                          Pedido Mínimo:{' '}
                          <b>{formatMoney(estatisticasFornecedor.fornecedor.pedido_minimo)}</b>
                        </Text>
                      </div>
                    </Group>
                    <Badge size="xs" color="teal" variant="light">
                      {estatisticasFornecedor.total_cotacoes} cotações enviadas
                    </Badge>
                  </Group>
                </Paper>

                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xs">
                  <Paper withBorder p="xs" radius="sm">
                    <Group justify="space-between">
                      <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                        Volume Comprado (R$)
                      </Text>
                      <ThemeIcon color="teal" variant="light" size={24} radius="sm">
                        <IconCoins size={14} />
                      </ThemeIcon>
                    </Group>
                    <Title order={3} c="teal.8" style={{ fontSize: '1.2rem', marginTop: 2 }}>
                      {formatMoney(estatisticasFornecedor.volume_financeiro_alocado)}
                    </Title>
                    <Text size="10px" c="dimmed" mt={2}>
                      Total alocado
                    </Text>
                  </Paper>

                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Itens Ganhos / Alocados
                      </Text>
                      <ThemeIcon color="blue" variant="light" size="md">
                        <IconListCheck size={18} />
                      </ThemeIcon>
                    </Group>
                    <Title order={2} c="blue.8" mt="xs">
                      {estatisticasFornecedor.total_alocacoes} itens
                    </Title>
                    <Text size="xs" c="dimmed" mt={4}>
                      Decisões de compra
                    </Text>
                  </Paper>

                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        1º Lugares em Menor Preço
                      </Text>
                      <ThemeIcon color="yellow" variant="light" size="md">
                        <IconTrophy size={18} />
                      </ThemeIcon>
                    </Group>
                    <Title order={2} c="yellow.8" mt="xs">
                      {estatisticasFornecedor.primeiros_lugares_count} vezes
                    </Title>
                    <Text size="xs" c="dimmed" mt={4}>
                      Melhor oferta da rodada
                    </Text>
                  </Paper>

                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Taxa de Competitividade
                      </Text>
                      <ThemeIcon color="cyan" variant="light" size="md">
                        <IconChartBar size={18} />
                      </ThemeIcon>
                    </Group>
                    <Title order={2} c="cyan.8" mt="xs">
                      {estatisticasFornecedor.taxa_competitividade_pct.toFixed(0)}%
                    </Title>
                    <Text size="xs" c="dimmed" mt={4}>
                      % de vitórias em menor preço
                    </Text>
                  </Paper>
                </SimpleGrid>

                {/* Gráfico Analítico do Fornecedor */}
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="xs">
                    <div>
                      <Text fw={600} size="sm">
                        Cotações vs Alocações Efetivas por Rodada
                      </Text>
                      <Text size="xs" c="dimmed">
                        Volume de propostas enviadas vs itens comprados com este fornecedor
                      </Text>
                    </div>
                    <Badge variant="light" color="teal" size="xs">
                      Desempenho Comercial
                    </Badge>
                  </Group>
                  {dadosGraficoFornecedor.length > 0 ? (
                    <BarChart
                      h={240}
                      data={dadosGraficoFornecedor}
                      dataKey="rodada"
                      series={[
                        { name: 'total_cotacoes', color: 'blue.6', label: 'Cotações Enviadas' },
                        { name: 'total_alocados', color: 'teal.6', label: 'Itens Comprados / Ganhos' },
                      ]}
                      withLegend
                      withTooltip
                    />
                  ) : (
                    <Center h={240}>
                      <Text size="xs" c="dimmed">
                        Sem histórico de cotações para este fornecedor
                      </Text>
                    </Center>
                  )}
                </Paper>

                <Stack gap="xs">
                  <Title order={4} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconReceipt size={20} />
                    Catálogo de Produtos Cotados pelo Fornecedor
                  </Title>
                  <MantineReactTable table={tableHistoricoForn} />
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Tabs.Panel>

        {/* ================================================================= */}
        {/* ABA 3: HISTÓRICO GLOBAL COM FILTROS */}
        {/* ================================================================= */}
        <Tabs.Panel value="global" pt="lg">
          <Stack gap="md">
            {/* Barra de Filtros Multidimensionais */}
            <Paper withBorder p="md" radius="md">
              <Stack gap="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconFilter size={15} />
                  Filtros Combinados de Histórico
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                  <AppSelect
                    label="Categoria"
                    placeholder="Todas as Categorias"
                    data={categoriasUnicas}
                    value={filtroCategoria}
                    onChange={setFiltroCategoria}
                    clearable
                  />

                  <AppSelect
                    label="Fornecedor"
                    placeholder="Todos os Fornecedores"
                    data={fornecedores.map((f) => ({
                      value: f.id.toString(),
                      label: f.nome,
                    }))}
                    value={filtroFornecedor}
                    onChange={setFiltroFornecedor}
                    clearable
                  />

                  <AppSelect
                    label="Rodada"
                    placeholder="Todas as Rodadas"
                    data={rodadas.map((r) => ({
                      value: r.id.toString(),
                      label: r.descricao,
                    }))}
                    value={filtroRodada}
                    onChange={setFiltroRodada}
                    clearable
                  />

                  <AppSelect
                    label="Status da Compra"
                    placeholder="Todos os Status"
                    data={[
                      { value: 'comprado', label: '✓ Apenas Comprados' },
                      { value: 'apenas_cotado', label: 'Apenas Cotados' },
                    ]}
                    value={filtroStatusAlocacao}
                    onChange={setFiltroStatusAlocacao}
                    clearable
                  />
                </SimpleGrid>
              </Stack>
            </Paper>

            {/* Gráfico de Distribuição por Categoria */}
            {dadosGraficoCategoriasGlobal.length > 0 && (
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text fw={600} size="sm">
                      Distribuição de Cotações e Compras por Segmento / Categoria
                    </Text>
                    <Text size="xs" c="dimmed">
                      Comparativo de volume cotado vs comprado por segmento
                    </Text>
                  </div>
                  <Badge variant="light" color="indigo" size="xs">
                    Panorama Geral
                  </Badge>
                </Group>
                <BarChart
                  h={220}
                  data={dadosGraficoCategoriasGlobal}
                  dataKey="categoria"
                  series={[
                    { name: 'total_cotacoes', color: 'indigo.6', label: 'Total de Cotações' },
                    { name: 'total_comprados', color: 'teal.6', label: 'Itens Comprados' },
                  ]}
                  withLegend
                  withTooltip
                />
              </Paper>
            )}

            {loadingGlobal ? (
              <Center p="xl">
                <Loader size="lg" />
              </Center>
            ) : (
              <MantineReactTable table={tableGlobal} />
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

export default EstatisticasView
