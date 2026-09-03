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
  IconCheck,
  IconChevronDown,
  IconFilterOff,
  IconRotate,
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
  id_fornecedor_selecionado?: number | null
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
  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState<
    Record<number, number | null>
  >({})
  const [loading, setLoading] = useState(true)

  const rodadaAtual = rodadas.find((r) => r.id === selectedRodadaId)
  const isFechada =
    rodadaAtual?.status === 'fechada' || rodadaAtual?.status === 'cancelada'

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

        const selecoes: Record<number, number | null> = {}
        listaNec.forEach((n) => {
          if (n.id_fornecedor_selecionado) {
            selecoes[n.id_produto] = n.id_fornecedor_selecionado
          } else {
            const cotsDoProd = listaCot
              .filter((c) => Number(c.id_produto) === Number(n.id_produto))
              .sort((a, b) => Number(a.preco_unitario) - Number(b.preco_unitario))
            if (cotsDoProd.length > 0) {
              selecoes[n.id_produto] = Number(cotsDoProd[0].id_fornecedor)
            }
          }
        })
        setFornecedoresSelecionados(selecoes)
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
        id_fornecedor_selecionado: nec.id_fornecedor_selecionado,
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

  // Verifica se há itens transferidos do menor preço na rodada
  const temItemTransferido = useMemo(() => {
    return dadosLinhas.some((linha) => {
      const menorCot = linha.ranking.length > 0 ? linha.ranking[0] : null
      const menorFornId = menorCot?.id_fornecedor
      const fornEscolhido =
        fornecedoresSelecionados[linha.id_produto] ||
        linha.id_fornecedor_selecionado ||
        menorFornId
      return Boolean(
        menorFornId &&
        fornEscolhido &&
        fornEscolhido !== menorFornId
      )
    })
  }, [dadosLinhas, fornecedoresSelecionados])

  // Seleciona um fornecedor diretamente ao clicar em uma célula de cotação
  const handleSelecionarFornecedor = async (
    idProduto: number,
    idFornecedor: number,
    produtoNome: string,
    fornecedorNome: string,
  ) => {
    if (!selectedRodadaId) return
    if (isFechada) {
      notifications.show({
        title: 'Rodada Concluída',
        message: 'Não é possível alterar decisões de compra em uma rodada fechada.',
        color: 'yellow',
      })
      return
    }

    // Atualização otimista imediata
    setFornecedoresSelecionados((prev) => ({
      ...prev,
      [idProduto]: idFornecedor,
    }))

    try {
      const api = await getApi()
      await api.set_selected_supplier(selectedRodadaId, idProduto, idFornecedor)
      notifications.show({
        title: 'Fornecedor Selecionado',
        message: `"${produtoNome}" alocado para "${fornecedorNome}".`,
        color: 'teal',
        icon: <IconCheck size={16} />,
        autoClose: 1600,
      })
    } catch (err: any) {
      console.error('Erro ao selecionar fornecedor:', err)
      notifications.show({
        title: 'Erro ao registrar escolha',
        message: err?.message || 'Falha ao salvar fornecedor selecionado.',
        color: 'red',
        icon: <IconX size={16} />,
      })
      carregarDados(selectedRodadaId)
    }
  }

  // Restaura todas as escolhas para o menor preço original
  const handleRestaurarMenoresPrecos = async () => {
    if (!selectedRodadaId || isFechada) return

    try {
      const api = await getApi()
      await api.reset_selected_suppliers(selectedRodadaId)
      const selecoes: Record<number, number | null> = {}
      necessidades.forEach((n) => {
        const cotsDoProd = cotacoes
          .filter((c) => Number(c.id_produto) === Number(n.id_produto))
          .sort((a, b) => Number(a.preco_unitario) - Number(b.preco_unitario))
        if (cotsDoProd.length > 0) {
          selecoes[n.id_produto] = Number(cotsDoProd[0].id_fornecedor)
        }
      })
      setFornecedoresSelecionados(selecoes)
      setNecessidades((prev) =>
        prev.map((n) => ({ ...n, id_fornecedor_selecionado: null })),
      )
      notifications.show({
        title: 'Menores Preços Restaurados',
        message: 'Todas as escolhas da rodada foram redefinidas para o menor preço de cada item.',
        color: 'teal',
        icon: <IconCheck size={16} />,
      })
    } catch (err: any) {
      console.error('Erro ao restaurar menores preços:', err)
      notifications.show({
        title: 'Erro',
        message: 'Falha ao restaurar menores preços.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    }
  }

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
          {/* Barra de Filtros, Legenda e Busca Rápida */}
          <Paper withBorder radius="sm" p="xs">
            <Stack gap={8}>
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

              {/* Barra de Legenda Semântica e Ação de Restauração */}
              <Group
                justify="space-between"
                align="center"
                wrap="wrap"
                gap="xs"
                style={{
                  borderTop: '1px solid var(--mantine-color-default-border)',
                  paddingTop: 6,
                }}
              >
                <Group gap={6} align="center" wrap="wrap">
                  <Text size="11px" fw={700} c="dimmed" tt="uppercase">
                    Legenda de Decisão:
                  </Text>
                  <Badge
                    size="xs"
                    variant="filled"
                    color="teal"
                    radius="xs"
                    style={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Verde: Selecionado (Decisão de Compra)
                  </Badge>
                  <Badge
                    size="xs"
                    variant="light"
                    color="blue"
                    radius="xs"
                    style={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Azul: Menor Preço (Preterido)
                  </Badge>
                  <Badge
                    size="xs"
                    variant="default"
                    radius="xs"
                    style={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Neutro: Outras Cotações
                  </Badge>
                  <Text size="11px" c="dimmed" fs="italic">
                    • Clique na célula para direcionar o produto para aquele fornecedor
                  </Text>
                </Group>

                {temItemTransferido && (
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    leftSection={<IconRotate size={14} />}
                    onClick={handleRestaurarMenoresPrecos}
                    disabled={isFechada}
                    title="Restaurar todas as escolhas da rodada para o fornecedor de menor preço"
                  >
                    Restaurar Menores Preços
                  </Button>
                )}
              </Group>
            </Stack>
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

                          {/* Colunas dos Fornecedores (Células Interativas de Decisão) */}
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

                            const menorCot = ranking.length > 0 ? ranking[0] : null
                            const menorPreco = menorCot?.preco_unitario
                            const menorFornId = menorCot?.id_fornecedor
                            const fornEscolhidoId =
                              fornecedoresSelecionados[linha.id_produto] ||
                              linha.id_fornecedor_selecionado ||
                              menorFornId

                            const isSelecionado = forn.id === fornEscolhidoId
                            const isMenorPreco = cot.preco_unitario === menorPreco
                            const isTransferido = Boolean(
                              fornEscolhidoId &&
                                menorFornId &&
                                fornEscolhidoId !== menorFornId,
                            )
                            const isMenorPrecoPreterido =
                              isTransferido && isMenorPreco
                            const { economiaPct } = linha

                            // Cores semânticas segundo regra de compras do usuário:
                            // 1. Verde = Selecionado (mesmo não sendo o menor preço, pré-selecionado por padrão no menor preço)
                            // 2. Azul = Menor preço original que foi transferido/preterido
                            // 3. Neutro = Demais posições (VERMELHO REMOVIDO TOTALMENTE)
                            let bgCell = 'transparent'
                            let textPrecoColor: string | undefined = undefined
                            let borderCell =
                              '1px solid var(--mantine-color-default-border)'

                            if (isSelecionado) {
                              bgCell = isDark
                                ? 'rgba(43, 138, 62, 0.40)'
                                : '#d3f9d8'
                              textPrecoColor = isDark ? '#8ce99a' : '#14532d'
                              borderCell = isDark
                                ? '2px solid #2b8a3e'
                                : '2px solid #2b8a3e'
                            } else if (isMenorPrecoPreterido) {
                              bgCell = isDark
                                ? 'rgba(25, 113, 194, 0.35)'
                                : '#d0ebff'
                              textPrecoColor = isDark ? '#74c0fc' : '#1864ab'
                              borderCell = isDark
                                ? '1px solid #1971c2'
                                : '1px solid #74c0fc'
                            } else {
                              // Limpo e neutro sem vermelho
                              bgCell = isDark ? 'transparent' : '#ffffff'
                              textPrecoColor = undefined
                            }

                            const isClickable = !isFechada

                            return (
                              <Table.Td
                                key={forn.id}
                                onClick={() => {
                                  if (isClickable) {
                                    handleSelecionarFornecedor(
                                      linha.id_produto,
                                      forn.id,
                                      linha.produto_nome,
                                      forn.nome,
                                    )
                                  }
                                }}
                                style={{
                                  backgroundColor: bgCell,
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  padding: '3px 6px',
                                  borderRight: borderCell,
                                  borderBottom: borderCell,
                                  borderLeft: isSelecionado ? borderCell : undefined,
                                  borderTop: isSelecionado ? borderCell : undefined,
                                  cursor: isClickable ? 'pointer' : 'default',
                                  userSelect: 'none',
                                  transition: 'background-color 150ms ease, box-shadow 150ms ease',
                                }}
                                title={
                                  isFechada
                                    ? 'Rodada concluída'
                                    : isSelecionado
                                    ? 'Fornecedor selecionado para compra. Clique em outro para transferir.'
                                    : `Clique para direcionar a compra de "${linha.produto_nome}" para ${forn.nome}`
                                }
                              >
                                <div
                                  style={{
                                    width: '100%',
                                    overflow: 'hidden',
                                    lineHeight: 1.15,
                                  }}
                                >
                                  {/* Linha 1: Preço Unitário + Troféu / Checkmark e Economia */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    {isSelecionado && isMenorPreco && (
                                      <span style={{ fontSize: '11px' }}>
                                        🏆
                                      </span>
                                    )}
                                    {isSelecionado && !isMenorPreco && (
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          color: textPrecoColor,
                                        }}
                                      >
                                        ✓
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
                                    {isSelecionado &&
                                      isMenorPreco &&
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

                                  {/* Linha 2: Marca com Destaque Nítido e Indicador de Decisão */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 4,
                                      marginTop: 2,
                                      marginBottom: 1,
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    {cot.marca ? (
                                      <Badge
                                        size="xs"
                                        variant={
                                          isSelecionado
                                            ? 'filled'
                                            : isMenorPrecoPreterido
                                            ? 'light'
                                            : 'light'
                                        }
                                        color={
                                          isSelecionado
                                            ? 'teal'
                                            : isMenorPrecoPreterido
                                            ? 'blue'
                                            : 'gray'
                                        }
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

                                    {/* Tag de Menor Preço SEMPRE visível no menor preço */}
                                    {isMenorPreco && (
                                      <Badge
                                        size="xs"
                                        variant={isSelecionado ? 'filled' : 'outline'}
                                        color={isSelecionado ? 'teal' : 'blue'}
                                        radius="xs"
                                        style={{
                                          fontSize: '8px',
                                          height: 13,
                                          padding: '0 3px',
                                          fontWeight: 700,
                                        }}
                                      >
                                        MENOR PREÇO
                                      </Badge>
                                    )}

                                    {isSelecionado && !isMenorPreco && (
                                      <Badge
                                        size="xs"
                                        variant="filled"
                                        color="teal"
                                        radius="xs"
                                        style={{
                                          fontSize: '8px',
                                          height: 13,
                                          padding: '0 3px',
                                          fontWeight: 700,
                                        }}
                                      >
                                        ESCOLHIDO
                                      </Badge>
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
