import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  Box,
  Center,
  Group,
  Loader,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle,
  IconCheck,
  IconChartBar,
  IconPackage,
  IconScale,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import { PageHeader, RoundHeaderSelector, StatCard } from './common'
import { calculatePackaging, formatMoney, getVirtualizedTableProps, memoizeByRef } from '../utils'
import { getApi } from '../services/api'
import { useDataCacheSubscription } from '../hooks'
import type { Alocacao, Cotacao, Fornecedor, Rodada } from '../types'

interface ResumoViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
  themeColor?: string
}

interface ResumoFornecedorRow {
  id_fornecedor: number
  fornecedor_nome: string
  pedido_minimo: number
  total_alocado: number
  diferenca: number
  percentual_atingido: number
  status: 'ok' | 'abaixo' | 'sem_compras'
  itens_comprados_count: number
  itens_detalhes: {
    produto_nome: string
    quantidade: number
    unidade: string
    embalagens: number
    embalagem_desc: string
    subtotal: number
  }[]
}

/**
 * Junção pesada (aloc x cotação por fornecedor). Memoizada por identidade de
 * (fornecedores, alocacoes, cotacoes) em escopo de módulo — ver memoizeByRef.
 */
const calcularDadosFornecedores = memoizeByRef(
  (
    fornecedores: Fornecedor[],
    alocacoes: Alocacao[],
    cotacoes: Cotacao[],
  ): ResumoFornecedorRow[] => {
    return fornecedores.map((forn) => {
      const alocsDoForn = alocacoes.filter(
        (a) => a.id_fornecedor === forn.id && a.quantidade > 0,
      )

      let totalAlocado = 0
      const itensDetalhes: ResumoFornecedorRow['itens_detalhes'] = []

      alocsDoForn.forEach((aloc) => {
        const cot = cotacoes.find(
          (c) =>
            c.id_produto === aloc.id_produto &&
            c.id_fornecedor === forn.id,
        )
        const { embComprar, subtotal } = calculatePackaging(
          aloc.quantidade,
          cot?.qtd_por_embalagem,
          cot?.preco_embalagem,
        )

        totalAlocado += subtotal

        itensDetalhes.push({
          produto_nome: aloc.produto_nome,
          quantidade: aloc.quantidade,
          unidade: cot ? cot.unidade : (aloc.unidade || 'UN'),
          embalagens: embComprar,
          embalagem_desc: cot ? `${cot.marca ? `[${cot.marca}] ` : ''}${cot.embalagem}` : 'Unidade',
          subtotal,
        })
      })

      const pedidoMin = forn.pedido_minimo || 0
      const diferenca = totalAlocado - pedidoMin
      const percentual =
        pedidoMin > 0
          ? Math.min(100, (totalAlocado / pedidoMin) * 100)
          : totalAlocado > 0
          ? 100
          : 0

      let status: ResumoFornecedorRow['status'] = 'sem_compras'
      if (totalAlocado > 0) {
        status = pedidoMin === 0 || totalAlocado >= pedidoMin ? 'ok' : 'abaixo'
      }

      return {
        id_fornecedor: forn.id,
        fornecedor_nome: forn.nome,
        pedido_minimo: pedidoMin,
        total_alocado: totalAlocado,
        diferenca,
        percentual_atingido: percentual,
        status,
        itens_comprados_count: alocsDoForn.length,
        itens_detalhes: itensDetalhes,
      }
    })
  },
)

