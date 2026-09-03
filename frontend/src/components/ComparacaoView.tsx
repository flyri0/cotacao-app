import { useEffect, useState, useMemo } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  useComputedColorScheme,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconFilterOff,
  IconScale,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
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

type SortField = 'produto' | 'categoria' | null
type SortDirection = 'asc' | 'desc'

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
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: true,
  })
  const isDark = computedColorScheme === 'dark'

  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros locais da planilha
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)

  // Ordenação alfabética estilo Excel (apenas em Produto e Categoria)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

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

  // Lista de categorias únicas para o seletor de filtros
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

  // Linhas filtradas e ordenadas (alfabeticamente estilo Excel)
  const dadosFiltrados = useMemo(() => {
    let list = dadosLinhas.filter((linha) => {
      if (filtroCategoria && linha.produto_categoria !== filtroCategoria) {
        return false
      }
      if (filtroTexto.trim()) {
        const q = filtroTexto.toLowerCase().trim()
        const matchNome = linha.produto_nome.toLowerCase().includes(q)
        const matchMarca = Object.values(linha.cotacoesPorFornecedor).some(
          (c) => c.marca && c.marca.toLowerCase().includes(q),
        )
        if (!matchNome && !matchMarca) return false
      }
      return true
    })

    if (sortField) {
      list = [...list].sort((a, b) => {
        const valA = (sortField === 'produto' ? a.produto_nome : a.produto_categoria) || ''
        const valB = (sortField === 'produto' ? b.produto_nome : b.produto_categoria) || ''
        const cmp = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' })
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }

    return list
  }, [dadosLinhas, filtroCategoria, filtroTexto, sortField, sortDirection])

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

  const temFiltroAtivo = Boolean(filtroTexto.trim() || filtroCategoria || sortField)

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      <PageHeader
        icon={IconScale}
        iconColor={themeColor}
        title="Mapa Comparativo de Cotações"
        subtitle="Normalização por unidade de medida com painéis congelados"
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

      {/* Cartões KPIs Padronizados (Apenas Cobertura e Fornecedores) */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <StatCard
          label="Cobertura de Cotações"
          value={`${stats.totalComCotacao} de ${stats.totalItens}`}
          subtitle="Itens com preço cotado na rodada"
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
      </SimpleGrid>

      {/* Conteúdo Principal */}
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
        <Stack gap="xs" style={{ width: '100%' }}>
          {/* Barra de Filtros e Busca Rápida */}
          <Paper withBorder radius="sm" p="xs">
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap="xs" wrap="wrap" align="center">
                <TextInput
                  size="xs"
                  placeholder="Buscar produto ou marca..."
                  leftSection={<IconSearch size={14} />}
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.currentTarget.value)}
                  style={{ width: 240 }}
                />

                <Select
                  size="xs"
                  placeholder="Todas as categorias"
                  data={categoriasUnicas}
                  value={filtroCategoria}
                  onChange={setFiltroCategoria}
                  clearable
                  style={{ width: 190 }}
                />

                {temFiltroAtivo && (
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    leftSection={<IconFilterOff size={14} />}
                    onClick={() => {
                      setFiltroTexto('')
                      setFiltroCategoria(null)
                      setSortField(null)
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </Group>

              <Badge size="xs" variant="light" color="gray">
                Exibindo {dadosFiltrados.length} de {dadosLinhas.length} produtos
                {sortField
                  ? ` • ${sortField === 'produto' ? 'Produto' : 'Categoria'} (${sortDirection === 'asc' ? 'A→Z' : 'Z→A'})`
                  : ''}
              </Badge>
            </Group>
          </Paper>

          {/* Super-Planilha de Alta Densidade com Congelamento de Painéis */}
          <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
            <Table.ScrollContainer
              minWidth={500}
              style={{
                maxHeight: 'calc(100vh - 285px)',
                overflowY: 'auto',
              }}
            >
              <Table
                withTableBorder
                withColumnBorders
                highlightOnHover
                verticalSpacing={2}
                horizontalSpacing={4}
                style={{
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  fontSize: 'var(--app-font-base, 13px)',
                }}
              >
                <Table.Thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backgroundColor: isDark
                      ? 'var(--mantine-color-dark-7)'
                      : '#f8f9fa',
                  }}
                >
                  <Table.Tr>
                    {/* Cabeçalho Fixo 1: Produto (Com Filtro/Ordenação Estilo Excel) */}
                    <Table.Th
                      style={{
                        position: 'sticky',
                        left: 0,
                        top: 0,
                        zIndex: 12,
                        width: 220,
                        minWidth: 220,
                        maxWidth: 220,
                        backgroundColor: isDark
                          ? 'var(--mantine-color-dark-7)'
                          : '#f8f9fa',
                        padding: '5px 8px',
                        borderBottom:
                          '2px solid var(--mantine-color-default-border)',
                        borderRight:
                          '1px solid var(--mantine-color-default-border)',
                      }}
                    >
                      <Group
                        justify="space-between"
                        align="center"
                        wrap="nowrap"
                        gap={4}
                      >
                        <Text fw={700} size="xs" tt="uppercase" c="dimmed">
                          Produto
                        </Text>
                        <Menu
                          shadow="md"
                          width={175}
                          position="bottom-start"
                          radius="xs"
                          withinPortal
                        >
                          <Menu.Target>
                            <ActionIcon
                              variant={sortField === 'produto' ? 'filled' : 'subtle'}
                              color={sortField === 'produto' ? themeColor : 'gray'}
                              size="xs"
                              title="Filtrar e ordenar produto de A a Z ou Z a A"
                              style={{
                                border:
                                  sortField === 'produto'
                                    ? 'none'
                                    : '1px solid var(--mantine-color-default-border)',
                                backgroundColor:
                                  sortField === 'produto'
                                    ? undefined
                                    : isDark
                                    ? 'var(--mantine-color-dark-6)'
                                    : '#ffffff',
                              }}
                            >
                              {sortField === 'produto' ? (
                                sortDirection === 'asc' ? (
                                  <IconArrowUp size={11} />
                                ) : (
                                  <IconArrowDown size={11} />
                                )
                              ) : (
                                <IconChevronDown size={11} />
                              )}
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Label>Classificar Produtos</Menu.Label>
                            <Menu.Item
                              leftSection={<IconSortAscending size={14} />}
                              onClick={() => {
                                setSortField('produto')
                                setSortDirection('asc')
                              }}
                              style={{
                                fontWeight:
                                  sortField === 'produto' &&
                                  sortDirection === 'asc'
                                    ? 700
                                    : 400,
                                color:
                                  sortField === 'produto' &&
                                  sortDirection === 'asc'
                                    ? `var(--mantine-color-${themeColor}-6)`
                                    : undefined,
                              }}
                            >
                              Classificar de A a Z
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconSortDescending size={14} />}
                              onClick={() => {
                                setSortField('produto')
                                setSortDirection('desc')
                              }}
                              style={{
                                fontWeight:
                                  sortField === 'produto' &&
                                  sortDirection === 'desc'
                                    ? 700
                                    : 400,
                                color:
                                  sortField === 'produto' &&
                                  sortDirection === 'desc'
                                    ? `var(--mantine-color-${themeColor}-6)`
                                    : undefined,
                              }}
                            >
                              Classificar de Z a A
                            </Menu.Item>
                            {sortField === 'produto' && (
                              <>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconFilterOff size={14} />}
                                  onClick={() => setSortField(null)}
                                >
                                  Remover classificação
                                </Menu.Item>
                              </>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Th>

                    {/* Cabeçalho Fixo 2: Categoria (Com Filtro/Ordenação Estilo Excel) */}
                    <Table.Th
                      style={{
                        position: 'sticky',
                        left: 220,
                        top: 0,
                        zIndex: 12,
                        width: 130,
                        minWidth: 130,
                        maxWidth: 130,
                        backgroundColor: isDark
                          ? 'var(--mantine-color-dark-7)'
                          : '#f8f9fa',
                        padding: '5px 8px',
                        borderBottom:
                          '2px solid var(--mantine-color-default-border)',
                        borderRight:
                          '2px solid var(--mantine-color-default-border)',
                      }}
                    >
                      <Group
                        justify="space-between"
                        align="center"
                        wrap="nowrap"
                        gap={4}
                      >
                        <Text fw={700} size="xs" tt="uppercase" c="dimmed">
                          Categoria
                        </Text>
                        <Menu
                          shadow="md"
                          width={175}
                          position="bottom-start"
                          radius="xs"
                          withinPortal
                        >
                          <Menu.Target>
                            <ActionIcon
                              variant={sortField === 'categoria' ? 'filled' : 'subtle'}
                              color={sortField === 'categoria' ? themeColor : 'gray'}
                              size="xs"
                              title="Filtrar e ordenar categoria de A a Z ou Z a A"
                              style={{
                                border:
                                  sortField === 'categoria'
                                    ? 'none'
                                    : '1px solid var(--mantine-color-default-border)',
                                backgroundColor:
                                  sortField === 'categoria'
                                    ? undefined
                                    : isDark
                                    ? 'var(--mantine-color-dark-6)'
                                    : '#ffffff',
                              }}
                            >
                              {sortField === 'categoria' ? (
                                sortDirection === 'asc' ? (
                                  <IconArrowUp size={11} />
                                ) : (
                                  <IconArrowDown size={11} />
                                )
                              ) : (
                                <IconChevronDown size={11} />
                              )}
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Label>Classificar Categorias</Menu.Label>
                            <Menu.Item
                              leftSection={<IconSortAscending size={14} />}
                              onClick={() => {
                                setSortField('categoria')
                                setSortDirection('asc')
                              }}
                              style={{
                                fontWeight:
                                  sortField === 'categoria' &&
                                  sortDirection === 'asc'
                                    ? 700
                                    : 400,
                                color:
                                  sortField === 'categoria' &&
                                  sortDirection === 'asc'
                                    ? `var(--mantine-color-${themeColor}-6)`
                                    : undefined,
                              }}
                            >
                              Classificar de A a Z
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconSortDescending size={14} />}
                              onClick={() => {
                                setSortField('categoria')
                                setSortDirection('desc')
                              }}
                              style={{
                                fontWeight:
                                  sortField === 'categoria' &&
                                  sortDirection === 'desc'
                                    ? 700
                                    : 400,
                                color:
                                  sortField === 'categoria' &&
                                  sortDirection === 'desc'
                                    ? `var(--mantine-color-${themeColor}-6)`
                                    : undefined,
                              }}
                            >
                              Classificar de Z a A
                            </Menu.Item>
                            {sortField === 'categoria' && (
                              <>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconFilterOff size={14} />}
                                  onClick={() => setSortField(null)}
                                >
                                  Remover classificação
                                </Menu.Item>
                              </>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Th>

                    {/* Cabeçalhos Dinâmicos: Nome do Fornecedor (Sem Pedido Mínimo) */}
                    {fornecedoresNaTabela.map((forn) => (
                      <Table.Th
                        key={forn.id}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 9,
                          textAlign: 'center',
                          width: 160,
                          minWidth: 150,
                          backgroundColor: isDark
                            ? 'var(--mantine-color-dark-7)'
                            : '#f8f9fa',
                          padding: '6px 8px',
                          borderBottom:
                            '2px solid var(--mantine-color-default-border)',
                          borderRight:
                            '1px solid var(--mantine-color-default-border)',
                        }}
                      >
                        <Text
                          fw={700}
                          size="xs"
                          truncate="end"
                          ta="center"
                          title={forn.nome}
                        >
                          {forn.nome}
                        </Text>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {dadosFiltrados.length === 0 ? (
                    <Table.Tr>
                      <Table.Td
                        colSpan={2 + fornecedoresNaTabela.length}
                        style={{ textAlign: 'center', padding: '32px' }}
                      >
                        <Text size="xs" c="dimmed">
                          Nenhum produto encontrado com os filtros selecionados.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    dadosFiltrados.map((linha) => {
                      const ranking = linha.ranking || []
                      const menorPreco = ranking[0]?.preco_unitario

                      return (
                        <Table.Tr key={linha.id}>
                          {/* Coluna 1 Fixa: Produto */}
                          <Table.Td
                            style={{
                              position: 'sticky',
                              left: 0,
                              zIndex: 5,
                              width: 220,
                              minWidth: 220,
                              maxWidth: 220,
                              backgroundColor: isDark
                                ? 'var(--mantine-color-dark-7)'
                                : '#ffffff',
                              padding: '4px 8px',
                              borderRight:
                                '1px solid var(--mantine-color-default-border)',
                              borderBottom:
                                '1px solid var(--mantine-color-default-border)',
                              verticalAlign: 'middle',
                            }}
                          >
                            <Text
                              fw={600}
                              size="xs"
                              lineClamp={2}
                              style={{ lineHeight: 1.15 }}
                            >
                              {linha.produto_nome}
                            </Text>
                          </Table.Td>

                          {/* Coluna 2 Fixa: Categoria */}
                          <Table.Td
                            style={{
                              position: 'sticky',
                              left: 220,
                              zIndex: 5,
                              width: 130,
                              minWidth: 130,
                              maxWidth: 130,
                              backgroundColor: isDark
                                ? 'var(--mantine-color-dark-7)'
                                : '#ffffff',
                              padding: '4px 8px',
                              borderRight:
                                '2px solid var(--mantine-color-default-border)',
                              borderBottom:
                                '1px solid var(--mantine-color-default-border)',
                              boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)',
                              verticalAlign: 'middle',
                            }}
                          >
                            <Text
                              size="xs"
                              truncate="end"
                              c={
                                !linha.produto_categoria ? 'dimmed' : undefined
                              }
                              style={{ lineHeight: 1.15 }}
                            >
                              {linha.produto_categoria || '-'}
                            </Text>
                          </Table.Td>

                          {/* Colunas dos Fornecedores (Células Heat Map) */}
                          {fornecedoresNaTabela.map((forn) => {
                            const cot = linha.cotacoesPorFornecedor[forn.id]

                            if (!cot) {
                              return (
                                <Table.Td
                                  key={forn.id}
                                  style={{
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    padding: '4px 6px',
                                    borderRight:
                                      '1px solid var(--mantine-color-default-border)',
                                    borderBottom:
                                      '1px solid var(--mantine-color-default-border)',
                                    backgroundColor: isDark
                                      ? 'transparent'
                                      : '#fdfdfd',
                                  }}
                                >
                                  <Text size="xs" c="dimmed">
                                    -
                                  </Text>
                                </Table.Td>
                              )
                            }

                            const isVencedor =
                              cot.preco_unitario === menorPreco
                            const index = ranking.findIndex(
                              (c) => c.id === cot.id,
                            )
                            const posicao = isVencedor ? 1 : index + 1
                            const { economiaPct } = linha

                            // Cores semânticas de alta visibilidade e contraste para cada posição
                            let bgCell = 'transparent'
                            let textPrecoColor = undefined

                            if (posicao === 1) {
                              bgCell = isDark
                                ? 'rgba(43, 138, 62, 0.40)'
                                : '#d3f9d8'
                              textPrecoColor = isDark ? '#8ce99a' : '#14532d'
                            } else if (posicao === 2) {
                              bgCell = isDark
                                ? 'rgba(245, 159, 0, 0.32)'
                                : '#fff3bf'
                              textPrecoColor = isDark ? '#ffd43b' : '#713f12'
                            } else if (posicao >= 3) {
                              bgCell = isDark
                                ? 'rgba(224, 49, 49, 0.32)'
                                : '#ffe3e3'
                              textPrecoColor = isDark ? '#ffa8a8' : '#7f1d1d'
                            }

                            return (
                              <Table.Td
                                key={forn.id}
                                style={{
                                  backgroundColor: bgCell,
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  padding: '3px 6px',
                                  borderRight:
                                    '1px solid var(--mantine-color-default-border)',
                                  borderBottom:
                                    '1px solid var(--mantine-color-default-border)',
                                }}
                              >
                                <div
                                  style={{
                                    width: '100%',
                                    overflow: 'hidden',
                                    lineHeight: 1.15,
                                  }}
                                >
                                  {/* Linha 1: Preço Unitário + Troféu e % Economia no Vencedor */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    {isVencedor && (
                                      <span style={{ fontSize: '11px' }}>
                                        🏆
                                      </span>
                                    )}
                                    <Text
                                      fw={700}
                                      size="xs"
                                      c={textPrecoColor}
                                      style={{ whiteSpace: 'nowrap' }}
                                    >
                                      {formatMoney(cot.preco_unitario)}
                                    </Text>
                                    {isVencedor &&
                                      economiaPct !== null &&
                                      economiaPct > 0.1 && (
                                        <Text
                                          size="10px"
                                          fw={700}
                                          c={textPrecoColor}
                                          style={{ whiteSpace: 'nowrap' }}
                                        >
                                          (-{economiaPct.toFixed(0)}%)
                                        </Text>
                                      )}
                                  </div>

                                  {/* Linha 2: Marca com Destaque Nítido */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'center',
                                      marginTop: 2,
                                      marginBottom: 1,
                                    }}
                                  >
                                    {cot.marca ? (
                                      <Badge
                                        size="xs"
                                        variant={
                                          isVencedor ? 'filled' : 'light'
                                        }
                                        color={isVencedor ? 'teal' : 'gray'}
                                        radius="xs"
                                        style={{
                                          fontSize: '9px',
                                          height: 15,
                                          padding: '0 4px',
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          maxWidth: 135,
                                        }}
                                      >
                                        {cot.marca}
                                      </Badge>
                                    ) : (
                                      <Text size="9px" c="dimmed" fs="italic">
                                        (Sem marca)
                                      </Text>
                                    )}
                                  </div>

                                  {/* Linha 3: Embalagem e Preço da Embalagem */}
                                  <Text
                                    size="10px"
                                    c="dimmed"
                                    truncate="end"
                                    ta="center"
                                    style={{ lineHeight: 1.1 }}
                                  >
                                    {cot.embalagem} (
                                    {formatMoney(cot.preco_embalagem, 2)})
                                  </Text>
                                </div>
                              </Table.Td>
                            )
                          })}
                        </Table.Tr>
                      )
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </Stack>
      )}
    </Stack>
  )
}

export default ComparacaoView
