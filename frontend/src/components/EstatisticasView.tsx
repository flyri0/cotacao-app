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

export function EstatisticasView() {
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
        api.listar_produtos(),
        api.listar_fornecedores(),
        api.listar_rodadas(),
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
      const stats = await api.obter_estatisticas_produto(idProduto)
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
      const stats = await api.obter_estatisticas_fornecedor(idFornecedor)
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
      const lista = await api.obter_historico_global_cotacoes()
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
        header: 'Rodada de Cotação',
        size: 220,
        Cell: ({ row }) => (
          <Stack gap={2}>
            <Text fw={600} size="sm">
              {row.original.rodada_descricao}
            </Text>
            <Text size="11px" c="dimmed">
              Data: {row.original.rodada_data}
            </Text>
          </Stack>
        ),
      },
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 180,
        Cell: ({ cell }) => (
          <Badge variant="outline" color="cyan" size="md">
            {cell.getValue<string>()}
          </Badge>
        ),
      },
      {
        accessorKey: 'marca',
        header: 'Marca',
        size: 130,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return val ? (
            <Badge variant="light" color="indigo">
              {val}
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          )
        },
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem Cotada',
        size: 160,
      },
      {
        accessorKey: 'qtd_por_embalagem',
        header: 'Qtd / Emb.',
        size: 120,
        Cell: ({ cell, row }) => (
          <Text size="sm">
            {cell.getValue<number>()}{' '}
            {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb. (R$)',
        size: 140,
        Cell: ({ cell }) => (
          <Text size="sm" fw={500}>
            {formatMoney(cell.getValue<number>(), 2)}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário Normalizado',
        size: 200,
        Cell: ({ cell, row }) => (
          <Badge color="teal" variant="filled" size="md">
            {formatMoney(cell.getValue<number>())} /{' '}
            {row.original.unidade || 'UN'}
          </Badge>
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
        size: 240,
        Cell: ({ cell }) => (
          <Group gap="xs">
            <ThemeIcon color="cyan" variant="light" size="sm">
              <IconTruck size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">
              {cell.getValue<string>()}
            </Text>
          </Group>
        ),
      },
      {
        accessorKey: 'total_ofertas',
        header: 'Cotações Enviadas',
        size: 160,
        Cell: ({ cell }) => (
          <Badge variant="light" color="blue" size="sm">
            {cell.getValue<number>()}{' '}
            {cell.getValue<number>() === 1 ? 'rodada' : 'rodadas'}
          </Badge>
        ),
      },
      {
        accessorKey: 'menor_preco_oferecido',
        header: 'Menor Preço Ofertado',
        size: 190,
        Cell: ({ cell }) => (
          <Badge variant="filled" color="teal" size="md">
            {formatMoney(cell.getValue<number>())}
          </Badge>
        ),
      },
      {
        accessorKey: 'preco_medio_oferecido',
        header: 'Preço Médio Praticado',
        size: 190,
        Cell: ({ cell }) => (
          <Text fw={600} size="sm" c="dimmed">
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
    ],
    [],
  )

  const tableHistoricoProd = useMantineReactTable({
    columns: columnsHistoricoProd,
    data: estatisticasProduto?.cotacoes_historico || [],
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    mantineTableProps: { striped: true, highlightOnHover: true, withTableBorder: true },
  })

  const tableRankingProd = useMantineReactTable({
    columns: columnsRankingProd,
    data: estatisticasProduto?.ranking_fornecedores || [],
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: false,
    enableBottomToolbar: false,
    enableTopToolbar: false,
    mantineTableProps: { striped: true, highlightOnHover: true, withTableBorder: true },
  })

  // =========================================================================
  // TABELA DA ABA 2 (FORNECEDOR)
  // =========================================================================
  const columnsHistoricoForn = useMemo<MRT_ColumnDef<CotacaoHistoricoItem>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto Ofertado',
        size: 220,
        Cell: ({ row }) => (
          <Stack gap={2}>
            <Text fw={600} size="sm">
              {row.original.produto_nome}
            </Text>
            {row.original.produto_categoria && (
              <Text size="11px" c="dimmed">
                {row.original.produto_categoria}
              </Text>
            )}
          </Stack>
        ),
      },
      {
        accessorKey: 'rodada_descricao',
        header: 'Rodada de Cotação',
        size: 200,
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem',
        size: 150,
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb. (R$)',
        size: 140,
        Cell: ({ cell }) => <Text size="sm">{formatMoney(cell.getValue<number>(), 2)}</Text>,
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário Normalizado',
        size: 190,
        Cell: ({ cell, row }) => (
          <Badge color="teal" variant="filled" size="md">
            {formatMoney(cell.getValue<number>())} /{' '}
            {row.original.unidade || 'UN'}
          </Badge>
        ),
      },
    ],
    [],
  )

  const tableHistoricoForn = useMantineReactTable({
    columns: columnsHistoricoForn,
    data: estatisticasFornecedor?.cotacoes_historico || [],
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    mantineTableProps: { striped: true, highlightOnHover: true, withTableBorder: true },
  })

  // =========================================================================
  // TABELA DA ABA 3 (HISTÓRICO GLOBAL COM FILTROS)
  // =========================================================================
  const dadosFiltradosGlobal = useMemo(() => {
    return historicoGlobal.filter((item) => {
      if (filtroCategoria && item.produto_categoria !== filtroCategoria) {
        return false
      }
      if (
        filtroFornecedor &&
        item.id_fornecedor.toString() !== filtroFornecedor
      ) {
        return false
      }
      if (filtroRodada && item.id_rodada.toString() !== filtroRodada) {
        return false
      }
      if (filtroStatusAlocacao === 'comprado' && !item.foi_alocado) {
        return false
      }
      if (filtroStatusAlocacao === 'apenas_cotado' && item.foi_alocado) {
        return false
      }
      return true
    })
  }, [
    historicoGlobal,
    filtroCategoria,
    filtroFornecedor,
    filtroRodada,
    filtroStatusAlocacao,
  ])

  const columnsGlobal = useMemo<MRT_ColumnDef<HistoricoGlobalCotacaoItem>[]>(
    () => [
      {
        accessorKey: 'rodada_descricao',
        header: 'Rodada',
        size: 180,
      },
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 220,
        Cell: ({ row }) => (
          <Stack gap={2}>
            <Text fw={600} size="sm">
              {row.original.produto_nome}
            </Text>
            {row.original.produto_categoria && (
              <Badge size="xs" color="gray" variant="light">
                {row.original.produto_categoria}
              </Badge>
            )}
          </Stack>
        ),
      },
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 180,
        Cell: ({ cell }) => (
          <Badge color="cyan" variant="outline" size="sm">
            {cell.getValue<string>()}
          </Badge>
        ),
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem',
        size: 150,
        Cell: ({ row }) => (
          <Text size="sm">
            {row.original.marca ? `[${row.original.marca}] ` : ''}{row.original.embalagem}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb.',
        size: 130,
        Cell: ({ cell }) => <Text size="sm">{formatMoney(cell.getValue<number>(), 2)}</Text>,
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário',
        size: 160,
        Cell: ({ cell, row }) => (
          <Text fw={700} size="sm" c="teal.8">
            {formatMoney(cell.getValue<number>())} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        accessorKey: 'foi_alocado',
        header: 'Status Compra',
        size: 150,
        Cell: ({ cell }) => {
          const comprado = !!cell.getValue<boolean>()
          return comprado ? (
            <Badge color="teal" variant="filled" size="sm">
              ✓ Comprado
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="sm">
              Cotado
            </Badge>
          )
        },
      },
    ],
    [],
  )

  const tableGlobal = useMantineReactTable({
    columns: columnsGlobal,
    data: dadosFiltradosGlobal,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    mantinePaperProps: {
      withBorder: true,
      radius: 'md',
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
    <Stack gap="md" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <PageHeader
        icon={IconHistory}
        iconColor="violet"
        title="Central de Estatísticas & Histórico"
        subtitle="Análise multidimensional de preços históricos, compras por fornecedor e filtros avançados"
      />

      {/* Tabs Principais */}
      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
        <Tabs.List>
          <Tabs.Tab value="produto" leftSection={<IconPackage size={16} />}>
            Estatísticas por Produto
          </Tabs.Tab>
          <Tabs.Tab value="fornecedor" leftSection={<IconTruck size={16} />}>
            Estatísticas por Fornecedor
          </Tabs.Tab>
          <Tabs.Tab value="global" leftSection={<IconFilter size={16} />}>
            Histórico Global de Compras & Filtros
          </Tabs.Tab>
        </Tabs.List>

        {/* ================================================================= */}
        {/* ABA 1: ESTATÍSTICAS POR PRODUTO */}
        {/* ================================================================= */}
        <Tabs.Panel value="produto" pt="lg">
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Pesquise e selecione um produto para auditar seu histórico:
              </Text>
              <AppAutocomplete
                placeholder="Digite o nome do produto..."
                data={nomesProdutos}
                value={produtoBusca}
                onChange={setProdutoBusca}
                onOptionSubmit={handleSelectProdutoNome}
                style={{ width: 340 }}
                limit={8}
                leftSection={<IconSearch size={16} />}
              />
            </Group>

            {loadingProdStats ? (
              <Center p="xl">
                <Loader size="lg" />
              </Center>
            ) : estatisticasProduto ? (
              <Stack gap="lg">
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" align="center">
                    <Group>
                      <ThemeIcon size="xl" radius="md" color="indigo" variant="light">
                        <IconPackage size={26} />
                      </ThemeIcon>
                      <div>
                        <Title order={3}>{estatisticasProduto.produto.nome}</Title>
                        <Group gap="xs" mt={2}>
                          {estatisticasProduto.produto.categoria ? (
                            <Badge color="teal" variant="dot">
                              {estatisticasProduto.produto.categoria}
                            </Badge>
                          ) : (
                            <Badge color="gray" variant="light">
                              Geral
                            </Badge>
                          )}
                        </Group>
                      </div>
                    </Group>
                    <Badge size="lg" color="blue" variant="light">
                      {estatisticasProduto.total_cotacoes} cotações em{' '}
                      {estatisticasProduto.total_rodadas} rodadas
                    </Badge>
                  </Group>
                </Paper>

                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Menor Preço Histórico
                      </Text>
                      <ThemeIcon color="teal" variant="light" size="md">
                        <IconTrophy size={18} />
                      </ThemeIcon>
                    </Group>
                    <Title order={2} c="teal.8" mt="xs">
                      {estatisticasProduto.menor_preco > 0
                        ? formatMoney(estatisticasProduto.menor_preco)
                        : 'R$ 0,00'}
                    </Title>
                    <Text size="xs" c="dimmed" mt={4} lineClamp={1}>
                      {estatisticasProduto.melhor_fornecedor
                        ? `Fornecido por ${estatisticasProduto.melhor_fornecedor}`
                        : 'Sem cotações'}
                    </Text>
                  </Paper>

                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Preço Médio Histórico
                      </Text>
                      <ThemeIcon color="blue" variant="light" size="md">
                        <IconScale size={18} />
                      </ThemeIcon>
                    </Group>
                    <Title order={2} c="blue.8" mt="xs">
                      {estatisticasProduto.preco_medio > 0
                        ? formatMoney(estatisticasProduto.preco_medio)
                        : 'R$ 0,00'}
                    </Title>
                    <Text size="xs" c="dimmed" mt={4}>
                      Média geral de cotações
                    </Text>
                  </Paper>

                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Maior Preço Registrado
                      </Text>
                      <ThemeIcon color="red" variant="light" size="md">
                        <IconReceipt size={18} />
                      </ThemeIcon>
                    </Group>
                    <Title order={2} c="red.8" mt="xs">
                      {estatisticasProduto.maior_preco > 0
                        ? formatMoney(estatisticasProduto.maior_preco)
                        : 'R$ 0,00'}
                    </Title>
                    <Text size="xs" c="dimmed" mt={4}>
                      Teto máximo
                    </Text>
                  </Paper>

                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Variação Cronológica
                      </Text>
                      <ThemeIcon
                        color={
                          estatisticasProduto.variacao_percentual <= 0
                            ? 'teal'
                            : 'orange'
                        }
                        variant="light"
                        size="md"
                      >
                        {estatisticasProduto.variacao_percentual <= 0 ? (
                          <IconArrowDownRight size={18} />
                        ) : (
                          <IconArrowUpRight size={18} />
                        )}
                      </ThemeIcon>
                    </Group>
                    <Title
                      order={2}
                      c={
                        estatisticasProduto.variacao_percentual <= 0
                          ? 'teal.8'
                          : 'orange.8'
                      }
                      mt="xs"
                    >
                      {estatisticasProduto.variacao_percentual > 0 ? '+' : ''}
                      {estatisticasProduto.variacao_percentual.toFixed(1)}%
                    </Title>
                    <Text size="xs" c="dimmed" mt={4}>
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
        <Tabs.Panel value="fornecedor" pt="lg">
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Selecione o fornecedor para auditar histórico comercial:
              </Text>
              <AppSelect
                placeholder="Selecione o fornecedor"
                data={fornecedores.map((f) => ({
                  value: f.id.toString(),
                  label: f.nome,
                }))}
                value={fornecedorSelecionadoId ? fornecedorSelecionadoId.toString() : null}
                onChange={handleSelectFornecedor}
                style={{ width: 320 }}
                allowDeselect={false}
              />
            </Group>

            {loadingFornStats ? (
              <Center p="xl">
                <Loader size="lg" />
              </Center>
            ) : estatisticasFornecedor ? (
              <Stack gap="lg">
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" align="center">
                    <Group>
                      <ThemeIcon size="xl" radius="md" color="teal" variant="light">
                        <IconTruck size={26} />
                      </ThemeIcon>
                      <div>
                        <Title order={3}>{estatisticasFornecedor.fornecedor.nome}</Title>
                        <Text size="xs" c="dimmed">
                          Pedido Mínimo:{' '}
                          <b>{formatMoney(estatisticasFornecedor.fornecedor.pedido_minimo)}</b>
                        </Text>
                      </div>
                    </Group>
                    <Badge size="lg" color="teal" variant="light">
                      {estatisticasFornecedor.total_cotacoes} cotações enviadas
                    </Badge>
                  </Group>
                </Paper>

                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Volume Comprado (R$)
                      </Text>
                      <ThemeIcon color="teal" variant="light" size="md">
                        <IconCoins size={18} />
                      </ThemeIcon>
                    </Group>
                    <Title order={2} c="teal.8" mt="xs">
                      {formatMoney(estatisticasFornecedor.volume_financeiro_alocado)}
                    </Title>
                    <Text size="xs" c="dimmed" mt={4}>
                      Total de compras efetivas
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
