import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  Center,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
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
import type { Alocacao, Cotacao, Fornecedor, Necessidade, Rodada } from '../types'

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

interface ResumoProdutoRow {
  id_produto: number
  produto_nome: string
  produto_categoria?: string | null
  produto_unidade_padrao: string
  quantidade_necessaria: number
  quantidade_alocada_nominal: number
  quantidade_efetiva_comprada: number
  sobra_embalagem: number
  subtotal_item: number
  status: 'ok' | 'excedente' | 'falta_cobrir'
  status_detalhe: string
  detalhe_fornecedores: {
    fornecedor_nome: string
    quantidade: number
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
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
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
        const [listaNec, listaCot, listaAloc] = await Promise.all([
          api.listar_necessidades(idAlvo),
          api.listar_cotacoes(idAlvo),
          api.listar_alocacoes(idAlvo),
        ])

        setNecessidades(listaNec)
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

  // CÁLCULOS 1: Resumo Financeiro por Fornecedor
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

  // CÁLCULOS 2: Conferência por Produto (Necessidades vs. Múltiplas Alocações)
  const dadosProdutos = useMemo<ResumoProdutoRow[]>(() => {
    return necessidades.map((nec) => {
      const alocsDoProd = alocacoes.filter(
        (a) => a.id_produto === nec.id_produto && a.quantidade > 0,
      )

      let totalAlocadoNominal = 0
      let totalEfetivoComprado = 0
      let subtotalItem = 0
      const detalheFornecedores: ResumoProdutoRow['detalhe_fornecedores'] = []

      alocsDoProd.forEach((aloc) => {
        totalAlocadoNominal += aloc.quantidade

        const cot = cotacoes.find(
          (c) =>
            c.id_produto === aloc.id_produto &&
            c.id_fornecedor === aloc.id_fornecedor,
        )
        const fator = cot && cot.qtd_por_embalagem > 0 ? cot.qtd_por_embalagem : 1
        const precoEmb = cot ? cot.preco_embalagem : 0
        const embComprar = Math.ceil(aloc.quantidade / fator)
        const efetivo = embComprar * fator
        const subtotal = embComprar * precoEmb

        totalEfetivoComprado += efetivo
        subtotalItem += subtotal

        detalheFornecedores.push({
          fornecedor_nome: aloc.fornecedor_nome || 'Fornecedor',
          quantidade: aloc.quantidade,
          embalagens: embComprar,
          embalagem_desc: cot ? cot.embalagem : 'Unidade',
          subtotal,
        })
      })

      const sobra = Math.max(0, totalEfetivoComprado - totalAlocadoNominal)
      const qtdNec = nec.quantidade || 0

      let status: ResumoProdutoRow['status'] = 'falta_cobrir'
      let statusDetalhe = 'Nenhuma compra alocada'

      if (totalAlocadoNominal > 0) {
        if (qtdNec > 0) {
          if (totalAlocadoNominal < qtdNec) {
            status = 'falta_cobrir'
            statusDetalhe = `Faltam ${qtdNec - totalAlocadoNominal} ${nec.produto_unidade_padrao}`
          } else if (totalAlocadoNominal === qtdNec) {
            status = 'ok'
            statusDetalhe = '100% Coberto'
          } else {
            status = 'excedente'
            statusDetalhe = `+${totalAlocadoNominal - qtdNec} ${nec.produto_unidade_padrao} extra`
          }
        } else {
          status = 'ok'
          statusDetalhe = `${totalAlocadoNominal} ${nec.produto_unidade_padrao} alocados`
        }
      }

      return {
        id_produto: nec.id_produto,
        produto_nome: nec.produto_nome,
        produto_categoria: nec.produto_categoria,
        produto_unidade_padrao: nec.produto_unidade_padrao,
        quantidade_necessaria: qtdNec,
        quantidade_alocada_nominal: totalAlocadoNominal,
        quantidade_efetiva_comprada: totalEfetivoComprado,
        sobra_embalagem: sobra,
        subtotal_item: subtotalItem,
        status,
        status_detalhe: statusDetalhe,
        detalhe_fornecedores: detalheFornecedores,
      }
    })
  }, [necessidades, alocacoes, cotacoes])

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

    const produtosCobertos = dadosProdutos.filter(
      (p) => p.status === 'ok' || p.status === 'excedente',
    )

    return {
      totalFinanceiro,
      fornecedoresAtivosCount: fornecedoresAtivos.length,
      fornecedoresAptosCount: fornecedoresAptos.length,
      fornecedoresAbaixoCount: fornecedoresAbaixo.length,
      produtosTotalCount: dadosProdutos.length,
      produtosCobertosCount: produtosCobertos.length,
    }
  }, [dadosFornecedores, dadosProdutos])

  // Colunas da Tabela de Fornecedores
  const columnsFornecedores = useMemo<MRT_ColumnDef<ResumoFornecedorRow>[]>(
    () => [
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 200,
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
        size: 160,
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
        size: 150,
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
        size: 200,
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
        size: 220,
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

  // Colunas da Tabela de Produtos
  const columnsProdutos = useMemo<MRT_ColumnDef<ResumoProdutoRow>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 220,
        Cell: ({ cell, row }) => (
          <Stack gap={2}>
            <Text fw={600} size="sm">
              {cell.getValue<string>()}
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
        id: 'alocacao_fornecedores',
        header: 'Distribuição por Fornecedor (Divisão / Compra)',
        size: 320,
        Cell: ({ row }) => {
          const { detalhe_fornecedores, produto_unidade_padrao } = row.original

          if (detalhe_fornecedores.length === 0) {
            return (
              <Text size="xs" c="dimmed">
                Nenhum fornecedor alocado
              </Text>
            )
          }

          return (
            <Stack gap={4}>
              {detalhe_fornecedores.map((d, i) => (
                <Group key={i} gap="xs" justify="space-between">
                  <Badge variant="outline" color="cyan" size="xs">
                    {d.fornecedor_nome}
                  </Badge>
                  <Text size="xs">
                    <b>{d.quantidade}</b> {produto_unidade_padrao} (
                    {d.embalagens} emb. • {formatMoney(d.subtotal)})
                  </Text>
                </Group>
              ))}
            </Stack>
          )
        },
      },
      {
        accessorKey: 'quantidade_alocada_nominal',
        header: 'Total Comprado',
        size: 170,
        Cell: ({ row }) => {
          const item = row.original
          return (
            <Stack gap={2}>
              <Text fw={700} size="sm">
                {item.quantidade_alocada_nominal} {item.produto_unidade_padrao}
              </Text>
              {item.sobra_embalagem > 0 && (
                <Text size="11px" c="blue" fw={600}>
                  ({item.quantidade_efetiva_comprada} {item.produto_unidade_padrao} emb.{' '}
                  <span style={{ color: '#1c7ed6' }}>+{item.sobra_embalagem} sobra</span>)
                </Text>
              )}
            </Stack>
          )
        },
      },
      {
        accessorKey: 'subtotal_item',
        header: 'Subtotal (R$)',
        size: 130,
        Cell: ({ cell }) => (
          <Text fw={700} size="sm" c="teal.8">
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
      {
        id: 'status_cobertura',
        header: 'Conferência de Necessidade',
        size: 190,
        Cell: ({ row }) => {
          const item = row.original

          if (item.status === 'ok') {
            return (
              <Badge
                leftSection={<IconCheck size={14} />}
                color="teal"
                variant="filled"
                size="md"
              >
                {item.status_detalhe}
              </Badge>
            )
          }

          if (item.status === 'excedente') {
            return (
              <Badge
                leftSection={<IconPackage size={14} />}
                color="blue"
                variant="filled"
                size="md"
              >
                {item.status_detalhe}
              </Badge>
            )
          }

          return (
            <Badge
              leftSection={<IconAlertCircle size={14} />}
              color="red"
              variant="filled"
              size="md"
            >
              {item.status_detalhe}
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

  const tableProdutos = useMantineReactTable({
    columns: columnsProdutos,
    data: dadosProdutos,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
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
        title="Resumo da Rodada & Auditoria"
        subtitle="Conferência consolidada de pedidos mínimos por fornecedor e cobertura de necessidades"
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
          label="Itens Cobertos"
          value={`${metricas.produtosCobertosCount} de ${metricas.produtosTotalCount}`}
          subtitle={
            metricas.produtosCobertosCount < metricas.produtosTotalCount
              ? `⚠️ ${metricas.produtosTotalCount - metricas.produtosCobertosCount} produto(s) sem alocação`
              : '✓ 100% dos produtos da rodada alocados'
          }
          icon={IconPackage}
          color={metricas.produtosCobertosCount < metricas.produtosTotalCount ? 'orange' : 'teal'}
          badge={{
            label: `${Math.round((metricas.produtosCobertosCount / (metricas.produtosTotalCount || 1)) * 100)}% Coberto`,
            color: metricas.produtosCobertosCount < metricas.produtosTotalCount ? 'orange' : 'teal',
          }}
        />
      </SimpleGrid>

      {/* SEÇÃO 1: Resumo Financeiro por Fornecedor */}
      <Stack gap="xs" mt="xs">
        <Group justify="space-between">
          <div>
            <Title order={3} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconTruck size={22} />
              1. Resumo por Fornecedor (Pedido Mínimo)
            </Title>
            <Text size="xs" c="dimmed">
              Valores alocados comparados ao pedido mínimo de cada fornecedor
            </Text>
          </div>
        </Group>

        {loading ? (
          <Center p="xl">
            <Loader size="lg" />
          </Center>
        ) : (
          <MantineReactTable table={tableFornecedores} />
        )}
      </Stack>

      {/* SEÇÃO 2: Conferência por Produto */}
      <Stack gap="xs">
        <Group justify="space-between">
          <div>
            <Title order={3} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconPackage size={22} />
              2. Conferência de Necessidades por Produto
            </Title>
            <Text size="xs" c="dimmed">
              Consolidação de todas as alocações (mesmo divididas) contra as necessidades da rodada
            </Text>
          </div>
        </Group>

        {loading ? (
          <Center p="xl">
            <Loader size="lg" />
          </Center>
        ) : (
          <MantineReactTable table={tableProdutos} />
        )}
      </Stack>
    </Stack>
  )
}

export default ResumoView
