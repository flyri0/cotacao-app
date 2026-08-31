import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
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
import { MRT_Localization_PT_BR } from '../locales/mrtPtBr'
import { PageHeader } from './common/PageHeader'
import { RoundHeaderSelector } from './common/RoundHeaderSelector'
import { StatCard } from './common/StatCard'
import { getApi } from '../services/api'
import type { Alocacao, Cotacao, Fornecedor, Rodada } from '../types'

function formatMoney(valor: number, maxDigits = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

interface ResumoViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
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

export function ResumoView({ rodadaAtivaId, onRodadaChange }: ResumoViewProps) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [loading, setLoading] = useState(true)

  const carregarDados = async (rodadaId?: number) => {
    try {
      setLoading(true)
      const api = await getApi()
      const [listaRodadas, listaFornecedores] = await Promise.all([
        api.listar_rodadas(),
        api.listar_fornecedores(),
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
          api.listar_cotacoes(idAlvo),
          api.listar_alocacoes(idAlvo),
        ])

        setCotacoes(listaCot)
        setAlocacoes(listaAloc)
      }
    } catch (error) {
      console.error('Erro ao carregar dados do resumo:', error)
      notifications.show({
        title: 'Erro de comunicação',
        message: 'Não foi possível carregar as informações do resumo.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados(selectedRodadaId || undefined)
  }, [])

  // Resumo Financeiro por Fornecedor
  const dadosFornecedores = useMemo<ResumoFornecedorRow[]>(() => {
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
        const fator = cot && cot.qtd_por_embalagem > 0 ? cot.qtd_por_embalagem : 1
        const precoEmb = cot ? cot.preco_embalagem : 0
        const embComprar = Math.ceil(aloc.quantidade / fator)
        const subtotal = embComprar * precoEmb

        totalAlocado += subtotal

        itensDetalhes.push({
          produto_nome: aloc.produto_nome,
          quantidade: aloc.quantidade,
          unidade: aloc.produto_unidade_padrao,
          embalagens: embComprar,
          embalagem_desc: cot ? cot.embalagem : 'Unidade',
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
  }, [fornecedores, alocacoes, cotacoes])

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
        size: 220,
        Cell: ({ cell, row }) => (
          <Stack gap={2}>
            <Text fw={700} size="sm">
              {cell.getValue<string>()}
            </Text>
            <Text size="xs" c="dimmed">
              {row.original.itens_comprados_count}{' '}
              {row.original.itens_comprados_count === 1 ? 'item alocado' : 'itens alocados'}
            </Text>
          </Stack>
        ),
      },
      {
        accessorKey: 'total_alocado',
        header: 'Total Alocado (R$)',
        size: 170,
        Cell: ({ cell, row }) => (
          <Text
            fw={700}
            size="sm"
            c={
              row.original.status === 'ok'
                ? 'teal.8'
                : row.original.status === 'abaixo'
                ? 'red.7'
                : 'dimmed'
            }
          >
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
      {
        accessorKey: 'pedido_minimo',
        header: 'Pedido Mínimo (R$)',
        size: 160,
        Cell: ({ cell }) => (
          <Text size="sm">
            {cell.getValue<number>() > 0
              ? formatMoney(cell.getValue<number>())
              : 'Sem mínimo'}
          </Text>
        ),
      },
      {
        id: 'progresso',
        header: 'Meta Mínima',
        size: 220,
        Cell: ({ row }) => {
          const { pedido_minimo, total_alocado, percentual_atingido, status } =
            row.original

          if (pedido_minimo === 0) {
            return (
              <Badge variant="light" color="gray" size="sm">
                Livre
              </Badge>
            )
          }

          const color =
            status === 'ok' ? 'teal' : status === 'abaixo' ? 'red' : 'gray'

          return (
            <Stack gap={4} style={{ width: '100%' }}>
              <Group justify="space-between" gap="xs">
                <Text size="11px" fw={600} c={`${color}.8`}>
                  {percentual_atingido.toFixed(0)}%
                </Text>
                <Text size="11px" c="dimmed">
                  {formatMoney(total_alocado)} / {formatMoney(pedido_minimo)}
                </Text>
              </Group>
              <Progress
                value={percentual_atingido}
                color={color}
                size="sm"
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
        header: 'Status Pedido Mínimo',
        size: 240,
        Cell: ({ row }) => {
          const { status, diferenca } = row.original

          if (status === 'ok') {
            return (
              <Badge
                leftSection={<IconCheck size={14} />}
                color="teal"
                variant="filled"
                size="md"
              >
                Bateu Mínimo {diferenca > 0 && `(+${formatMoney(diferenca)})`}
              </Badge>
            )
          }

          if (status === 'abaixo') {
            return (
              <Badge
                leftSection={<IconAlertTriangle size={14} />}
                color="red"
                variant="filled"
                size="md"
              >
                Abaixo do Mínimo (Falta {formatMoney(Math.abs(diferenca))})
              </Badge>
            )
          }

          return (
            <Badge color="gray" variant="light" size="sm">
              Sem Compras
            </Badge>
          )
        },
      },
    ],
    [],
  )

  const tableFornecedores = useMantineReactTable({
    columns: columnsFornecedores,
    data: dadosFornecedores,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: false,
    enableBottomToolbar: false,
    enableTopToolbar: false,
    renderDetailPanel: ({ row }) => {
      const { itens_detalhes, fornecedor_nome } = row.original
      if (!itens_detalhes || itens_detalhes.length === 0) {
        return (
          <Text size="xs" c="dimmed" p="sm">
            Nenhum item alocado para este fornecedor.
          </Text>
        )
      }
      return (
        <Paper p="xs" withBorder radius="sm" bg="var(--mantine-color-body)" m="xs">
          <Text size="xs" fw={700} mb="xs" c="dimmed" tt="uppercase">
            Itens alocados para {fornecedor_nome} ({itens_detalhes.length})
          </Text>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Qtd Alocada</Table.Th>
                <Table.Th>Embalagens Fechadas</Table.Th>
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
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: true,
    },
    mantinePaperProps: {
      withBorder: true,
      radius: 'md',
      shadow: 'none',
    },
  })

  return (
    <Stack gap="md" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <PageHeader
        icon={IconChartBar}
        iconColor="indigo"
        title="Resumo por Fornecedor"
        subtitle="Acompanhamento consolidado de valores alocados e atingimento do pedido mínimo por fornecedor"
        rightSection={
          <RoundHeaderSelector
            rodadas={rodadas}
            selectedRodadaId={selectedRodadaId}
            onSelectRodada={(id) => {
              setSelectedRodadaId(id)
              onRodadaChange?.(id)
              carregarDados(id)
            }}
          />
        }
      />

      {/* Cartões KPIs */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard
          label="Valor Total do Pedido"
          value={formatMoney(metricas.totalFinanceiro)}
          subtitle="Total consolidado em embalagens fechadas"
          icon={IconScale}
          color="teal"
        />

        <StatCard
          label="Fornecedores Aptos (Pedido Mínimo)"
          value={`${metricas.fornecedoresAptosCount} de ${metricas.fornecedoresAtivosCount}`}
          subtitle={
            metricas.fornecedoresAbaixoCount > 0
              ? `⚠️ ${metricas.fornecedoresAbaixoCount} fornecedor(es) abaixo do mínimo!`
              : '✓ Todos os fornecedores ativos atingiram o mínimo'
          }
          icon={IconTruck}
          color={metricas.fornecedoresAbaixoCount > 0 ? 'red' : 'teal'}
          badge={{
            label: metricas.fornecedoresAbaixoCount > 0 ? 'Abaixo do Mínimo' : 'Todos Aprovados',
            color: metricas.fornecedoresAbaixoCount > 0 ? 'red' : 'teal',
          }}
        />

        <StatCard
          label="Total de Itens Alocados"
          value={`${metricas.totalItensAlocados}`}
          subtitle={`${metricas.fornecedoresAtivosCount} fornecedor(es) com compras ativas`}
          icon={IconPackage}
          color="indigo"
        />
      </SimpleGrid>

      {/* Tabela de Resumo Financeiro por Fornecedor */}
      <Stack gap="xs" mt="xs">
        {loading ? (
          <Center p="xl">
            <Loader size="lg" />
          </Center>
        ) : (
          <MantineReactTable table={tableFornecedores} />
        )}
      </Stack>
    </Stack>
  )
}

export default ResumoView

