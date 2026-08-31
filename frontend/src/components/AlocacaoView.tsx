import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Kbd,
  Loader,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconArrowsSplit,
  IconCheck,
  IconDeviceFloppy,
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
import { MRT_Localization_PT_BR } from '../locales/mrtPtBr'
import { PageHeader } from './common/PageHeader'
import { RoundHeaderSelector } from './common/RoundHeaderSelector'
import { StatCard } from './common/StatCard'
import { EmptyState } from './common/EmptyState'
import { AppSelect } from './common/AppSelect'
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

interface AlocacaoViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
}

export interface LinhaAlocacao {
  key: string
  id?: number
  id_produto: number
  produto_nome: string
  produto_unidade_padrao: string
  quantidade_necessaria: number
  id_fornecedor: number
  quantidade_alocada: number
  observacao?: string
}

export function AlocacaoView({
  rodadaAtivaId,
  onRodadaChange,
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
  const [saving, setSaving] = useState(false)

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
      const api = await getApi()
      const payload = linhasParaSalvar
        .filter((l) => Number(l.quantidade_alocada) > 0 && Number(l.id_fornecedor) > 0)
        .map((l) => ({
          id_produto: Number(l.id_produto),
          id_fornecedor: Number(l.id_fornecedor),
          quantidade: Number(l.quantidade_alocada),
          observacao: l.observacao || null,
        }))

      await api.salvar_alocacoes(rodadaId, payload)
    } catch (err) {
      console.error('Erro no autosave:', err)
    }
  }, [isFechada])

  const carregarDados = useCallback(
    async (rodadaId?: number) => {
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

          // Se já existirem alocações salvas no banco para a rodada, carrega-as
          if (listaAloc.length > 0) {
            const necMap = new Map<number, number>()
            listaNec.forEach((n) => necMap.set(Number(n.id_produto), Number(n.quantidade)))

            const carregadas: LinhaAlocacao[] = listaAloc.map((a, idx) => ({
              key: `aloc-${a.id || idx}-${Math.random().toString(36).substring(2, 6)}`,
              id: a.id,
              id_produto: Number(a.id_produto),
              produto_nome: a.produto_nome,
              produto_unidade_padrao: a.produto_unidade_padrao,
              quantidade_necessaria: necMap.get(Number(a.id_produto)) || 0,
              id_fornecedor: Number(a.id_fornecedor),
              quantidade_alocada: Number(a.quantidade) || 0,
              observacao: a.observacao || '',
            }))
            setLinhas(carregadas)
          } else {
            // Se não houver alocações salvas, cria uma linha inicial para cada necessidade
            const iniciais: LinhaAlocacao[] = listaNec.map((n, idx) => {
              const cotsDoProd = listaCot
                .filter((c) => Number(c.id_produto) === Number(n.id_produto))
                .sort((a, b) => Number(a.preco_unitario) - Number(b.preco_unitario))

              const melhorFornId =
                cotsDoProd.length > 0 ? Number(cotsDoProd[0].id_fornecedor) : 0

              return {
                key: `init-${n.id_produto}-${idx}`,
                id_produto: Number(n.id_produto),
                produto_nome: n.produto_nome,
                produto_unidade_padrao: n.produto_unidade_padrao,
                quantidade_necessaria: Number(n.quantidade) || 0,
                id_fornecedor: melhorFornId,
                quantidade_alocada: 0,
                observacao: '',
              }
            })
            setLinhas(iniciais)
          }
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
  const handleUpdateQtd = (key: string, valor: number | string) => {
    const num = typeof valor === 'number' ? valor : parseFloat(valor) || 0
    setLinhas((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, quantidade_alocada: Math.max(0, num) } : l,
      ),
    )
  }

  // Atualiza fornecedor de uma linha específica
  const handleUpdateFornecedor = (key: string, idFornStr: string | null) => {
    const idForn = idFornStr ? parseInt(idFornStr, 10) : 0
    setLinhas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, id_fornecedor: idForn } : l)),
    )
  }

  // Ação "Dividir": Duplica a linha do mesmo produto com fornecedor e quantidade zerados
  const handleDividirLinha = (index: number) => {
    const linhaBase = linhas[index]
    const novaLinha: LinhaAlocacao = {
      key: `split-${linhaBase.id_produto}-${Math.random()
        .toString(36)
        .substring(2, 7)}`,
      id: undefined,
      id_produto: Number(linhaBase.id_produto),
      produto_nome: linhaBase.produto_nome,
      produto_unidade_padrao: linhaBase.produto_unidade_padrao,
      quantidade_necessaria: Number(linhaBase.quantidade_necessaria),
      id_fornecedor: 0, // zerado
      quantidade_alocada: 0, // zerada para digitação
      observacao: '',
    }

    const novas = [...linhas]
    novas.splice(index + 1, 0, novaLinha)
    setLinhas(novas)

    notifications.show({
      title: 'Linha Dividida',
      message: `Nova linha criada para "${linhaBase.produto_nome}". Selecione o segundo fornecedor e informe a quantidade.`,
      color: 'blue',
      icon: <IconArrowsSplit size={16} />,
    })
  }

  // Remove uma linha de alocação com confirmação Mantine
  const handleRemoverLinha = (key: string, produtoNome: string) => {
    modals.openConfirmModal({
      title: 'Remover Linha de Alocação',
      centered: true,
      children: (
        <Text size="sm">
          Deseja remover esta linha de compra para o produto <b>{produtoNome}</b>?
        </Text>
      ),
      labels: { confirm: 'Remover Linha', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        setLinhas((prev) => prev.filter((l) => l.key !== key))
      },
    })
  }

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
        produto_unidade_padrao: n.produto_unidade_padrao,
        quantidade_necessaria: Number(n.quantidade) || 0,
        id_fornecedor: melhorFornId,
        quantidade_alocada: qtdAtual,
        observacao: '',
      }
    })

    setLinhas(novas)
    notifications.show({
      title: 'Fornecedores Sugeridos',
      message: 'Selecionado o fornecedor com menor preço unitário para cada produto.',
      color: 'teal',
      icon: <IconSparkles size={16} />,
    })
  }

  // Salvar manual no backend SQLite
  const handleSalvar = useCallback(async () => {
    if (!selectedRodadaId) return

    try {
      setSaving(true)
      const api = await getApi()
      const payload = linhas
        .filter((l) => Number(l.quantidade_alocada) > 0 && Number(l.id_fornecedor) > 0)
        .map((l) => ({
          id_produto: Number(l.id_produto),
          id_fornecedor: Number(l.id_fornecedor),
          quantidade: Number(l.quantidade_alocada),
          observacao: l.observacao || null,
        }))

      await api.salvar_alocacoes(selectedRodadaId, payload)

      notifications.show({
        title: 'Alocações Salvas com Sucesso',
        message: `${payload.length} decisões de compra foram salvas para a rodada.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      await carregarDados(selectedRodadaId)
    } catch (error: any) {
      console.error('Erro ao salvar alocações:', error)
      notifications.show({
        title: 'Erro ao salvar',
        message: error?.message || 'Não foi possível gravar as alocações.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSaving(false)
    }
  }, [selectedRodadaId, linhas, carregarDados])

  // Atalho de teclado global Ctrl+S / Cmd+S para salvar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSalvar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSalvar])

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

  // Definição das Colunas da Mantine React Table reformulada
  const columns = useMemo<MRT_ColumnDef<LinhaAlocacao>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 240,
        Cell: ({ row }) => {
          const item = row.original
          return (
            <Stack gap={2}>
              <Text fw={600} size="sm">
                {item.produto_nome}
              </Text>
              <Group gap={6}>
                <Badge size="xs" variant="light" color="indigo">
                  Unidade: {item.produto_unidade_padrao}
                </Badge>
                <Text size="xs" c="dimmed">
                  Necessidade: <b>{item.quantidade_necessaria}</b> {item.produto_unidade_padrao}
                </Text>
              </Group>
            </Stack>
          )
        },
      },
      {
        accessorKey: 'quantidade_alocada',
        header: 'Qtd a Comprar',
        size: 150,
        Cell: ({ row }) => {
          const item = row.original
          return (
            <NumberInput
              value={item.quantidade_alocada}
              onChange={(val) => handleUpdateQtd(item.key, val)}
              disabled={isFechada}
              min={0}
              decimalScale={2}
              size="xs"
              rightSectionWidth={75}
              rightSectionPointerEvents="none"
              rightSection={
                <Text size="xs" fw={700} c="dimmed" mr={8}>
                  {item.produto_unidade_padrao}
                </Text>
              }
              styles={{
                input: {
                  fontWeight: 600,
                  textAlign: 'right',
                  paddingRight: 80,
                },
              }}
            />
          )
        },
      },
      {
        accessorKey: 'id_fornecedor',
        header: 'Fornecedor Final',
        size: 240,
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
              label: `${c.fornecedor_nome}${isMenor ? ' ⭐ (Melhor Preço)' : ''}`,
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
            />
          )
        },
      },
      {
        id: 'preco_unitario',
        header: 'Preço Unitário',
        size: 150,
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
            <Stack gap={2}>
              <Text fw={700} size="sm" c={isMenor ? 'teal.7' : undefined}>
                {formatMoney(cot.preco_unitario)} / {item.produto_unidade_padrao}
              </Text>
              {isMenor ? (
                <Badge
                  color="teal"
                  variant="light"
                  size="xs"
                  leftSection={<IconSparkles size={10} />}
                >
                  Menor Preço
                </Badge>
              ) : menorPreco && menorPreco > 0 ? (
                <Text size="xs" c="dimmed">
                  +{(((cot.preco_unitario - menorPreco) / menorPreco) * 100).toFixed(1)}% vs menor
                </Text>
              ) : null}
            </Stack>
          )
        },
      },
      {
        id: 'embalagem_cotada',
        header: 'Embalagem Cotada',
        size: 180,
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
            <Stack gap={2}>
              <Badge color="indigo" variant="outline" size="sm">
                {cot.embalagem}
              </Badge>
              <Text size="xs" c="dimmed">
                {formatMoney(cot.preco_embalagem)} ({cot.qtd_por_embalagem} {item.produto_unidade_padrao})
              </Text>
            </Stack>
          )
        },
      },
      {
        id: 'embalagens_comprar',
        header: 'Compra Efetiva',
        size: 190,
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

          const fator =
            cot.qtd_por_embalagem > 0 ? cot.qtd_por_embalagem : 1
          const embComprar = Math.ceil(item.quantidade_alocada / fator)
          const totalEfetivo = embComprar * fator
          const diferenca = totalEfetivo - item.quantidade_alocada

          return (
            <Stack gap={2}>
              <Badge color="teal" variant="light" size="sm">
                {embComprar} {embComprar === 1 ? 'embalagem' : 'embalagens'}
              </Badge>
              <Text size="xs" c="dimmed">
                Total: <b>{totalEfetivo}</b> {item.produto_unidade_padrao}
                {diferenca > 0 && (
                  <Text span c="blue" fw={600}>
                    {' '}
                    (+{diferenca} sobra)
                  </Text>
                )}
              </Text>
            </Stack>
          )
        },
      },
      {
        id: 'subtotal',
        header: 'Subtotal (R$)',
        size: 140,
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || item.quantidade_alocada <= 0 || !cot) {
            return (
              <Text size="sm" c="dimmed">
                R$ 0,00
              </Text>
            )
          }

          const fator =
            cot.qtd_por_embalagem > 0 ? cot.qtd_por_embalagem : 1
          const embComprar = Math.ceil(item.quantidade_alocada / fator)
          const subtotal = embComprar * cot.preco_embalagem

          return (
            <Text fw={700} size="sm" c="teal">
              {formatMoney(subtotal)}
            </Text>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 90,
        Cell: ({ row }) => {
          const index = row.index
          const item = row.original

          return (
            <Group gap={6} justify="center">
              <Tooltip label="Dividir este item em outro fornecedor">
                <ActionIcon
                  variant="light"
                  color="blue"
                  size="sm"
                  disabled={isFechada}
                  onClick={() => handleDividirLinha(index)}
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
    [cotacoes, fornecedores, menoresPrecosPorProduto, isFechada],
  )

  const table = useMantineReactTable({
    columns,
    data: linhas,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: false,
    enableBottomToolbar: false,
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
      {/* Cabeçalho Superior com Seletor e Botões de Ação */}
      <PageHeader
        icon={IconListCheck}
        iconColor="teal"
        title="Alocação de Compras"
        subtitle="Defina o fornecedor e volume de compra com arredondamento automático para embalagens fechadas"
        rightSection={
          <Group gap="sm">
            {isFechada && (
              <Badge variant="filled" color="red" size="md">
                Rodada Fechada - Somente Leitura
              </Badge>
            )}

            <RoundHeaderSelector
              rodadas={rodadas}
              selectedRodadaId={selectedRodadaId}
              onSelectRodada={(id) => {
                setSelectedRodadaId(id)
                onRodadaChange?.(id)
                carregarDados(id)
              }}
            />

            <Button
              variant="light"
              color="indigo"
              leftSection={<IconSparkles size={16} />}
              onClick={handleSugerirMenorPreco}
              disabled={isFechada}
            >
              Sugerir Menor Preço
            </Button>

            <Button
              variant="filled"
              color="teal"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSalvar}
              loading={saving}
              disabled={isFechada}
            >
              Salvar Decisões <Kbd ml={6} size="xs">Ctrl+S</Kbd>
            </Button>
          </Group>
        }
      />

      {/* Cartões de Resumo Analítico */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard
          label="Valor Total do Pedido"
          value={formatMoney(totaisGerais.subtotalGeral)}
          subtitle="Total faturado em embalagens fechadas"
          icon={IconScale}
          color="teal"
          badge={{ label: 'Embalagens Fechadas', color: 'teal' }}
        />

        <StatCard
          label="Produtos & Linhas"
          value={`${totaisGerais.produtosComAlocacao} de ${necessidades.length} produtos`}
          subtitle={`${linhas.length} ${linhas.length === 1 ? 'linha de compra' : 'linhas de compra'}`}
          icon={IconArrowsSplit}
          color="blue"
          badge={{ label: `${totaisGerais.totalItensComprados} itens entregues`, color: 'blue' }}
        />

        <StatCard
          label="Fornecedores Contemplados"
          value={`${totaisGerais.fornecedoresContemplados} ${totaisGerais.fornecedoresContemplados === 1 ? 'fornecedor' : 'fornecedores'}`}
          subtitle="Parceiros com compras alocadas"
          icon={IconTruck}
          color="indigo"
          badge={{ label: 'Distribuição Ativa', color: 'indigo' }}
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

