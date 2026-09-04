import { useState, useMemo, useEffect } from 'react'
import {
  Badge,
  Center,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconHistory,
  IconPackage,
  IconReceipt,
  IconScale,
  IconSearch,
  IconTrophy,
  IconTruck,
} from '@tabler/icons-react'
import { LineChart, BarChart } from '@mantine/charts'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { AppAutocomplete } from '../../components/form/AppSelect'
import { getApi } from '../../services/api'
import type { EstatisticasProduto, Produto } from '../../types'
import { formatMoney } from './utils'
import { useEstatisticasColumns } from './useEstatisticasColumns'

interface Props {
  produtos: Produto[]
  themeColor: string
}

export function EstatisticasProdutoAba({ produtos, themeColor }: Props) {
  const [produtoBusca, setProdutoBusca] = useState<string>('')
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<number | null>(null)
  const [estatisticasProduto, setEstatisticasProduto] = useState<EstatisticasProduto | null>(null)
  const [loadingProdStats, setLoadingProdStats] = useState(false)

  const nomesProdutos = useMemo(() => produtos.map((p) => p.nome), [produtos])

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

  // Auto-selecionar o primeiro produto quando carregados e não há seleção
  useEffect(() => {
    if (produtos.length > 0 && !produtoSelecionadoId) {
      const primeiro = produtos[0]
      setProdutoSelecionadoId(primeiro.id)
      setProdutoBusca(primeiro.nome)
      carregarEstatisticasProduto(primeiro.id)
    }
  }, [produtos, produtoSelecionadoId])

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

  const { columnsHistoricoProd, columnsRankingProd } = useEstatisticasColumns()

  const tableHistoricoProd = useMantineReactTable({
    enableDensityToggle: false,
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

  const dadosGraficoEvolucaoProd = useMemo(() => {
    if (!estatisticasProduto || !estatisticasProduto.cotacoes_historico) return []

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

  const dadosGraficoRankingProd = useMemo(() => {
    if (!estatisticasProduto || !estatisticasProduto.ranking_fornecedores) return []
    return estatisticasProduto.ranking_fornecedores.map((r) => ({
      fornecedor: r.fornecedor_nome,
      preco_medio: r.preco_medio_oferecido,
      menor_preco: r.menor_preco_oferecido,
    }))
  }, [estatisticasProduto])

  return (
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
  )
}
