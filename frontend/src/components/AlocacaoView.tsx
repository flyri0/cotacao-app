import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
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
  IconTrash,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import {
  AppSelect,
  EmptyState,
  PageHeader,
  QuantityInput,
  RoundHeaderSelector,
  StatCard,
} from './common'
import { calculatePackaging, formatMoney, getVirtualizedTableProps } from '../utils'
import { getApi } from '../services/api'
import type { Cotacao, Fornecedor, Necessidade, Rodada } from '../types'

interface AlocacaoViewProps {
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
        const { qtdEfetiva, subtotal } = calculatePackaging(
          qtd,
          cot ? Number(cot.qtd_por_embalagem) : 1,
          cot ? Number(cot.preco_embalagem) || 0 : 0,
        )

        subtotalGeral += subtotal
        totalItensComprados += qtdEfetiva
      }
    })

    return {
      subtotalGeral,
      totalItensComprados,
      produtosComAlocacao: produtosSet.size,
      fornecedoresContemplados: fornecedoresSet.size,
    }
  }, [linhas, cotacoes])

  // Definição das Colunas da Mantine React Table reformulada
  const columns = useMemo<MRT_ColumnDef<LinhaAlocacao>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 260,
        Cell: ({ row, table }) => {
          const item = row.original
          const allRows = (table.options.data as LinhaAlocacao[]) || []
          const linhasDoProd = allRows.filter((l) => l.id_produto === item.id_produto)
          const isDividido = linhasDoProd.length > 1
          const subIndex = isDividido
            ? linhasDoProd.findIndex((l) => l.key === item.key) + 1
            : 0

          return (
            <Group gap={6} wrap="nowrap" align="center">
              <Text fw={600} size="xs" style={{ flex: 1, wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.25 }}>
                {item.produto_nome}
              </Text>
              {isDividido && (
                <Badge
                  size="xs"
                  variant="light"
                  color={subIndex === 1 ? 'gray' : 'blue'}
                  style={{ flexShrink: 0 }}
                >
                  Parte {subIndex}/{linhasDoProd.length}
                </Badge>
              )}
            </Group>
          )
        },
      },
      {
        accessorKey: 'quantidade_alocada',
        header: 'Qtd a Comprar',
        size: 105,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => {
          const item = row.original
          return (
            <QuantityInput
              initialValue={item.quantidade_alocada}
              onChangeLive={(val) => handleUpdateQtd(item.key, val)}
              disabled={isFechada}
              width={75}
            />
          )
        },
      },
      {
        id: 'fornecedor',
        header: 'Fornecedor',
        size: 220,
        accessorFn: (row) => {
          if (!row.id_fornecedor) return 'Sem Fornecedor'
          const cot = cotacoes.find(
            (c) => c.id_produto === row.id_produto && c.id_fornecedor === row.id_fornecedor,
          )
          if (cot) return cot.fornecedor_nome
          const f = fornecedores.find((forn) => forn.id === row.id_fornecedor)
          return f ? f.nome : 'Sem Fornecedor'
        },
        Cell: ({ row }) => {
          const item = row.original
          const cotsDoProd = cotacoes.filter(
            (c) => c.id_produto === item.id_produto,
          )
          const menorPreco = menoresPrecosPorProduto.get(item.id_produto)

          const options = cotsDoProd.map((c) => {
            const isMenor = menorPreco !== undefined && c.preco_unitario <= menorPreco
            return {
              value: c.id_fornecedor.toString(),
              label: `${c.fornecedor_nome}${c.marca ? ` [${c.marca}]` : ''}${isMenor ? ' ⭐ (Melhor Preço)' : ''}`,
            }
          })

          if (options.length === 0) {
            fornecedores.forEach((f) => {
              options.push({
                value: f.id.toString(),
                label: `${f.nome} (Sem cotação)`,
              })
            })
          }

          return (
            <AppSelect
              data={options}
              value={item.id_fornecedor ? item.id_fornecedor.toString() : null}
              onChange={(val) => handleUpdateFornecedor(item.key, val)}
              placeholder="Selecione o fornecedor..."
              size="xs"
              searchable
              disabled={isFechada}
              clearable={false}
              style={{ width: '100%' }}
            />
          )
        },
      },
      {
        id: 'preco_unitario',
        header: 'Preço Unitário',
        size: 150,
        accessorFn: (row) => {
          const cot = cotacoes.find(
            (c) => c.id_produto === row.id_produto && c.id_fornecedor === row.id_fornecedor,
          )
          return cot ? cot.preco_unitario : 0
        },
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || !cot) {
            return (
              <Text size="xs" c="dimmed">
                -
              </Text>
            )
          }

          const menorPreco = menoresPrecosPorProduto.get(item.id_produto)
          const isMenor = menorPreco !== undefined && cot.preco_unitario <= menorPreco

          return (
            <div style={{ textAlign: 'right', width: '100%' }}>
              <Text fw={700} size="xs" c={isMenor ? 'teal' : undefined} style={{ whiteSpace: 'nowrap' }}>
                {formatMoney(cot.preco_unitario)} / {cot.unidade || 'UN'}
              </Text>
              {isMenor ? (
                <Text size="10px" c="teal" fw={600} style={{ whiteSpace: 'nowrap' }}>
                  ⭐ Menor Preço
                </Text>
              ) : menorPreco && menorPreco > 0 ? (
                <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  +{(((cot.preco_unitario - menorPreco) / menorPreco) * 100).toFixed(0)}% vs menor
                </Text>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'embalagem_cotada',
        header: 'Embalagem',
        size: 180,
        accessorFn: (row) => {
          const cot = cotacoes.find(
            (c) => c.id_produto === row.id_produto && c.id_fornecedor === row.id_fornecedor,
          )
          return cot ? `${cot.marca ? `[${cot.marca}] ` : ''}${cot.embalagem}` : ''
        },
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || !cot) {
            return (
              <Text size="xs" c="dimmed">
                -
              </Text>
            )
          }

          return (
            <div style={{ width: '100%' }}>
              <Text size="xs" fw={600} style={{ wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.25 }}>
                {cot.marca ? `[${cot.marca}] ` : ''}{cot.embalagem}
              </Text>
              <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {formatMoney(cot.preco_embalagem)} ({cot.qtd_por_embalagem} {cot.unidade || 'UN'})
              </Text>
            </div>
          )
        },
      },
      {
        id: 'embalagens_comprar',
        header: 'Compra Efetiva',
        size: 170,
        accessorFn: (row) => {
          const cot = cotacoes.find(
            (c) => c.id_produto === row.id_produto && c.id_fornecedor === row.id_fornecedor,
          )
          if (!row.id_fornecedor || row.quantidade_alocada <= 0 || !cot) return 0
          const { embComprar } = calculatePackaging(
            row.quantidade_alocada,
            cot.qtd_por_embalagem,
            cot.preco_embalagem,
          )
          return embComprar
        },
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || item.quantidade_alocada <= 0 || !cot) {
            return (
              <Text size="xs" c="dimmed">
                -
              </Text>
            )
          }

          const { embComprar, qtdEfetiva, sobra } = calculatePackaging(
            item.quantidade_alocada,
            cot.qtd_por_embalagem,
            cot.preco_embalagem,
          )

          return (
            <div style={{ width: '100%' }}>
              <Text size="xs" fw={600} style={{ whiteSpace: 'nowrap' }}>
                {embComprar} {embComprar === 1 ? 'embalagem' : 'embalagens'}
              </Text>
              <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                Total: <b>{qtdEfetiva}</b> {cot.unidade || 'UN'}
                {sobra > 0 && (
                  <Text span c={themeColor} fw={600}>
                    {' '}
                    (+{sobra} sobra)
                  </Text>
                )}
              </Text>
            </div>
          )
        },
      },
      {
        id: 'subtotal',
        header: 'Subtotal',
        size: 120,
        accessorFn: (row) => {
          const cot = cotacoes.find(
            (c) => c.id_produto === row.id_produto && c.id_fornecedor === row.id_fornecedor,
          )
          if (!row.id_fornecedor || row.quantidade_alocada <= 0 || !cot) return 0
          const { subtotal } = calculatePackaging(
            row.quantidade_alocada,
            cot.qtd_por_embalagem,
            cot.preco_embalagem,
          )
          return subtotal
        },
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || item.quantidade_alocada <= 0 || !cot) {
            return (
              <Text size="xs" c="dimmed">
                R$ 0,00
              </Text>
            )
          }

          const { subtotal } = calculatePackaging(
            item.quantidade_alocada,
            cot.qtd_por_embalagem,
            cot.preco_embalagem,
          )

          return (
            <Text fw={700} size="xs" c="teal">
              {formatMoney(subtotal)}
            </Text>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 80,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const item = row.original

          return (
            <Group gap={4} justify="center" wrap="nowrap">
              <Tooltip label="Dividir este item em outro fornecedor">
                <ActionIcon
                  variant="subtle"
                  color={themeColor}
                  size="sm"
                  disabled={isFechada}
                  onClick={() => handleDividirLinha(item.key)}
                >
                  <IconArrowsSplit size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Remover esta linha de alocação">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  disabled={isFechada}
                  onClick={() => handleRemoverLinha(item.key, item.produto_nome)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [
      cotacoes,
      fornecedores,
      menoresPrecosPorProduto,
      isFechada,
      themeColor,
      handleDividirLinha,
      handleRemoverLinha,
      handleUpdateQtd,
      handleUpdateFornecedor,
    ],
  )

  const table = useMantineReactTable({
    ...getVirtualizedTableProps<LinhaAlocacao>({
      enableTopToolbar: true,
      enableRowVirtualization: false,
      enableColumnFilters: true,
      enableGlobalFilter: true,
    }),
    columns,
    data: linhas,
    getRowId: (row) => row.key,
    enableRowActions: false,
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
      </Box>

      {/* Tabela Mantine React Table */}
      <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading ? (
          <Center p="xl" style={{ flex: 1 }}>
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
      </Box>
    </Stack>
  )
}

export default AlocacaoView

