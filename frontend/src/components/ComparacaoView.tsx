import { useEffect, useState, useMemo, useRef } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
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
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconFilterOff,
  IconRotate,
  IconScale,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import { EmptyState, PageHeader, RoundHeaderSelector, StatCard } from './common'
import { formatMoney } from '../utils'
import { getApi } from '../services/api'
import type { Cotacao, Fornecedor, Necessidade, Rodada } from '../types'

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
  const [fornecedoresOcultosIds, setFornecedoresOcultosIds] = useState<number[]>([])
  const [ocultarCategoria, setOcultarCategoria] = useState(false)

  // Ordenação alfabética estilo Excel
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Refs para a barra de rolagem horizontal dupla sincronizada
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const [tableScrollWidth, setTableScrollWidth] = useState(0)
  const isSyncingScroll = useRef(false)

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
        const aberta = listaRodadas.find((r) => r.status === 'aberta')
        idAlvo = aberta ? aberta.id : listaRodadas[0].id
        setSelectedRodadaId(idAlvo)
        onRodadaChange?.(idAlvo)
      }

      if (idAlvo) {
        const [listaNecessidades, listaCotacoes] = await Promise.all([
          api.list_needs(idAlvo),
          api.list_quotes(idAlvo),
        ])
        setNecessidades(listaNecessidades)
        setCotacoes(listaCotacoes)

        const selecoes: Record<number, number | null> = {}
        listaNecessidades.forEach((n) => {
          if (n.id_fornecedor_selecionado) {
            selecoes[n.id_produto] = n.id_fornecedor_selecionado
          } else {
            const cotsDoProd = listaCotacoes
              .filter((c) => c.id_produto === n.id_produto)
              .sort((a, b) => a.preco_unitario - b.preco_unitario)
            if (cotsDoProd.length > 0) {
              selecoes[n.id_produto] = cotsDoProd[0].id_fornecedor
            }
          }
        })
        setFornecedoresSelecionados(selecoes)
      } else {
        setNecessidades([])
        setCotacoes([])
        setFornecedoresSelecionados({})
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

  // Fornecedores participantes com cotação na rodada (ou todos cadastrados se nenhum cotou)
  const fornecedoresNaTabela = useMemo(() => {
    const idsComCotacao = new Set(cotacoes.map((c) => c.id_fornecedor))
    const participantes = fornecedores.filter((f) => idsComCotacao.has(f.id))
    return participantes.length > 0 ? participantes : fornecedores
  }, [fornecedores, cotacoes])

  // Fornecedores efetivamente exibidos com base no filtro de visibilidade
  const fornecedoresExibidos = useMemo(() => {
    return fornecedoresNaTabela.filter(
      (f) => !fornecedoresOcultosIds.includes(f.id),
    )
  }, [fornecedoresNaTabela, fornecedoresOcultosIds])

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
        const valA =
          (sortField === 'produto'
            ? a.produto_nome
            : a.produto_categoria) || ''
        const valB =
          (sortField === 'produto'
            ? b.produto_nome
            : b.produto_categoria) || ''
        const cmp = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' })
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }

    return list
  }, [dadosLinhas, filtroCategoria, filtroTexto, sortField, sortDirection])

  // Atualiza medição de largura para o top-scrollbar sincronizado
  useEffect(() => {
    if (!tableContainerRef.current) return
    const updateWidth = () => {
      if (tableContainerRef.current) {
        setTableScrollWidth(tableContainerRef.current.scrollWidth)
      }
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(tableContainerRef.current)
    return () => observer.disconnect()
  }, [fornecedoresExibidos, dadosFiltrados, ocultarCategoria])

  // Sincronizadores de rolagem horizontal bidirecional
  const handleTableScroll = () => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }

  const handleTopScroll = () => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (tableContainerRef.current && topScrollRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }

  const scrollHorizontal = (offset: number) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

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

  const temFiltroAtivo = Boolean(
    filtroTexto.trim() ||
      filtroCategoria ||
      sortField ||
      fornecedoresOcultosIds.length > 0 ||
      ocultarCategoria,
  )

  // Verifica se há itens transferidos do menor preço na rodada
  const temItemTransferido = useMemo(() => {
    return dadosLinhas.some((linha) => {
      const menorCot = linha.ranking.length > 0 ? linha.ranking[0] : null
      const menorFornId = menorCot?.id_fornecedor
      const fornEscolhido =
        fornecedoresSelecionados[linha.id_produto] ||
        linha.id_fornecedor_selecionado ||
        menorFornId
      return Boolean(menorFornId && fornEscolhido && fornEscolhido !== menorFornId)
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

    setFornecedoresSelecionados((prev) => ({
      ...prev,
      [idProduto]: idFornecedor,
    }))

    try {
      const api = await getApi()
      await api.set_selected_supplier(selectedRodadaId, idProduto, idFornecedor)
      notifications.show({
        title: 'Fornecedor Selecionado',
        message: `"${produtoNome}" direcionado para "${fornecedorNome}".`,
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
        message:
          'Todas as escolhas da rodada foram redefinidas para o menor preço de cada item.',
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
    <Stack
      gap="xs"
      style={{
        width: '100%',
        height: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingBottom: 6,
      }}
    >
      <Box style={{ flexShrink: 0 }}>
        <PageHeader
          icon={IconScale}
          iconColor={themeColor}
          title="Mapa Comparativo de Cotações"
          subtitle="Normalização por unidade de medida com alta densidade e painéis sincronizados"
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

        {/* Cartões KPIs Padronizados */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" mt="xs">
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
            value={`${fornecedoresExibidos.length} de ${fornecedoresNaTabela.length}`}
            subtitle="Concorrentes cotados e visíveis na comparação"
            icon={IconTruck}
            color="teal"
            badge={{
              label:
                fornecedoresExibidos.length === fornecedoresNaTabela.length
                  ? 'Todos Visíveis'
                  : 'Filtrados',
              color: 'teal',
            }}
          />
        </SimpleGrid>
      </Box>

      {/* Conteúdo Principal */}
      {loading ? (
        <Center p="xl" style={{ flex: 1 }}>
          <Loader size="lg" />
        </Center>
      ) : necessidades.length === 0 ? (
        <EmptyState
          title="Nenhuma necessidade cadastrada nesta rodada"
          description="Adicione produtos na aba Necessidades para visualizar o comparativo de preços."
        />
      ) : (
        <Stack
          gap="xs"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Barra de Ferramentas, Filtros e Ações da Planilha */}
          <Paper withBorder radius="sm" p="xs" style={{ flexShrink: 0 }}>
            <Stack gap={6}>
              <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                <Group gap="xs" wrap="wrap" align="center">
                  <TextInput
                    size="xs"
                    placeholder="Buscar produto ou marca..."
                    leftSection={<IconSearch size={14} />}
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.currentTarget.value)}
                    style={{ width: 220 }}
                  />

                  <Select
                    size="xs"
                    placeholder="Todas as categorias"
                    data={categoriasUnicas}
                    value={filtroCategoria}
                    onChange={setFiltroCategoria}
                    clearable
                    style={{ width: 175 }}
                  />

                  {/* Filtro Dropdown de Fornecedores Visíveis */}
                  <Menu
                    shadow="md"
                    width={220}
                    position="bottom-start"
                    radius="xs"
                    withinPortal
                    closeOnItemClick={false}
                  >
                    <Menu.Target>
                      <Button
                        variant="light"
                        color={themeColor}
                        size="xs"
                        leftSection={<IconEye size={14} />}
                        rightSection={<IconChevronDown size={12} />}
                      >
                        Fornecedores ({fornecedoresExibidos.length}/{fornecedoresNaTabela.length})
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Group justify="space-between" p="xs" pb={4}>
                        <Text size="xs" fw={700}>
                          Fornecedores Visíveis
                        </Text>
                        <Group gap={4}>
                          <Button
                            variant="subtle"
                            size="compact-xs"
                            onClick={() => setFornecedoresOcultosIds([])}
                          >
                            Todos
                          </Button>
                        </Group>
                      </Group>
                      <Menu.Divider />
                      {fornecedoresNaTabela.map((forn) => {
                        const isVisible = !fornecedoresOcultosIds.includes(forn.id)
                        return (
                          <Menu.Item
                            key={forn.id}
                            closeMenuOnClick={false}
                            onClick={() => {
                              setFornecedoresOcultosIds((prev) =>
                                isVisible
                                  ? [...prev, forn.id]
                                  : prev.filter((id) => id !== forn.id),
                              )
                            }}
                          >
                            <Checkbox
                              size="xs"
                              label={forn.nome}
                              checked={isVisible}
                              readOnly
                              style={{ pointerEvents: 'none' }}
                            />
                          </Menu.Item>
                        )
                      })}
                    </Menu.Dropdown>
                  </Menu>

                  {/* Toggle para Ocultar/Exibir Categoria */}
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    leftSection={
                      ocultarCategoria ? (
                        <IconEye size={14} />
                      ) : (
                        <IconEyeOff size={14} />
                      )
                    }
                    onClick={() => setOcultarCategoria((prev) => !prev)}
                    title={
                      ocultarCategoria
                        ? 'Exibir coluna de categoria'
                        : 'Ocultar coluna de categoria para ganhar espaço'
                    }
                  >
                    {ocultarCategoria ? 'Mostrar Categoria' : 'Ocultar Categoria'}
                  </Button>

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
                        setFornecedoresOcultosIds([])
                        setOcultarCategoria(false)
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </Group>

                {/* Controles de Navegação Horizontal */}
                <Group gap={6} align="center">
                  <Text size="11px" c="dimmed">
                    Rolar matriz:
                  </Text>
                  <ActionIcon
                    variant="default"
                    size="xs"
                    onClick={() => scrollHorizontal(-250)}
                    title="Rolar para os fornecedores à esquerda"
                  >
                    <IconArrowLeft size={13} />
                  </ActionIcon>
                  <ActionIcon
                    variant="default"
                    size="xs"
                    onClick={() => scrollHorizontal(250)}
                    title="Rolar para os fornecedores à direita"
                  >
                    <IconArrowRight size={13} />
                  </ActionIcon>

                  <Badge size="xs" variant="light" color="gray" ml={4}>
                    {dadosFiltrados.length} de {dadosLinhas.length} itens
                  </Badge>
                </Group>
              </Group>

              {/* Legenda Semântica Discreta */}
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
                  <Badge
                    size="xs"
                    variant="light"
                    color="teal"
                    radius="xs"
                    style={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Verde: Selecionado para Compra (🏆 Menor Preço)
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
                    Neutro: Demais Cotações
                  </Badge>
                  <Text size="11px" c="dimmed" fs="italic">
                    • Clique na célula para direcionar a compra
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
                    title="Restaurar todas as escolhas da rodada para o menor preço"
                  >
                    Restaurar Menores Preços
                  </Button>
                )}
              </Group>
            </Stack>
          </Paper>

          {/* Super-Planilha de Alta Densidade com Barra de Rolagem Superior Sincronizada */}
          <Paper
            withBorder
            radius="sm"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--mantine-color-body)',
            }}
          >
            {/* 1. Trilho de Rolagem Superior Sincronizado (Top Scrollbar) */}
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="comparacao-top-scroll-container"
              style={{ flexShrink: 0 }}
              title="Arraste para rolar horizontalmente entre os fornecedores"
            >
              <div style={{ width: tableScrollWidth || 1200, height: 1 }} />
            </div>

            {/* 2. Container da Tabela com Rolagem Principal */}
            <div
              ref={tableContainerRef}
              onScroll={handleTableScroll}
              className="tabela-comparacao-container"
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                overflowX: 'auto',
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
                  width: 'max-content',
                  minWidth: '100%',
                }}
              >
                <Table.Thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backgroundColor: isDark
                      ? 'var(--mantine-color-dark-7)'
                      : 'var(--mantine-color-gray-1)',
                  }}
                >
                  <Table.Tr>
                    {/* Coluna Fixa 1: Produto */}
                    <Table.Th
                      style={{
                        position: 'sticky',
                        left: 0,
                        top: 0,
                        zIndex: 12,
                        width: 190,
                        minWidth: 190,
                        maxWidth: 190,
                        backgroundColor: isDark
                          ? 'var(--mantine-color-dark-7)'
                          : 'var(--mantine-color-gray-1)',
                        padding: '4px 6px',
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
                              variant={
                                sortField === 'produto' ? 'filled' : 'subtle'
                              }
                              color={
                                sortField === 'produto' ? themeColor : 'gray'
                              }
                              size="xs"
                              title="Ordenar produto"
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
                            >
                              Classificar de A a Z
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconSortDescending size={14} />}
                              onClick={() => {
                                setSortField('produto')
                                setSortDirection('desc')
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

                    {/* Coluna Fixa 2: Categoria (Ocultável) */}
                    {!ocultarCategoria && (
                      <Table.Th
                        style={{
                          position: 'sticky',
                          left: 190,
                          top: 0,
                          zIndex: 12,
                          width: 105,
                          minWidth: 105,
                          maxWidth: 105,
                          backgroundColor: isDark
                            ? 'var(--mantine-color-dark-7)'
                            : 'var(--mantine-color-gray-1)',
                          padding: '4px 6px',
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
                                variant={
                                  sortField === 'categoria'
                                    ? 'filled'
                                    : 'subtle'
                                }
                                color={
                                  sortField === 'categoria'
                                    ? themeColor
                                    : 'gray'
                                }
                                size="xs"
                                title="Ordenar categoria"
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
                              >
                                Classificar de A a Z
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconSortDescending size={14} />}
                                onClick={() => {
                                  setSortField('categoria')
                                  setSortDirection('desc')
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
                    )}

                    {/* Cabeçalhos Dinâmicos dos Fornecedores Visíveis */}
                    {fornecedoresExibidos.map((forn) => (
                      <Table.Th
                        key={forn.id}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 9,
                          textAlign: 'center',
                          width: 'var(--app-comparacao-col-w)',
                          minWidth: 'var(--app-comparacao-col-min-w)',
                          backgroundColor: isDark
                            ? 'var(--mantine-color-dark-7)'
                            : 'var(--mantine-color-gray-1)',
                          padding: '5px 6px',
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
                        colSpan={
                          (ocultarCategoria ? 1 : 2) +
                          fornecedoresExibidos.length
                        }
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
                              width: 190,
                              minWidth: 190,
                              maxWidth: 190,
                              backgroundColor: isDark
                                ? 'var(--mantine-color-dark-7)'
                                : 'var(--mantine-color-body)',
                              padding: '3px 6px',
                              borderRight:
                                '1px solid var(--mantine-color-default-border)',
                              borderBottom:
                                '1px solid var(--mantine-color-default-border)',
                              boxShadow: ocultarCategoria
                                ? '2px 0 4px -2px rgba(0,0,0,0.12)'
                                : undefined,
                              verticalAlign: 'middle',
                            }}
                          >
                            <Text
                              fw={600}
                              size="xs"
                              lineClamp={1}
                              title={linha.produto_nome}
                              style={{ lineHeight: 1.15 }}
                            >
                              {linha.produto_nome}
                            </Text>
                          </Table.Td>

                          {/* Coluna 2 Fixa: Categoria */}
                          {!ocultarCategoria && (
                            <Table.Td
                              style={{
                                position: 'sticky',
                                left: 190,
                                zIndex: 5,
                                width: 105,
                                minWidth: 105,
                                maxWidth: 105,
                                backgroundColor: isDark
                                  ? 'var(--mantine-color-dark-7)'
                                  : 'var(--mantine-color-body)',
                                padding: '3px 6px',
                                borderRight:
                                  '2px solid var(--mantine-color-default-border)',
                                borderBottom:
                                  '1px solid var(--mantine-color-default-border)',
                                boxShadow: '2px 0 4px -2px rgba(0,0,0,0.10)',
                                verticalAlign: 'middle',
                              }}
                            >
                              <Text
                                size="xs"
                                truncate="end"
                                c={
                                  !linha.produto_categoria ? 'dimmed' : undefined
                                }
                                title={linha.produto_categoria || '-'}
                                style={{ lineHeight: 1.15 }}
                              >
                                {linha.produto_categoria || '-'}
                              </Text>
                            </Table.Td>
                          )}

                          {/* Colunas dos Fornecedores Visíveis */}
                          {fornecedoresExibidos.map((forn) => {
                            const cot = linha.cotacoesPorFornecedor[forn.id]

                            if (!cot) {
                              return (
                                <Table.Td
                                  key={forn.id}
                                  style={{
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    padding:
                                      'var(--app-comparacao-cell-py) var(--app-comparacao-cell-px)',
                                    borderRight:
                                      '1px solid var(--mantine-color-default-border)',
                                    borderBottom:
                                      '1px solid var(--mantine-color-default-border)',
                                    backgroundColor: isDark
                                      ? 'transparent'
                                      : 'var(--mantine-color-gray-0)',
                                  }}
                                >
                                  <Text size="xs" c="dimmed">
                                    -
                                  </Text>
                                </Table.Td>
                              )
                            }

                            const menorCot =
                              ranking.length > 0 ? ranking[0] : null
                            const menorPreco = menorCot?.preco_unitario
                            const menorFornId = menorCot?.id_fornecedor
                            const fornEscolhidoId =
                              fornecedoresSelecionados[linha.id_produto] ||
                              linha.id_fornecedor_selecionado ||
                              menorFornId

                            const isSelecionado = forn.id === fornEscolhidoId
                            const isMenorPreco =
                              cot.preco_unitario === menorPreco
                            const isTransferido = Boolean(
                              fornEscolhidoId &&
                                menorFornId &&
                                fornEscolhidoId !== menorFornId,
                            )
                            const isMenorPrecoPreterido =
                              isTransferido && isMenorPreco
                            const { economiaPct } = linha

                            let bgCell = isDark
                              ? 'transparent'
                              : 'var(--mantine-color-body)'
                            let textPrecoColor: string | undefined = undefined
                            let borderCell =
                              '1px solid var(--mantine-color-default-border)'

                            if (isSelecionado) {
                              bgCell = isDark
                                ? 'rgba(18, 184, 134, 0.22)'
                                : 'var(--mantine-color-teal-0)'
                              textPrecoColor = isDark
                                ? 'var(--mantine-color-teal-2)'
                                : 'var(--mantine-color-teal-9)'
                              borderCell = '2px solid var(--mantine-color-teal-6)'
                            } else if (isMenorPrecoPreterido) {
                              bgCell = isDark
                                ? 'rgba(34, 139, 230, 0.20)'
                                : 'var(--mantine-color-blue-0)'
                              textPrecoColor = isDark
                                ? 'var(--mantine-color-blue-3)'
                                : 'var(--mantine-color-blue-8)'
                              borderCell = '1px solid var(--mantine-color-blue-4)'
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
                                  padding:
                                    'var(--app-comparacao-cell-py) var(--app-comparacao-cell-px)',
                                  borderRight: borderCell,
                                  borderBottom: borderCell,
                                  borderLeft: isSelecionado ? borderCell : undefined,
                                  borderTop: isSelecionado ? borderCell : undefined,
                                  cursor: isClickable ? 'pointer' : 'default',
                                  userSelect: 'none',
                                  transition:
                                    'background-color 150ms ease, border-color 150ms ease',
                                }}
                              >
                                <Tooltip
                                  withinPortal
                                  withArrow
                                  position="top"
                                  multiline
                                  w={230}
                                  label={
                                    <Stack gap={2} p={2}>
                                      <Text fw={700} size="xs">
                                        {forn.nome}
                                      </Text>
                                      <Text size="11px">
                                        Item: {linha.produto_nome}
                                      </Text>
                                      <Text size="11px">
                                        Marca:{' '}
                                        {cot.marca || '(Não informada)'}
                                      </Text>
                                      <Text size="11px">
                                        Embalagem: {cot.embalagem} (
                                        {formatMoney(cot.preco_embalagem, 2)})
                                      </Text>
                                      <Text size="11px">
                                        Qtd na Emb: {cot.qtd_por_embalagem}{' '}
                                        {cot.unidade}
                                      </Text>
                                      <Text size="11px" fw={700}>
                                        Preço Unitário:{' '}
                                        {formatMoney(cot.preco_unitario)}
                                      </Text>
                                      {isMenorPreco && (
                                        <Text size="10px" c="teal" fw={700}>
                                          🏆 Menor Preço da Rodada
                                        </Text>
                                      )}
                                      {isSelecionado && !isMenorPreco && (
                                        <Text size="10px" c="teal" fw={700}>
                                          ✓ Fornecedor Escolhido para Compra
                                        </Text>
                                      )}
                                      {isMenorPrecoPreterido && (
                                        <Text size="10px" c="blue" fw={700}>
                                          Menor Preço (Preterido)
                                        </Text>
                                      )}
                                    </Stack>
                                  }
                                >
                                  <div
                                    style={{
                                      width: '100%',
                                      overflow: 'hidden',
                                      lineHeight: 1.15,
                                    }}
                                  >
                                    {/* Linha 1: Preço Unitário e Indicador Discreto */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 3,
                                      }}
                                    >
                                      {isMenorPreco && (
                                        <span
                                          style={{ fontSize: '10px' }}
                                          title="Menor Preço"
                                        >
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
                                          title="Selecionado"
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
                                      {isMenorPreco &&
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

                                    {/* Linha 2: Marca e Embalagem em Linha Única Concisa */}
                                    <Text
                                      size="10px"
                                      c="dimmed"
                                      truncate="end"
                                      ta="center"
                                      style={{ lineHeight: 1.1, marginTop: 2 }}
                                    >
                                      {cot.marca ? `${cot.marca} · ` : ''}
                                      {cot.embalagem}
                                    </Text>
                                  </div>
                                </Tooltip>
                              </Table.Td>
                            )
                          })}
                        </Table.Tr>
                      )
                    })
                  )}
                </Table.Tbody>
              </Table>
            </div>
          </Paper>
        </Stack>
      )}
    </Stack>
  )
}

export default ComparacaoView
