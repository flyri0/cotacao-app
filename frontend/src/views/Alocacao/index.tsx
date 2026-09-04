import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowsSplit,
  IconCheck,
  IconListCheck,
  IconScale,
  IconSparkles,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoundHeaderSelector } from '../../components/form/RoundHeaderSelector'
import { StatCard } from '../../components/ui/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { getApi } from '../../services/api'
import type { Cotacao, Fornecedor, Necessidade, Rodada } from '../../types'
import { useAlocacaoColumns } from './useAlocacaoColumns'

// Formatação inteligente: mínimo 2 casas (R$ 5,00) e máximo 4 casas (R$ 0,043)
export function formatMoney(valor: number, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

export interface AlocacaoViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
  themeColor?: string
}

export interface LinhaAlocacao {
  key: string
  id?: number
  id_produto: number
  produto_nome: string
  id_fornecedor: number
  quantidade_alocada: number
}

export function AlocacaoView({
  rodadaAtivaId,
  onRodadaChange,
  themeColor = 'blue',
}: AlocacaoViewProps) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [linhas, setLinhas] = useState<LinhaAlocacao[]>([])
  const [loading, setLoading] = useState(true)
  const [statusAutosave, setStatusAutosave] = useState<'salvo' | 'salvando' | 'erro'>('salvo')

  const initialLoadDone = useRef(false)
  const autosaveTimeoutRef = useRef<number | null>(null)
  const linhasRef = useRef(linhas)
  linhasRef.current = linhas

  const rodadaAtual = rodadas.find((r) => r.id === selectedRodadaId)
  const isFechada = rodadaAtual?.status === 'fechada'

  // Função interna de salvamento automático silencioso (sem notificações modais invasivas)
  const executarSalvarSilencioso = useCallback(async (linhasParaSalvar: LinhaAlocacao[], rodadaId: number | null) => {
    if (!rodadaId || isFechada) return
    try {
      setStatusAutosave('salvando')
      const api = await getApi()
      const payload = linhasParaSalvar
        .filter((l) => Number(l.quantidade_alocada) > 0 && Number(l.id_fornecedor) > 0)
        .map((l) => ({
          id_produto: Number(l.id_produto),
          id_fornecedor: Number(l.id_fornecedor),
          quantidade: Number(l.quantidade_alocada),
        }))

      await api.save_allocations(rodadaId, payload)
      setStatusAutosave('salvo')
    } catch (err) {
      console.error('Erro no autosave:', err)
      setStatusAutosave('erro')
    }
  }, [isFechada])

  const carregarDados = useCallback(
    async (rodadaId?: number) => {
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
          const [listaNec, listaCot, listaAloc] = await Promise.all([
            api.list_needs(idAlvo),
            api.list_quotes(idAlvo),
            api.list_allocations(idAlvo),
          ])

          setNecessidades(listaNec)
          setCotacoes(listaCot)

          // Constrói as linhas de alocação garantindo que todas as necessidades da rodada estejam presentes
          const linhasCarregadas: LinhaAlocacao[] = []

          listaNec.forEach((n, idx) => {
            // Verifica se já existem alocações salvas no banco para este produto
            const alocsDoProd = listaAloc.filter(
              (a) => Number(a.id_produto) === Number(n.id_produto),
            )

            if (alocsDoProd.length > 0) {
              alocsDoProd.forEach((a, subIdx) => {
                // Se houver apenas 1 linha e o usuário tiver pré-selecionado um fornecedor na Comparação
                const fornFinal =
                  alocsDoProd.length === 1 &&
                  n.id_fornecedor_selecionado &&
                  n.id_fornecedor_selecionado > 0
                    ? Number(n.id_fornecedor_selecionado)
                    : Number(a.id_fornecedor)

                linhasCarregadas.push({
                  key: `aloc-${a.id || idx}-${subIdx}-${Math.random().toString(36).substring(2, 6)}`,
                  id: a.id,
                  id_produto: Number(a.id_produto),
                  produto_nome: a.produto_nome || n.produto_nome,
                  id_fornecedor: fornFinal,
                  quantidade_alocada: Number(a.quantidade) || 0,
                })
              })
            } else {
              // Sem alocação salva ainda: usa o fornecedor escolhido na Comparação ou o menor preço
              const cotsDoProd = listaCot
                .filter((c) => Number(c.id_produto) === Number(n.id_produto))
                .sort((a, b) => Number(a.preco_unitario) - Number(b.preco_unitario))

              const melhorFornId =
                cotsDoProd.length > 0 ? Number(cotsDoProd[0].id_fornecedor) : 0

              const fornEscolhido =
                n.id_fornecedor_selecionado && n.id_fornecedor_selecionado > 0
                  ? Number(n.id_fornecedor_selecionado)
                  : melhorFornId

              linhasCarregadas.push({
                key: `init-${n.id_produto}-${idx}`,
                id_produto: Number(n.id_produto),
                produto_nome: n.produto_nome,
                id_fornecedor: fornEscolhido,
                quantidade_alocada: 0,
              })
            }
          })

          setLinhas(linhasCarregadas)
        }
      } catch (error) {
        console.error('Erro ao carregar dados de alocação:', error)
        notifications.show({
          title: 'Erro de comunicação',
          message: 'Não foi possível carregar as alocações da rodada.',
          color: 'red',
          icon: <IconX size={16} />,
        })
      } finally {
        setLoading(false)
      }
    },
    [selectedRodadaId, onRodadaChange],
  )

  useEffect(() => {
    carregarDados(selectedRodadaId || undefined)
  }, [])

  // Dispara Autosave com debounce de 600ms quando 'linhas' são modificadas
  useEffect(() => {
    if (!initialLoadDone.current) {
      if (!loading && linhas.length > 0) {
        initialLoadDone.current = true
      }
      return
    }

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      executarSalvarSilencioso(linhas, selectedRodadaId)
    }, 600)

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [linhas, selectedRodadaId, loading, executarSalvarSilencioso])

  // Salva imediatamente ao desmontar o componente (ex: ao trocar de tela no app)
  useEffect(() => {
    return () => {
      if (selectedRodadaId && initialLoadDone.current) {
        executarSalvarSilencioso(linhasRef.current, selectedRodadaId)
      }
    }
  }, [selectedRodadaId, executarSalvarSilencioso])

  // Atualiza quantidade alocada de uma linha específica
  const handleUpdateQtd = useCallback((key: string, valor: number | string) => {
    const num = typeof valor === 'number' ? valor : parseFloat(valor) || 0
    setLinhas((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, quantidade_alocada: Math.max(0, num) } : l,
      ),
    )
  }, [])

  // Atualiza fornecedor de uma linha específica e sincroniza com a decisão da Comparação
  const handleUpdateFornecedor = useCallback(
    (key: string, idFornStr: string | null) => {
      const idForn = idFornStr ? parseInt(idFornStr, 10) : 0
      const linha = linhasRef.current.find((l) => l.key === key)
      const idProd = linha ? linha.id_produto : null
      const totalLinhasProd = linha
        ? linhasRef.current.filter((l) => l.id_produto === linha.id_produto).length
        : 0

      setLinhas((prev) =>
        prev.map((l) => {
          if (l.key === key) {
            return { ...l, id_fornecedor: idForn }
          }
          return l
        }),
      )

      if (idProd && totalLinhasProd <= 1 && selectedRodadaId && idForn > 0 && !isFechada) {
        getApi()
          .then((api) => {
            api.set_selected_supplier(selectedRodadaId, idProd, idForn).catch(() => {})
          })
          .catch(() => {})
      }
    },
    [selectedRodadaId, isFechada],
  )

  // Ação "Dividir": Duplica a linha do mesmo produto com fornecedor e quantidade zerados
  const handleDividirLinha = useCallback((targetKey: string) => {
    let nomeProd = ''
    setLinhas((prev) => {
      const index = prev.findIndex((l) => l.key === targetKey)
      if (index === -1) return prev
      const linhaBase = prev[index]
      nomeProd = linhaBase.produto_nome
      const novaLinha: LinhaAlocacao = {
        key: `split-${linhaBase.id_produto}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 7)}`,
        id: undefined,
        id_produto: Number(linhaBase.id_produto),
        produto_nome: linhaBase.produto_nome,
        id_fornecedor: 0, // zerado
        quantidade_alocada: 0, // zerada para digitação
      }

      const novas = [...prev]
      novas.splice(index + 1, 0, novaLinha)
      return novas
    })

    notifications.show({
      title: 'Linha Dividida',
      message: nomeProd
        ? `Nova divisão criada para "${nomeProd}". Selecione o fornecedor e informe a quantidade.`
        : 'Nova divisão criada para o produto. Selecione o fornecedor e informe a quantidade.',
      color: 'blue',
      icon: <IconArrowsSplit size={16} />,
    })
  }, [])

  // Remove ou zera uma linha de alocação com confirmação Mantine
  const handleRemoverLinha = useCallback((targetKey: string, produtoNome: string) => {
    const linha = linhasRef.current.find((l) => l.key === targetKey)
    const totalLinhasProd = linha
      ? linhasRef.current.filter((l) => l.id_produto === linha.id_produto).length
      : 1
    const isDivisao = totalLinhasProd > 1

    modals.openConfirmModal({
      title: isDivisao ? 'Remover Divisão de Alocação' : 'Zerar Alocação',
      centered: true,
      children: (
        <Text size="sm">
          {isDivisao ? (
            <>
              Deseja remover esta divisão de compra para o produto <b>{produtoNome}</b>?
            </>
          ) : (
            <>
              Deseja zerar a quantidade alocada para o produto <b>{produtoNome}</b>?
            </>
          )}
        </Text>
      ),
      labels: {
        confirm: isDivisao ? 'Remover Divisão' : 'Zerar Quantidade',
        cancel: 'Cancelar',
      },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        setLinhas((prev) => {
          if (isDivisao) {
            return prev.filter((l) => l.key !== targetKey)
          }
          return prev.map((l) =>
            l.key === targetKey
              ? { ...l, quantidade_alocada: 0, id_fornecedor: 0 }
              : l,
          )
        })
      },
    })
  }, [])

  // Sugestão automática do Menor Preço (mantém as quantidades do usuário e não força quantidade fixa nem observação)
  const handleSugerirMenorPreco = () => {
    const novas: LinhaAlocacao[] = necessidades.map((n, idx) => {
      const cotsDoProd = cotacoes
        .filter((c) => Number(c.id_produto) === Number(n.id_produto))
        .sort((a, b) => Number(a.preco_unitario) - Number(b.preco_unitario))

      const melhorFornId =
        cotsDoProd.length > 0 ? Number(cotsDoProd[0].id_fornecedor) : 0

      // Mantém a quantidade que o usuário já tiver digitado para este produto
      const linhaExistente = linhas.find((l) => Number(l.id_produto) === Number(n.id_produto))
      const qtdAtual = linhaExistente ? Number(linhaExistente.quantidade_alocada) : 0

      return {
        key: `sug-${n.id_produto}-${idx}`,
        id_produto: Number(n.id_produto),
        produto_nome: n.produto_nome,
        id_fornecedor: melhorFornId,
        quantidade_alocada: qtdAtual,
      }
    })

    setLinhas(novas)

    if (selectedRodadaId && !isFechada) {
      getApi()
        .then((api) => {
          api.reset_selected_suppliers(selectedRodadaId).catch(() => {})
        })
        .catch(() => {})
    }

    notifications.show({
      title: 'Fornecedores Sugeridos',
      message: 'Selecionado o fornecedor com menor preço unitário para cada produto.',
      color: 'teal',
      icon: <IconSparkles size={16} />,
    })
  }

  // Atalho de teclado global Ctrl+S / Cmd+S para forçar sincronização imediata
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (selectedRodadaId && !isFechada) {
          executarSalvarSilencioso(linhasRef.current, selectedRodadaId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedRodadaId, isFechada, executarSalvarSilencioso])

  // Mapa de menor preço unitário por produto na rodada
  const menoresPrecosPorProduto = useMemo(() => {
    const map = new Map<number, number>()
    cotacoes.forEach((c) => {
      const pId = Number(c.id_produto)
      const preco = Number(c.preco_unitario)
      const atual = map.get(pId)
      if (atual === undefined || preco < atual) {
        map.set(pId, preco)
      }
    })
    return map
  }, [cotacoes])

  // Cálculos financeiros e estatísticos totais
  const totaisGerais = useMemo(() => {
    let subtotalGeral = 0
    let totalItensComprados = 0
    const fornecedoresSet = new Set<number>()
    const produtosSet = new Set<number>()

    linhas.forEach((l) => {
      const qtd = Number(l.quantidade_alocada) || 0
      const fornId = Number(l.id_fornecedor) || 0
      const prodId = Number(l.id_produto) || 0

      if (qtd > 0 && fornId > 0) {
        produtosSet.add(prodId)
        fornecedoresSet.add(fornId)

        const cot = cotacoes.find(
          (c) =>
            Number(c.id_produto) === prodId &&
            Number(c.id_fornecedor) === fornId,
        )
        const fator = cot && Number(cot.qtd_por_embalagem) > 0 ? Number(cot.qtd_por_embalagem) : 1
        const precoEmb = cot ? Number(cot.preco_embalagem) || 0 : 0
        const embComprar = Math.ceil(qtd / fator)

        subtotalGeral += embComprar * precoEmb
        totalItensComprados += embComprar * fator
      }
    })

    return {
      subtotalGeral,
      totalItensComprados,
      produtosComAlocacao: produtosSet.size,
      fornecedoresContemplados: fornecedoresSet.size,
    }
  }, [linhas, cotacoes])

  const columns = useAlocacaoColumns({
    cotacoes,
    fornecedores,
    menoresPrecosPorProduto,
    isFechada: isFechada ?? false,
    themeColor,
    handleDividirLinha,
    handleRemoverLinha,
    handleUpdateQtd,
    handleUpdateFornecedor,
  })

  const table = useMantineReactTable({
    enableDensityToggle: false,
    columns,
    data: linhas,
    memoMode: 'rows',
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: false,
    enableBottomToolbar: false,
    enableTopToolbar: true,
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
      {/* Cabeçalho Superior com Seletor e Botões de Ação */}
      <PageHeader
        icon={IconListCheck}
        iconColor={themeColor}
        title="Alocação de Compras"
        subtitle="Divisão e arredondamento automático para embalagens fechadas"
        rightSection={
          <Group gap="xs">
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

            <Button
              variant="light"
              color={themeColor}
              size="xs"
              leftSection={<IconSparkles size={14} />}
              onClick={handleSugerirMenorPreco}
              disabled={isFechada}
            >
              Sugerir Menor Preço
            </Button>

            {!isFechada && (
              statusAutosave === 'salvando' ? (
                <Badge variant="light" color={themeColor} size="xs" leftSection={<Loader size={10} color={themeColor} />}>
                  Salvando...
                </Badge>
              ) : statusAutosave === 'erro' ? (
                <Badge variant="light" color="red" size="xs" leftSection={<IconAlertCircle size={12} />}>
                  Erro ao salvar
                </Badge>
              ) : (
                <Badge variant="subtle" color="teal" size="xs" leftSection={<IconCheck size={12} />}>
                  Salvo automaticamente
                </Badge>
              )
            )}
          </Group>
        }
      />

      {/* Cartões de Resumo Analítico */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
        <StatCard
          label="Total do Pedido"
          value={formatMoney(totaisGerais.subtotalGeral)}
          subtitle="Total faturado"
          icon={IconScale}
          color="teal"
          badge={{ label: 'Embalagens Fechadas', color: 'teal' }}
        />

        <StatCard
          label="Produtos & Linhas"
          value={`${totaisGerais.produtosComAlocacao} de ${necessidades.length}`}
          subtitle={`${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'}`}
          icon={IconArrowsSplit}
          color={themeColor}
          badge={{ label: `${totaisGerais.totalItensComprados} itens`, color: themeColor }}
        />

        <StatCard
          label="Fornecedores"
          value={`${totaisGerais.fornecedoresContemplados} ${totaisGerais.fornecedoresContemplados === 1 ? 'fornecedor' : 'fornecedores'}`}
          subtitle="Com compras alocadas"
          icon={IconTruck}
          color="teal"
          badge={{ label: 'Ativos', color: 'teal' }}
        />
      </SimpleGrid>

      {/* Tabela Mantine React Table */}
      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : linhas.length === 0 ? (
        <EmptyState
          title="Nenhum produto registrado nesta rodada para alocar"
          description="Adicione produtos na aba Necessidades e lance Cotações para distribuir suas compras."
        />
      ) : (
        <MantineReactTable table={table} />
      )}
    </Stack>
  )
}

export default AlocacaoView
