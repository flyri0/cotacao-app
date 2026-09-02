import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
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
import { EmptyState } from './common/EmptyState'
import { getApi } from '../services/api'
import type { Cotacao, Fornecedor, Necessidade, Rodada } from '../types'

// Formatação inteligente: mínimo 2 casas (R$ 5,00) e máximo 4 casas (R$ 0,043)
function formatMoney(valor: number, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

export interface LinhaComparacao {
  id: number
  id_produto: number
  produto_nome: string
  produto_categoria: string | null
  cotacoesPorFornecedor: Record<number, Cotacao>
  ranking: Cotacao[]
  melhorCotacao: Cotacao | null
  segundaMelhor: Cotacao | null
  economiaPct: number | null
}

interface ComparacaoViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
  themeColor?: string
}

export function ComparacaoView({
  rodadaAtivaId,
  onRodadaChange,
  themeColor = 'blue',
}: ComparacaoViewProps) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
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
        const [listaNec, listaCot] = await Promise.all([
          api.list_needs(idAlvo),
          api.list_quotes(idAlvo),
        ])
        setNecessidades(listaNec)
        setCotacoes(listaCot)
      }
    } catch (error) {
      console.error('Erro ao carregar mapa comparativo:', error)
      notifications.show({
        title: 'Erro de comunicação',
        message: 'Não foi possível carregar as informações comparativas.',
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

  // Apenas fornecedores participantes com cotação na rodada (ou todos cadastrados se nenhum cotou)
  const fornecedoresNaTabela = useMemo(() => {
    const idsComCotacao = new Set(cotacoes.map((c) => c.id_fornecedor))
    const participantes = fornecedores.filter((f) => idsComCotacao.has(f.id))
    return participantes.length > 0 ? participantes : fornecedores
  }, [fornecedores, cotacoes])

  // Lista de categorias únicas para o filtro seletivo
  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>()
    necessidades.forEach((n) => {
      if (n.produto_categoria) cats.add(n.produto_categoria)
    })
    return Array.from(cats).sort()
  }, [necessidades])

  // Linhas estruturadas com cotações indexadas e ranking pré-calculado
  const dadosLinhas = useMemo<LinhaComparacao[]>(() => {
    return necessidades.map((nec) => {
      const cotsDoProd = cotacoes
        .filter((c) => c.id_produto === nec.id_produto)
        .sort((a, b) => a.preco_unitario - b.preco_unitario)

      const cotacoesPorFornecedor: Record<number, Cotacao> = {}
      cotacoes.forEach((c) => {
        if (c.id_produto === nec.id_produto) {
          cotacoesPorFornecedor[c.id_fornecedor] = c
        }
      })

      const melhorCotacao = cotsDoProd.length > 0 ? cotsDoProd[0] : null
      const segundaMelhor = cotsDoProd.length > 1 ? cotsDoProd[1] : null
      let economiaPct: number | null = null
      if (
        melhorCotacao &&
        segundaMelhor &&
        segundaMelhor.preco_unitario > melhorCotacao.preco_unitario
      ) {
        economiaPct =
          ((segundaMelhor.preco_unitario - melhorCotacao.preco_unitario) /
            segundaMelhor.preco_unitario) *
          100
      }

      return {
        id: nec.id,
        id_produto: nec.id_produto,
        produto_nome: nec.produto_nome,
        produto_categoria: nec.produto_categoria || null,
        cotacoesPorFornecedor,
        ranking: cotsDoProd,
        melhorCotacao,
        segundaMelhor,
        economiaPct,
      }
    })
  }, [necessidades, cotacoes])

  // Indicadores rápidos
  const stats = useMemo(() => {
    const totalItens = dadosLinhas.length
    let totalComCotacao = 0
    dadosLinhas.forEach((linha) => {
      if (linha.ranking.length > 0) totalComCotacao++
    })
    const percentual =
      totalItens > 0 ? Math.round((totalComCotacao / totalItens) * 100) : 0
    return { totalItens, totalComCotacao, percentual }
  }, [dadosLinhas])

  // Definição das colunas da Mantine React Table
  const columns = useMemo<MRT_ColumnDef<LinhaComparacao>[]>(() => {
    const cols: MRT_ColumnDef<LinhaComparacao>[] = [
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 220,
        minSize: 150,
        maxSize: 500,
        enablePinning: true,
        enableColumnFilter: true,
        mantineFilterTextInputProps: {
          size: 'xs',
          placeholder: 'Buscar produto...',
        },
        Cell: ({ cell }) => (
          <Text fw={600} size="xs" lineClamp={2} style={{ lineHeight: 1.2 }}>
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'produto_categoria',
        header: 'Categoria',
        size: 140,
        minSize: 120,
        maxSize: 250,
        enablePinning: true,
        enableColumnFilter: true,
        filterVariant: 'select',
        mantineFilterSelectProps: {
          data: categoriasUnicas,
          size: 'xs',
          clearable: true,
          placeholder: 'Todas as categorias',
        },
        Cell: ({ cell }) => {
          const cat = cell.getValue<string | null>()
          return (
            <Text size="xs" truncate="end" c={!cat ? 'dimmed' : undefined}>
              {cat || '-'}
            </Text>
          )
        },
      },
    ]

    // Colunas dinâmicas para cada fornecedor
    fornecedoresNaTabela.forEach((forn) => {
      cols.push({
        id: `forn_${forn.id}`,
        header: forn.nome,
        size: 165,
        minSize: 145,
        maxSize: 350,
        enableColumnFilter: false,
        enableColumnActions: false,
        Header: () => (
          <div style={{ lineHeight: 1.15, width: '100%', overflow: 'hidden' }}>
            <Text fw={700} size="xs" truncate="end">
              {forn.nome}
            </Text>
            {forn.pedido_minimo > 0 && (
              <Text size="10px" c="dimmed" fw={400} truncate="end">
                Mín: {formatMoney(forn.pedido_minimo)}
              </Text>
            )}
          </div>
        ),
        accessorFn: (row) => {
          const cot = row.cotacoesPorFornecedor[forn.id]
          return cot ? cot.preco_unitario : null
        },
        sortingFn: (rowA, rowB) => {
          const valA =
            rowA.original.cotacoesPorFornecedor[forn.id]?.preco_unitario ??
            Infinity
          const valB =
            rowB.original.cotacoesPorFornecedor[forn.id]?.preco_unitario ??
            Infinity
          return valA - valB
        },
        Cell: ({ row }) => {
          const cot = row.original.cotacoesPorFornecedor[forn.id]
          if (!cot) {
            return (
              <Text size="xs" c="dimmed" ta="center">
                -
              </Text>
            )
          }

          const isVencedor = row.original.melhorCotacao?.id === cot.id
          const { economiaPct } = row.original

          return (
            <div
              style={{
                width: '100%',
                overflow: 'hidden',
                backgroundColor: isVencedor
                  ? 'var(--mantine-color-teal-light)'
                  : undefined,
                borderRadius: 'var(--mantine-radius-xs)',
                padding: '2px 4px',
                lineHeight: 1.2,
              }}
            >
              {/* Preço Unitário + Marca em destaque na mesma linha */}
              <Group gap={4} justify="space-between" wrap="nowrap" align="center" style={{ width: '100%', overflow: 'hidden' }}>
                <Text
                  fw={isVencedor ? 700 : 500}
                  size="xs"
                  c={isVencedor ? 'teal' : undefined}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {isVencedor ? '🏆 ' : ''}{formatMoney(cot.preco_unitario)}
                </Text>

                {cot.marca && (
                  <Badge
                    size="xs"
                    variant={isVencedor ? 'filled' : 'outline'}
                    color={isVencedor ? 'teal' : 'gray'}
                    radius="xs"
                    style={{
                      textTransform: 'uppercase',
                      fontSize: '9px',
                      padding: '0 4px',
                      height: 16,
                      lineHeight: '14px',
                      flexShrink: 0,
                      maxWidth: 65,
                    }}
                  >
                    {cot.marca}
                  </Badge>
                )}
              </Group>

              {/* Embalagem e Porcentagem de Economia do Vencedor */}
              <Group gap={4} justify="space-between" wrap="nowrap" align="center" style={{ marginTop: 1, width: '100%', overflow: 'hidden' }}>
                <Text size="10px" c="dimmed" truncate="end" style={{ flex: 1 }}>
                  {cot.embalagem} ({formatMoney(cot.preco_embalagem, 2)})
                </Text>
                {isVencedor && economiaPct !== null && economiaPct > 0.1 && (
                  <Text size="10px" fw={700} c="teal" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    -{economiaPct.toFixed(0)}%
                  </Text>
                )}
              </Group>
            </div>
          )
        },
      })
    })

    return cols
  }, [fornecedoresNaTabela, categoriasUnicas])

  // Configuração da Mantine React Table
  const table = useMantineReactTable({
    columns,
    data: dadosLinhas,
    localization: MRT_Localization_PT_BR,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableHiding: false,
    enableColumnActions: false,
    enablePagination: false,
    enableBottomToolbar: false,
    enableTopToolbar: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    enableColumnPinning: true,
    enableStickyHeader: true,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableSorting: true,
    initialState: {
      density: 'xs',
      columnPinning: {
        left: ['produto_nome', 'produto_categoria'],
      },
      showGlobalFilter: true,
    },
    mantineSearchTextInputProps: {
      size: 'xs',
      placeholder: 'Pesquisar produto ou marca...',
    },
    mantineTableContainerProps: {
      style: {
        maxHeight: 'calc(100vh - 240px)',
        borderTop: '1px solid var(--mantine-color-default-border)',
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: '4px 6px',
        fontSize: 'var(--app-font-base, 13px)',
        whiteSpace: 'nowrap',
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: '2px 4px',
        fontSize: 'var(--app-font-base, 13px)',
      },
    },
    mantineTopToolbarProps: {
      style: {
        minHeight: 46,
        padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
        alignItems: 'center',
      },
    },
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: true,
      withColumnBorders: true,
    },
    mantinePaperProps: {
      withBorder: true,
      radius: 'sm',
      shadow: 'none',
    },
  })

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      <PageHeader
        icon={IconScale}
        iconColor={themeColor}
        title="Mapa Comparativo de Cotações"
        subtitle="Normalização por unidade de medida"
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

      {/* Cartões KPIs Padronizados (StatCard) */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
        <StatCard
          label="Cobertura de Cotações"
          value={`${stats.totalComCotacao} de ${stats.totalItens}`}
          subtitle="Itens com preço cotado"
          icon={IconScale}
          color={themeColor}
          badge={{
            label: `${stats.percentual}% Coberto`,
            color: stats.percentual === 100 ? 'teal' : themeColor,
          }}
        />

        <StatCard
          label="Fornecedores na Matriz"
          value={fornecedoresNaTabela.length}
          subtitle="Participantes concorrendo na rodada"
          icon={IconTruck}
          color="teal"
          badge={{ label: 'Ativos', color: 'teal' }}
        />

        <StatCard
          label="Critério de Destaque"
          value="Menor Preço"
          subtitle="Normalizado por unidade (🏆 1º Lugar)"
          color="teal"
          valueColor="teal"
          badge={{ label: 'Melhor Oferta', color: 'teal' }}
        />
      </SimpleGrid>

      {/* Tabela Mantine React Table */}
      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : necessidades.length === 0 ? (
        <EmptyState
          title="Nenhuma necessidade cadastrada nesta rodada"
          description="Adicione produtos na aba Necessidades para visualizar o comparativo de preços."
        />
      ) : (
        <MantineReactTable table={table} />
      )}
    </Stack>
  )
}

export default ComparacaoView

