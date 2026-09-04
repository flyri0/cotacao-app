import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Menu,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconFilterOff,
  IconRotate,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-react'
import type { Cotacao, Fornecedor, Necessidade } from '../../types'

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

// Formatação inteligente: mínimo 2 casas (R$ 5,00) e máximo 4 casas (R$ 0,043)
function formatMoney(valor: number, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

interface ComparacaoTableProps {
  necessidades: Necessidade[]
  cotacoes: Cotacao[]
  fornecedoresNaTabela: Fornecedor[]
  fornecedoresSelecionados: Record<number, number | null>
  isFechada: boolean
  themeColor: string
  onSelecionarFornecedor: (
    idProduto: number,
    idFornecedor: number,
    produtoNome: string,
    fornecedorNome: string,
  ) => void
  onRestaurarMenoresPrecos: () => void
}

export function ComparacaoTable({
  necessidades,
  cotacoes,
  fornecedoresNaTabela,
  fornecedoresSelecionados,
  isFechada,
  themeColor,
  onSelecionarFornecedor,
  onRestaurarMenoresPrecos,
}: ComparacaoTableProps) {
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: true,
  })
  const isDark = computedColorScheme === 'dark'

  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [fornecedoresOcultosIds, setFornecedoresOcultosIds] = useState<number[]>([])
  const [ocultarCategoria, setOcultarCategoria] = useState(false)

  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const [tableScrollWidth, setTableScrollWidth] = useState(0)
  const isSyncingScroll = useRef(false)

  const fornecedoresExibidos = useMemo(() => {
    return fornecedoresNaTabela.filter((f) => !fornecedoresOcultosIds.includes(f.id))
  }, [fornecedoresNaTabela, fornecedoresOcultosIds])

  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>()
    necessidades.forEach((n) => {
      if (n.produto_categoria) cats.add(n.produto_categoria)
    })
    return Array.from(cats).sort()
  }, [necessidades])

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

  const dadosFiltrados = useMemo(() => {
    let list = dadosLinhas.filter((linha) => {
      if (filtroCategoria && linha.produto_categoria !== filtroCategoria) return false
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

  useEffect(() => {
    if (tableContainerRef.current) {
      setTableScrollWidth(tableContainerRef.current.scrollWidth)
    }
  }, [fornecedoresExibidos, dadosFiltrados, ocultarCategoria])

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

  const temFiltroAtivo = Boolean(
    filtroTexto.trim() ||
      filtroCategoria ||
      sortField ||
      fornecedoresOcultosIds.length > 0 ||
      ocultarCategoria,
  )

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

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      <Paper withBorder radius="sm" p="xs">
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
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={ocultarCategoria ? <IconEye size={14} /> : <IconEyeOff size={14} />}
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
              <Badge size="xs" variant="outline" color="teal" radius="xs" style={{ textTransform: 'none', fontWeight: 600 }}>
                Verde: Selecionado para Compra (🏆 Menor Preço)
              </Badge>
              <Badge size="xs" variant="outline" color="blue" radius="xs" style={{ textTransform: 'none', fontWeight: 600 }}>
                Azul: Menor Preço (Preterido)
              </Badge>
              <Badge size="xs" variant="default" radius="xs" style={{ textTransform: 'none', fontWeight: 600 }}>
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
                onClick={onRestaurarMenoresPrecos}
                disabled={isFechada}
                title="Restaurar todas as escolhas da rodada para o menor preço"
              >
                Restaurar Menores Preços
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>

      <Paper
        withBorder
        radius="sm"
        style={{
          overflow: 'hidden',
          backgroundColor: 'var(--mantine-color-body)',
        }}
      >
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="comparacao-top-scroll-container"
          title="Arraste para rolar horizontalmente entre os fornecedores"
        >
          <div style={{ width: tableScrollWidth || 1200, height: 1 }} />
        </div>
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="tabela-comparacao-container"
          style={{
            maxHeight: 'calc(100vh - 250px)',
            width: '100%',
            overflow: 'auto',
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
                    borderBottom: '2px solid var(--mantine-color-default-border)',
                    borderRight: '1px solid var(--mantine-color-default-border)',
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap" gap={4}>
                    <Text fw={700} size="xs" tt="uppercase" c="dimmed">Produto</Text>
                    <Menu shadow="md" width={175} position="bottom-start" radius="xs" withinPortal>
                      <Menu.Target>
                        <ActionIcon
                          variant={sortField === 'produto' ? 'filled' : 'subtle'}
                          color={sortField === 'produto' ? themeColor : 'gray'}
                          size="xs"
                        >
                          {sortField === 'produto' ? (
                            sortDirection === 'asc' ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />
                          ) : (
                            <IconChevronDown size={11} />
                          )}
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>Classificar Produtos</Menu.Label>
                        <Menu.Item leftSection={<IconSortAscending size={14} />} onClick={() => { setSortField('produto'); setSortDirection('asc') }}>Classificar de A a Z</Menu.Item>
                        <Menu.Item leftSection={<IconSortDescending size={14} />} onClick={() => { setSortField('produto'); setSortDirection('desc') }}>Classificar de Z a A</Menu.Item>
                        {sortField === 'produto' && (
                          <><Menu.Divider /><Menu.Item color="red" leftSection={<IconFilterOff size={14} />} onClick={() => setSortField(null)}>Remover classificação</Menu.Item></>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Table.Th>
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
                      borderBottom: '2px solid var(--mantine-color-default-border)',
                      borderRight: '2px solid var(--mantine-color-default-border)',
                    }}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap" gap={4}>
                      <Text fw={700} size="xs" tt="uppercase" c="dimmed">Categoria</Text>
                      <Menu shadow="md" width={175} position="bottom-start" radius="xs" withinPortal>
                        <Menu.Target>
                          <ActionIcon
                            variant={sortField === 'categoria' ? 'filled' : 'subtle'}
                            color={sortField === 'categoria' ? themeColor : 'gray'}
                            size="xs"
                          >
                            {sortField === 'categoria' ? (
                              sortDirection === 'asc' ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />
                            ) : (
                              <IconChevronDown size={11} />
                            )}
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>Classificar Categorias</Menu.Label>
                          <Menu.Item leftSection={<IconSortAscending size={14} />} onClick={() => { setSortField('categoria'); setSortDirection('asc') }}>Classificar de A a Z</Menu.Item>
                          <Menu.Item leftSection={<IconSortDescending size={14} />} onClick={() => { setSortField('categoria'); setSortDirection('desc') }}>Classificar de Z a A</Menu.Item>
                          {sortField === 'categoria' && (
                            <><Menu.Divider /><Menu.Item color="red" leftSection={<IconFilterOff size={14} />} onClick={() => setSortField(null)}>Remover classificação</Menu.Item></>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Th>
                )}
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
                      borderBottom: '2px solid var(--mantine-color-default-border)',
                      borderRight: '1px solid var(--mantine-color-default-border)',
                    }}
                  >
                    <Text fw={700} size="xs" truncate="end" ta="center" title={forn.nome}>{forn.nome}</Text>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {dadosFiltrados.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={(ocultarCategoria ? 1 : 2) + fornecedoresExibidos.length} style={{ textAlign: 'center', padding: '32px' }}>
                    <Text size="xs" c="dimmed">Nenhum produto encontrado com os filtros selecionados.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                dadosFiltrados.map((linha) => {
                  const ranking = linha.ranking || []

                  return (
                    <Table.Tr key={linha.id}>
                      <Table.Td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 5,
                          width: 190,
                          minWidth: 190,
                          maxWidth: 190,
                          backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-body)',
                          padding: '3px 6px',
                          borderRight: '1px solid var(--mantine-color-default-border)',
                          borderBottom: '1px solid var(--mantine-color-default-border)',
                          boxShadow: ocultarCategoria ? '2px 0 4px -2px rgba(0,0,0,0.12)' : undefined,
                          verticalAlign: 'middle',
                        }}
                      >
                        <Text fw={600} size="xs" lineClamp={1} title={linha.produto_nome} style={{ lineHeight: 1.15 }}>{linha.produto_nome}</Text>
                      </Table.Td>
                      {!ocultarCategoria && (
                        <Table.Td
                          style={{
                            position: 'sticky',
                            left: 190,
                            zIndex: 5,
                            width: 105,
                            minWidth: 105,
                            maxWidth: 105,
                            backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-body)',
                            padding: '3px 6px',
                            borderRight: '2px solid var(--mantine-color-default-border)',
                            borderBottom: '1px solid var(--mantine-color-default-border)',
                            boxShadow: '2px 0 4px -2px rgba(0,0,0,0.10)',
                            verticalAlign: 'middle',
                          }}
                        >
                          <Text size="xs" truncate="end" c={!linha.produto_categoria ? 'dimmed' : undefined} title={linha.produto_categoria || '-'} style={{ lineHeight: 1.15 }}>{linha.produto_categoria || '-'}</Text>
                        </Table.Td>
                      )}
                      {fornecedoresExibidos.map((forn) => {
                        const cot = linha.cotacoesPorFornecedor[forn.id]
                        if (!cot) {
                          return (
                            <Table.Td
                              key={forn.id}
                              style={{
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                padding: 'var(--app-comparacao-cell-py) var(--app-comparacao-cell-px)',
                                borderRight: '1px solid var(--mantine-color-default-border)',
                                borderBottom: '1px solid var(--mantine-color-default-border)',
                                backgroundColor: isDark ? 'transparent' : 'var(--mantine-color-gray-0)',
                              }}
                            >
                              <Text size="xs" c="dimmed">-</Text>
                            </Table.Td>
                          )
                        }

                        const menorCot = ranking.length > 0 ? ranking[0] : null
                        const menorPreco = menorCot?.preco_unitario
                        const menorFornId = menorCot?.id_fornecedor
                        const fornEscolhidoId = fornecedoresSelecionados[linha.id_produto] || linha.id_fornecedor_selecionado || menorFornId

                        const isSelecionado = forn.id === fornEscolhidoId
                        const isMenorPreco = cot.preco_unitario === menorPreco
                        const isTransferido = Boolean(fornEscolhidoId && menorFornId && fornEscolhidoId !== menorFornId)
                        const isMenorPrecoPreterido = isTransferido && isMenorPreco
                        const { economiaPct } = linha

                        // Subtle colors for better dark mode readability
                        let bgCell = 'transparent'
                        let textPrecoColor: string | undefined = undefined
                        let borderCell = '1px solid var(--mantine-color-default-border)'

                        if (isSelecionado) {
                          textPrecoColor = isDark ? 'var(--mantine-color-teal-4)' : 'var(--mantine-color-teal-7)'
                          borderCell = '2px solid var(--mantine-color-teal-6)'
                        } else if (isMenorPrecoPreterido) {
                          textPrecoColor = isDark ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-blue-7)'
                          borderCell = '1px solid var(--mantine-color-blue-4)'
                        }

                        const isClickable = !isFechada

                        return (
                          <Table.Td
                            key={forn.id}
                            onClick={() => {
                              if (isClickable) {
                                onSelecionarFornecedor(linha.id_produto, forn.id, linha.produto_nome, forn.nome)
                              }
                            }}
                            style={{
                              backgroundColor: bgCell,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              padding: 'var(--app-comparacao-cell-py) var(--app-comparacao-cell-px)',
                              borderRight: borderCell,
                              borderBottom: borderCell,
                              borderLeft: isSelecionado ? borderCell : undefined,
                              borderTop: isSelecionado ? borderCell : undefined,
                              cursor: isClickable ? 'pointer' : 'default',
                              userSelect: 'none',
                              transition: 'border-color 150ms ease, color 150ms ease',
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
                                  <Text fw={700} size="xs">{forn.nome}</Text>
                                  <Text size="11px">Item: {linha.produto_nome}</Text>
                                  <Text size="11px">Marca: {cot.marca || '(Não informada)'}</Text>
                                  <Text size="11px">Embalagem: {cot.embalagem} ({formatMoney(cot.preco_embalagem, 2)})</Text>
                                  <Text size="11px">Qtd na Emb: {cot.qtd_por_embalagem} {cot.unidade}</Text>
                                  <Text size="11px" fw={700}>Preço Unitário: {formatMoney(cot.preco_unitario)}</Text>
                                  {isMenorPreco && <Text size="10px" c="teal" fw={700}>🏆 Menor Preço da Rodada</Text>}
                                  {isSelecionado && !isMenorPreco && <Text size="10px" c="teal" fw={700}>✓ Fornecedor Escolhido para Compra</Text>}
                                  {isMenorPrecoPreterido && <Text size="10px" c="blue" fw={700}>Menor Preço (Preterido)</Text>}
                                </Stack>
                              }
                            >
                              <div style={{ width: '100%', overflow: 'hidden', lineHeight: 1.15 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                  {isMenorPreco && <span style={{ fontSize: '10px' }} title="Menor Preço">🏆</span>}
                                  {isSelecionado && !isMenorPreco && <span style={{ fontSize: '11px', fontWeight: 700, color: textPrecoColor }} title="Selecionado">✓</span>}
                                  <Text fw={700} size="xs" c={textPrecoColor} style={{ whiteSpace: 'nowrap' }}>
                                    {formatMoney(cot.preco_unitario)}
                                  </Text>
                                  {isMenorPreco && economiaPct !== null && economiaPct > 0.1 && (
                                    <Text size="10px" fw={700} c={textPrecoColor} style={{ whiteSpace: 'nowrap' }}>(-{economiaPct.toFixed(0)}%)</Text>
                                  )}
                                </div>
                                <Text size="10px" c="dimmed" truncate="end" ta="center" style={{ lineHeight: 1.1, marginTop: 2 }}>
                                  {cot.marca ? `${cot.marca} · ` : ''}{cot.embalagem}
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
  )
}
