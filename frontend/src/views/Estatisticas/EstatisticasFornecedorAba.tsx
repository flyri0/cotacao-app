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
  IconChartBar,
  IconCoins,
  IconListCheck,
  IconReceipt,
  IconTrophy,
  IconTruck,
} from '@tabler/icons-react'
import { BarChart } from '@mantine/charts'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { AppSelect } from '../../components/form/AppSelect'
import { getApi } from '../../services/api'
import type { EstatisticasFornecedor, Fornecedor, Rodada } from '../../types'
import { formatMoney } from './utils'
import { useEstatisticasColumns } from './useEstatisticasColumns'

interface Props {
  fornecedores: Fornecedor[]
  rodadas: Rodada[]
}

export function EstatisticasFornecedorAba({ fornecedores, rodadas }: Props) {
  const [fornecedorSelecionadoId, setFornecedorSelecionadoId] = useState<number | null>(null)
  const [estatisticasFornecedor, setEstatisticasFornecedor] = useState<EstatisticasFornecedor | null>(null)
  const [loadingFornStats, setLoadingFornStats] = useState(false)

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

  useEffect(() => {
    if (fornecedores.length > 0 && !fornecedorSelecionadoId) {
      const primeiroForn = fornecedores[0]
      setFornecedorSelecionadoId(primeiroForn.id)
      carregarEstatisticasFornecedor(primeiroForn.id)
    }
  }, [fornecedores, fornecedorSelecionadoId])

  const handleSelectFornecedor = (val: string | null) => {
    if (val) {
      const id = parseInt(val, 10)
      setFornecedorSelecionadoId(id)
      carregarEstatisticasFornecedor(id)
    }
  }

  const { columnsHistoricoForn } = useEstatisticasColumns()

  const tableHistoricoForn = useMantineReactTable({
    enableDensityToggle: false,
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

  return (
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
  )
}
