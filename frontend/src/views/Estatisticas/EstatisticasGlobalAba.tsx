import { useState, useMemo, useEffect } from 'react'
import { Badge, Center, Group, Loader, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconFilter } from '@tabler/icons-react'
import { BarChart } from '@mantine/charts'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { AppSelect } from '../../components/form/AppSelect'
import { getApi } from '../../services/api'
import type { Fornecedor, Produto, Rodada, HistoricoGlobalCotacaoItem } from '../../types'
import { useEstatisticasColumns } from './useEstatisticasColumns'

interface Props {
  fornecedores: Fornecedor[]
  produtos: Produto[]
  rodadas: Rodada[]
}

export function EstatisticasGlobalAba({ fornecedores, produtos, rodadas }: Props) {
  const [historicoGlobal, setHistoricoGlobal] = useState<HistoricoGlobalCotacaoItem[]>([])
  const [loadingGlobal, setLoadingGlobal] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [filtroFornecedor, setFiltroFornecedor] = useState<string | null>(null)
  const [filtroRodada, setFiltroRodada] = useState<string | null>(null)
  const [filtroStatusAlocacao, setFiltroStatusAlocacao] = useState<string | null>(null)

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
    carregarHistoricoGlobal()
  }, [])

  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>()
    produtos.forEach((p) => {
      if (p.categoria) cats.add(p.categoria)
    })
    return Array.from(cats)
  }, [produtos])

  const dadosFiltradosGlobal = useMemo(() => {
    return historicoGlobal.filter((item) => {
      if (filtroCategoria && item.produto_categoria !== filtroCategoria) {
        return false
      }
      if (filtroFornecedor && item.fornecedor_nome !== filtroFornecedor) {
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
  }, [historicoGlobal, filtroCategoria, filtroFornecedor, filtroStatusAlocacao])

  const { columnsGlobal } = useEstatisticasColumns()

  const tableGlobal = useMantineReactTable({
    enableDensityToggle: false,
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
    <Stack gap="md">
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
  )
}