export function ResumoView({
  rodadaAtivaId,
  onRodadaChange,
  themeColor = 'blue',
}: ResumoViewProps) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [loading, setLoading] = useState(true)

  const carregarDados = async (rodadaId?: number, silent = false) => {
    try {
      if (!silent) setLoading(true)
      const api = await getApi()
      const [listaRodadas, listaFornecedores] = await Promise.all([
        api.list_rounds(),
        api.list_suppliers(),
      ])

      setRodadas(listaRodadas)
      setFornecedores(listaFornecedores)

      let idAlvo = rodadaId || selectedRodadaId
      if (!idAlvo && listaRodadas.length > 0) {
        idAlvo = listaRodadas[0].id
        setSelectedRodadaId(idAlvo)
        onRodadaChange?.(idAlvo)
      }

      if (idAlvo) {
        const [listaCot, listaAloc] = await Promise.all([
          api.list_quotes(idAlvo),
          api.list_allocations(idAlvo),
        ])

        setCotacoes(listaCot)
        setAlocacoes(listaAloc)
      }
    } catch (error) {
      console.error('Erro ao carregar dados do resumo:', error)
      if (!silent) {
        notifications.show({
          title: 'Erro de comunicação',
          message: 'Não foi possível carregar as informações do resumo.',
          color: 'red',
          icon: <IconX size={16} />,
        })
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados(selectedRodadaId || undefined)
  }, [])

  useDataCacheSubscription(
    ['allocations', 'quotes', 'suppliers', 'rounds'],
    () => {
      carregarDados(selectedRodadaId || undefined, true)
    },
    [selectedRodadaId],
  )

  // Resumo Financeiro por Fornecedor
  const dadosFornecedores = useMemo<ResumoFornecedorRow[]>(
    () => calcularDadosFornecedores(fornecedores, alocacoes, cotacoes),
    [fornecedores, alocacoes, cotacoes],
  )

  // Indicadores Gerais (KPIs)
  const metricas = useMemo(() => {
    const totalFinanceiro = dadosFornecedores.reduce(
      (acc, f) => acc + f.total_alocado,
      0,
    )

    const fornecedoresAtivos = dadosFornecedores.filter((f) => f.total_alocado > 0)
    const fornecedoresAptos = dadosFornecedores.filter((f) => f.status === 'ok')
    const fornecedoresAbaixo = dadosFornecedores.filter(
      (f) => f.status === 'abaixo',
    )
    const totalItensAlocados = dadosFornecedores.reduce(
      (acc, f) => acc + f.itens_comprados_count,
      0,
    )

    return {
      totalFinanceiro,
      fornecedoresAtivosCount: fornecedoresAtivos.length,
      fornecedoresAptosCount: fornecedoresAptos.length,
      fornecedoresAbaixoCount: fornecedoresAbaixo.length,
      totalItensAlocados,
    }
  }, [dadosFornecedores])

  // Colunas da Tabela de Fornecedores
  const columnsFornecedores = useMemo<MRT_ColumnDef<ResumoFornecedorRow>[]>(
    () => [
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 200,
        Cell: ({ cell, row }) => (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <Text fw={600} size="xs" truncate="end">
              {cell.getValue<string>()}
            </Text>
            <Text size="10px" c="dimmed" truncate="end">
              {row.original.itens_comprados_count}{' '}
              {row.original.itens_comprados_count === 1 ? 'item alocado' : 'itens alocados'}
            </Text>
          </div>
        ),
      },
      {
        accessorKey: 'total_alocado',
        header: 'Total Alocado',
        size: 140,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell, row }) => (
          <Text
            fw={700}
            size="xs"
            c={
              row.original.status === 'ok'
                ? 'teal'
                : row.original.status === 'abaixo'
                ? 'red'
                : 'dimmed'
            }
          >
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
      {
        accessorKey: 'pedido_minimo',
        header: 'Pedido Mínimo',
        size: 140,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs" c={cell.getValue<number>() > 0 ? undefined : 'dimmed'}>
            {cell.getValue<number>() > 0
              ? formatMoney(cell.getValue<number>())
              : 'Sem mínimo'}
          </Text>
        ),
      },
      {
        id: 'progresso',
        header: 'Meta Mínima',
        size: 180,
        Cell: ({ row }) => {
          const { pedido_minimo, total_alocado, percentual_atingido, status } =
            row.original

          if (pedido_minimo === 0) {
            return (
              <Badge variant="light" color="gray" size="xs">
                Livre
              </Badge>
            )
          }

          const color =
            status === 'ok' ? 'teal' : status === 'abaixo' ? 'red' : 'gray'

          return (
            <Stack gap={2} style={{ width: '100%', overflow: 'hidden' }}>
              <Group justify="space-between" gap="xs">
                <Text size="10px" fw={600} c={`${color}.8`}>
                  {percentual_atingido.toFixed(0)}%
                </Text>
                <Text size="10px" c="dimmed">
                  {formatMoney(total_alocado)} / {formatMoney(pedido_minimo)}
                </Text>
              </Group>
              <Progress
                value={percentual_atingido}
                color={color}
                size="xs"
                radius="xl"
                striped={status === 'abaixo'}
                animated={status === 'abaixo'}
              />
            </Stack>
          )
        },
      },
      {
        id: 'status_minimo',
        header: 'Status do Mínimo',
        size: 180,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const { status, diferenca } = row.original

          if (status === 'ok') {
            return (
              <Badge
                leftSection={<IconCheck size={10} />}
                color="teal"
                variant="light"
                size="xs"
              >
                Atingido
              </Badge>
            )
          }

          if (status === 'abaixo') {
            return (
              <Badge
                leftSection={<IconAlertTriangle size={10} />}
                color="red"
                variant="light"
                size="xs"
              >
                Falta {formatMoney(Math.abs(diferenca))}
              </Badge>
            )
          }

          return (
            <Badge color="gray" variant="light" size="xs">
              Sem Compras
            </Badge>
          )
        },
      },
    ],
    [],
  )

  const tableFornecedores = useMantineReactTable({
    ...getVirtualizedTableProps<ResumoFornecedorRow>({
      enableTopToolbar: false,
      enableRowVirtualization: true,
    }),
    getRowId: (row) => String(row.id_fornecedor),
    columns: columnsFornecedores,
    data: dadosFornecedores,
    renderDetailPanel: ({ row }) => {
      const { itens_detalhes, fornecedor_nome } = row.original
      if (!itens_detalhes || itens_detalhes.length === 0) {
        return (
          <Text size="xs" c="dimmed" p="xs">
            Nenhum item alocado para este fornecedor.
          </Text>
        )
      }

      return (
        <Paper p="xs" withBorder radius="xs" bg="var(--mantine-color-default-hover)">
          <Text size="xs" fw={700} mb="xs">
            Itens Alocados para {fornecedor_nome}:
          </Text>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Qtd Solicitada</Table.Th>
                <Table.Th>Compra Efetiva (Embalagem)</Table.Th>
                <Table.Th>Subtotal</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens_detalhes.map((item, idx) => (
                <Table.Tr key={idx}>
                  <Table.Td>
                    <b>{item.produto_nome}</b>
                  </Table.Td>
                  <Table.Td>
                    {item.quantidade} {item.unidade}
                  </Table.Td>
                  <Table.Td>
                    {item.embalagens}x ({item.embalagem_desc})
                  </Table.Td>
                  <Table.Td>
                    <b>{formatMoney(item.subtotal)}</b>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )
    },
  })

  return (
    <Stack
      gap="xs"
      style={{
        width: '100%',
        height: 'calc(100vh - 68px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box style={{ flexShrink: 0 }}>
        {/* Cabeçalho */}
        <PageHeader
          icon={IconChartBar}
          iconColor={themeColor}
          title="Resumo por Fornecedor"
          subtitle="Acompanhamento consolidado de valores alocados e pedidos mínimos"
          rightSection={
            <RoundHeaderSelector
              rodadas={rodadas}
              selectedRodadaId={selectedRodadaId}
              themeColor={themeColor}
              onSelectRodada={(id) => {
                setSelectedRodadaId(id)
                onRodadaChange?.(id)
                carregarDados(id)
              }}
            />
          }
        />
      </Box>

      {/* Cartões KPIs */}
      <Box style={{ flexShrink: 0 }}>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
          <StatCard
            label="Total do Pedido"
            value={formatMoney(metricas.totalFinanceiro)}
            subtitle="Consolidado em embalagens fechadas"
            icon={IconScale}
            color="teal"
            badge={{ label: 'Embalagens Fechadas', color: 'teal' }}
          />

          <StatCard
            label="Fornecedores Aptos"
            value={`${metricas.fornecedoresAptosCount} de ${metricas.fornecedoresAtivosCount}`}
            subtitle={
              metricas.fornecedoresAbaixoCount > 0
                ? `⚠️ ${metricas.fornecedoresAbaixoCount} abaixo do mínimo!`
                : '✓ Todos atingiram o pedido mínimo'
            }
            icon={IconTruck}
            color={metricas.fornecedoresAbaixoCount > 0 ? 'red' : 'teal'}
            badge={{
              label: metricas.fornecedoresAbaixoCount > 0 ? 'Abaixo Mínimo' : 'Aprovados',
              color: metricas.fornecedoresAbaixoCount > 0 ? 'red' : 'teal',
            }}
          />

          <StatCard
            label="Itens Alocados"
            value={`${metricas.totalItensAlocados}`}
            subtitle={`${metricas.fornecedoresAtivosCount} fornecedor(es) com compras`}
            icon={IconPackage}
            color={themeColor}
            badge={{ label: `${metricas.fornecedoresAtivosCount} Fornecedores`, color: themeColor }}
          />
        </SimpleGrid>
      </Box>

      {/* Tabela de Resumo Financeiro por Fornecedor */}
      <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading ? (
          <Center p="xl" style={{ flex: 1 }}>
            <Loader size="lg" />
          </Center>
        ) : (
          <MantineReactTable table={tableFornecedores} />
        )}
      </Box>
    </Stack>
  )
}

export default ResumoView

