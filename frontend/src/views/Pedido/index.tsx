import { useEffect, useState, useMemo } from 'react'
import {
  Accordion,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCheck,
  IconClipboardCopy,
  IconFileText,
  IconPrinter,
  IconX,
} from '@tabler/icons-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoundHeaderSelector } from '../../components/form/RoundHeaderSelector'
import { EmptyState } from '../../components/ui/EmptyState'
import { getApi } from '../../services/api'
import type { Alocacao, Cotacao, Fornecedor, Rodada } from '../../types'
import type { PedidoPorFornecedor, ItemPedidoLinha } from './types'
import { PedidoAccordionItem } from './PedidoAccordionItem'

function formatMoney(valor: number, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

interface PedidoViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
  themeColor?: string
}

export function PedidoView({
  rodadaAtivaId,
  onRodadaChange,
  themeColor = 'blue',
}: PedidoViewProps) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [loading, setLoading] = useState(true)

  // Carrega rodadas e fornecedores
  const carregarDadosIniciais = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      const [rods, forns] = await Promise.all([
        api.list_rounds(),
        api.list_suppliers(),
      ])
      setRodadas(rods)
      setFornecedores(forns)

      if (rods.length > 0 && !selectedRodadaId) {
        const idAtiva = rods[0].id
        setSelectedRodadaId(idAtiva)
        onRodadaChange?.(idAtiva)
      }
    } catch (error) {
      console.error('Erro ao carregar dados da rodada:', error)
      notifications.show({
        title: 'Erro de comunicação',
        message: 'Não foi possível carregar as rodadas.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  // Carrega cotações e alocações da rodada ativa
  const carregarDadosRodada = async (idRodada: number) => {
    try {
      setLoading(true)
      const api = await getApi()
      const [cots, alocs] = await Promise.all([
        api.list_quotes(idRodada),
        api.list_allocations(idRodada),
      ])
      setCotacoes(cots)
      setAlocacoes(alocs)
    } catch (error) {
      console.error('Erro ao carregar itens da rodada:', error)
      notifications.show({
        title: 'Erro',
        message: 'Falha ao buscar cotações e alocações da rodada.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDadosIniciais()
  }, [])

  useEffect(() => {
    if (selectedRodadaId) {
      carregarDadosRodada(selectedRodadaId)
    }
  }, [selectedRodadaId])

  // Informações da rodada selecionada
  const rodadaAtual = useMemo(
    () => rodadas.find((r) => r.id === selectedRodadaId),
    [rodadas, selectedRodadaId],
  )

  // Processamento e Agrupamento dos Pedidos por Fornecedor
  const pedidosAgrupados = useMemo<PedidoPorFornecedor[]>(() => {
    if (!selectedRodadaId) return []

    // Agrupa alocações por id_fornecedor
    const mapFornecedores: Record<number, Alocacao[]> = {}
    alocacoes.forEach((aloc) => {
      if (aloc.quantidade > 0 && aloc.id_fornecedor > 0) {
        if (!mapFornecedores[aloc.id_fornecedor]) {
          mapFornecedores[aloc.id_fornecedor] = []
        }
        mapFornecedores[aloc.id_fornecedor].push(aloc)
      }
    })

    const listaPedidos: PedidoPorFornecedor[] = []

    for (const [idFornStr, alocsForn] of Object.entries(mapFornecedores)) {
      const idForn = parseInt(idFornStr, 10)
      const fornecedor = fornecedores.find((f) => f.id === idForn) || {
        id: idForn,
        nome: alocsForn[0]?.fornecedor_nome || `Fornecedor #${idForn}`,
        pedido_minimo: 0,
        contato: null,
        telefone: null,
        email: null,
      }

      let totalPedido = 0
      const itensLinha: ItemPedidoLinha[] = []

      alocsForn.forEach((aloc) => {
        // Encontra cotação
        const cot = cotacoes.find(
          (c) =>
            c.id_fornecedor === idForn && c.id_produto === aloc.id_produto,
        )

        const embalagem = cot ? cot.embalagem : 'Unidade'
        const fator = cot && cot.qtd_por_embalagem > 0 ? cot.qtd_por_embalagem : 1.0
        const precoEmb = cot ? cot.preco_embalagem : 0.0
        const precoUnit = cot ? cot.preco_unitario : 0.0

        const embComprar = Math.ceil(aloc.quantidade / fator)
        const qtdEfetiva = embComprar * fator
        const sobra = Math.max(0, qtdEfetiva - aloc.quantidade)
        const subtotal = embComprar * precoEmb

        totalPedido += subtotal

        itensLinha.push({
          id_produto: aloc.id_produto,
          produto_nome: aloc.produto_nome,
          marca: cot ? cot.marca : (aloc.marca || null),
          unidade: cot ? cot.unidade : (aloc.unidade || 'UN'),
          quantidade_solicitada: aloc.quantidade,
          embalagem,
          qtd_por_embalagem: fator,
          preco_embalagem: precoEmb,
          preco_unitario: precoUnit,
          embalagens_comprar: embComprar,
          quantidade_efetiva: qtdEfetiva,
          sobra,
          subtotal,
        })
      })

      // Status do Pedido Mínimo
      const pedidoMin = fornecedor.pedido_minimo || 0
      let statusMin: 'ok' | 'abaixo' | 'sem_minimo' = 'sem_minimo'
      let difMin = 0

      if (pedidoMin > 0) {
        if (totalPedido >= pedidoMin) {
          statusMin = 'ok'
          difMin = totalPedido - pedidoMin
        } else {
          statusMin = 'abaixo'
          difMin = pedidoMin - totalPedido
        }
      }

      // Gera texto comercial para WhatsApp / E-mail
      const dataFormatada = new Date().toLocaleDateString('pt-BR')
      let statusMinTexto = 'Sem exigência de mínimo'
      if (pedidoMin > 0) {
        statusMinTexto =
          statusMin === 'ok'
            ? `✓ Atingiu o pedido mínimo (+${formatMoney(difMin)})`
            : `⚠️ Abaixo do pedido mínimo em ${formatMoney(difMin)}`
      }

      let texto = `==================================================\n`
      texto += `PEDIDO DE COMPRA - ${fornecedor.nome}\n`
      texto += `Rodada: #${rodadaAtual?.id || selectedRodadaId} - ${rodadaAtual?.descricao || 'Cotação'}\n`
      texto += `Data: ${dataFormatada}\n`
      if (fornecedor.contato || fornecedor.telefone || fornecedor.email) {
        texto += `Contato: ${fornecedor.contato || 'N/A'}`
        if (fornecedor.telefone) texto += ` | Tel: ${fornecedor.telefone}`
        if (fornecedor.email) texto += ` | Email: ${fornecedor.email}`
        texto += `\n`
      }
      texto += `==================================================\n\n`
      texto += `ITENS DO PEDIDO:\n`

      itensLinha.forEach((item, idx) => {
        texto += `${idx + 1}. ${item.produto_nome}${item.marca ? ` [Marca: ${item.marca}]` : ''}\n`
        texto += `   - Quantidade: ${item.embalagens_comprar} ${item.embalagem} (${item.quantidade_efetiva} ${item.unidade})\n`
        texto += `   - Preço por Embalagem: ${formatMoney(item.preco_embalagem, 2)} | Preço Unitário: ${formatMoney(item.preco_unitario)}\n`
        texto += `   - Subtotal: ${formatMoney(item.subtotal)}\n\n`
      })

      texto += `--------------------------------------------------\n`
      texto += `VALOR TOTAL DO PEDIDO: ${formatMoney(totalPedido)}\n`
      if (pedidoMin > 0) {
        texto += `PEDIDO MÍNIMO: ${formatMoney(pedidoMin)} (${statusMinTexto})\n`
      }
      texto += `==================================================\n`

      listaPedidos.push({
        fornecedor,
        itens: itensLinha,
        total_pedido: totalPedido,
        status_minimo: statusMin,
        diferenca_minimo: difMin,
        texto_formatado: texto,
      })
    }

    return listaPedidos
  }, [selectedRodadaId, alocacoes, cotacoes, fornecedores, rodadaAtual])

  // Total Geral de todos os pedidos da rodada
  const valorTotalGeral = useMemo(() => {
    return pedidosAgrupados.reduce((acc, p) => acc + p.total_pedido, 0)
  }, [pedidosAgrupados])

  // Copiar Texto Individual
  const handleCopiarPedido = (texto: string, nomeForn: string) => {
    navigator.clipboard.writeText(texto)
    notifications.show({
      title: 'Pedido Copiado!',
      message: `O texto do pedido de ${nomeForn} foi copiado para a área de transferência.`,
      color: 'teal',
      icon: <IconCheck size={16} />,
    })
  }

  // Copiar Todos os Pedidos da Rodada em Lote
  const handleCopiarTodos = () => {
    if (pedidosAgrupados.length === 0) return

    const textoCompleto = pedidosAgrupados
      .map((p) => p.texto_formatado)
      .join('\n\n\n')

    navigator.clipboard.writeText(textoCompleto)
    notifications.show({
      title: 'Todos os Pedidos Copiados!',
      message: `Foram copiados os pedidos de ${pedidosAgrupados.length} fornecedores.`,
      color: 'teal',
      icon: <IconClipboardCopy size={16} />,
    })
  }

  // Estado para impressão isolada de um fornecedor específico ou todos
  const [fornecedorIdImprimir, setFornecedorIdImprimir] = useState<number | null>(null)

  // Imprimir Todos os Pedidos
  const handleImprimirTodos = () => {
    setFornecedorIdImprimir(null)
    setTimeout(() => {
      window.print()
    }, 100)
  }

  // Imprimir Pedido de um Fornecedor Específico
  const handleImprimirIndividual = (idFornecedor: number) => {
    setFornecedorIdImprimir(idFornecedor)
    setTimeout(() => {
      window.print()
      // Restaura para que na tela continue tudo visível após o diálogo de impressão
      setFornecedorIdImprimir(null)
    }, 100)
  }

  // Estado para controle das abas colapsáveis dos pedidos
  const [accordionValue, setAccordionValue] = useState<string[]>([])

  // Inicializa com todos os fornecedores abertos quando os pedidos forem calculados
  useEffect(() => {
    if (pedidosAgrupados.length > 0) {
      setAccordionValue(pedidosAgrupados.map((p) => p.fornecedor.id.toString()))
    }
  }, [pedidosAgrupados])

  // Alterna entre expandir todos e recolher todos
  const toggleTodosAccordions = () => {
    if (accordionValue.length === pedidosAgrupados.length) {
      setAccordionValue([])
    } else {
      setAccordionValue(pedidosAgrupados.map((p) => p.fornecedor.id.toString()))
    }
  }

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      {/* Cabeçalho Superior (Oculto na Impressão) */}
      <div className="no-print">
        <PageHeader
          icon={IconFileText}
          iconColor={themeColor}
          title="Geração de Pedidos de Compra"
          subtitle="Ordens de compra formatadas por fornecedor"
          rightSection={
            <RoundHeaderSelector
              rodadas={rodadas}
              selectedRodadaId={selectedRodadaId}
              themeColor={themeColor}
              onSelectRodada={(id) => {
                setSelectedRodadaId(id)
                onRodadaChange?.(id)
                carregarDadosRodada(id)
              }}
            />
          }
        />
      </div>

      {/* Barra de Ações Globais (Oculta na Impressão) */}
      {pedidosAgrupados.length > 0 && (
        <Paper withBorder p="xs" radius="sm" className="no-print">
          <Group justify="space-between" align="center">
            <div>
              <Text size="11px" fw={700} c="dimmed" tt="uppercase">
                Resumo da Rodada
              </Text>
              <Group gap="xs" align="baseline">
                <Title order={4} c="teal" style={{ fontSize: '1.2rem' }}>
                  {formatMoney(valorTotalGeral)}
                </Title>
                <Text size="xs" c="dimmed">
                  em <b>{pedidosAgrupados.length}</b> fornecedor(es)
                </Text>
              </Group>
            </div>

            <Group gap="xs">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={
                  accordionValue.length === pedidosAgrupados.length ? (
                    <IconArrowsMinimize size={14} />
                  ) : (
                    <IconArrowsMaximize size={14} />
                  )
                }
                onClick={toggleTodosAccordions}
              >
                {accordionValue.length === pedidosAgrupados.length
                  ? 'Recolher Todos'
                  : 'Expandir Todos'}
              </Button>

              <Button
                variant="outline"
                color="gray"
                size="xs"
                leftSection={<IconPrinter size={14} />}
                onClick={handleImprimirTodos}
              >
                Imprimir Todos
              </Button>

              <Button
                variant="filled"
                color={themeColor}
                size="xs"
                leftSection={<IconClipboardCopy size={14} />}
                onClick={handleCopiarTodos}
              >
                Copiar Todos
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : pedidosAgrupados.length === 0 ? (
        <EmptyState
          title="Nenhuma compra alocada nesta rodada"
          description="Vá para a aba Alocação (Ctrl+6) para definir quais fornecedores receberão cada compra antes de gerar os pedidos."
        />
      ) : (
        <Accordion
          multiple
          value={accordionValue}
          onChange={setAccordionValue}
          variant="separated"
          radius="sm"
        >
          {pedidosAgrupados.map((pedido) => {
            const estaOculto =
              fornecedorIdImprimir !== null &&
              fornecedorIdImprimir !== pedido.fornecedor.id

            return (
              <PedidoAccordionItem
                key={pedido.fornecedor.id}
                pedido={pedido}
                themeColor={themeColor}
                estaOculto={estaOculto}
                rodadaId={rodadaAtual?.id || selectedRodadaId}
                rodadaDescricao={rodadaAtual?.descricao}
                onImprimirIndividual={handleImprimirIndividual}
                onCopiarPedido={handleCopiarPedido}
              />
            )
          })}
        </Accordion>
      )}
    </Stack>
  )
}

export default PedidoView
