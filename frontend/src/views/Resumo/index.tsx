import { useEffect, useState, useMemo } from 'react'
import {
  Center,
  Loader,
  SimpleGrid,
  Stack,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconChartBar,
  IconPackage,
  IconScale,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
} from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoundHeaderSelector } from '../../components/form/RoundHeaderSelector'
import { StatCard } from '../../components/ui/StatCard'
import { getApi } from '../../services/api'
import type { Alocacao, Cotacao, Fornecedor, Rodada } from '../../types'
import { useResumoColumns } from './useResumoColumns'
import type { ResumoFornecedorRow } from './types'
import { formatMoney } from './utils'

interface ResumoViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
  themeColor?: string
}

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

  const carregarDados = async (rodadaId?: number) => {
    try {
      setLoading(true)
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

  const { columns, renderDetailPanel } = useResumoColumns()

  const tableFornecedores = useMantineReactTable({
    enableDensityToggle: false,
    columns,
    data: dadosFornecedores,
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
    renderDetailPanel,
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: true,
    },
    mantinePaperProps: {
      withBorder: true,
      radius: 'sm',
      shadow: 'none',
    },
  })

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
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

      {/* Cartões KPIs */}
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
