import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconCheck,
  IconClipboardCopy,
  IconCopy,
  IconFileText,
  IconMail,
  IconPhone,
  IconPrinter,
  IconTruck,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import { PageHeader } from './common/PageHeader'
import { RoundHeaderSelector } from './common/RoundHeaderSelector'
import { EmptyState } from './common/EmptyState'
import { getApi } from '../services/api'
import type { Alocacao, Cotacao, Fornecedor, Rodada } from '../types'

function formatMoney(valor: number, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

interface ItemPedidoLinha {
  id_produto: number
  produto_nome: string
  marca?: string | null
  unidade: string
  quantidade_solicitada: number
  embalagem: string
  qtd_por_embalagem: number
  preco_embalagem: number
  preco_unitario: number
  embalagens_comprar: number
  quantidade_efetiva: number
  sobra: number
  subtotal: number
  observacao?: string | null
}

interface PedidoPorFornecedor {
  fornecedor: Fornecedor
  itens: ItemPedidoLinha[]
  total_pedido: number
  status_minimo: 'ok' | 'abaixo' | 'sem_minimo'
  diferenca_minimo: number
  texto_formatado: string
}

interface PedidoViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
}

export function PedidoView({ rodadaAtivaId, onRodadaChange }: PedidoViewProps) {
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
        api.listar_rodadas(),
        api.listar_fornecedores(),
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
        api.listar_cotacoes(idRodada),
        api.listar_alocacoes(idRodada),
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
          observacao: aloc.observacao,
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
        texto += `   - Subtotal: ${formatMoney(item.subtotal)}\n`
        const obsVal = (item.observacao || '').trim()
        const isObsSistema =
          obsVal.toLowerCase().includes('sugerido menor') ||
          obsVal.toLowerCase().includes('menor preco') ||
          obsVal.toLowerCase().includes('menor preço')
        if (obsVal && !isObsSistema) {
          texto += `   - Obs: ${obsVal}\n`
        }
        texto += `\n`
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

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      {/* Cabeçalho Superior (Oculto na Impressão) */}
      <div className="no-print">
        <PageHeader
          icon={IconFileText}
          iconColor="blue"
          title="Geração de Pedidos de Compra"
          subtitle="Ordens de compra formatadas por fornecedor"
          rightSection={
            <RoundHeaderSelector
              rodadas={rodadas}
              selectedRodadaId={selectedRodadaId}
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
                <Title order={4} c="teal.7" style={{ fontSize: '1.2rem' }}>
                  {formatMoney(valorTotalGeral)}
                </Title>
                <Text size="xs" c="dimmed">
                  em <b>{pedidosAgrupados.length}</b> fornecedor(es)
                </Text>
              </Group>
            </div>

            <Group gap="xs">
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
                color="teal"
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
        <Stack gap="sm">
          {pedidosAgrupados.map((pedido) => {
            const estaOculto =
              fornecedorIdImprimir !== null &&
              fornecedorIdImprimir !== pedido.fornecedor.id

            return (
              <Card
                key={pedido.fornecedor.id}
                withBorder
                shadow="none"
                radius="sm"
                p="xs"
                className={`pedido-ordem-compra ${estaOculto ? 'oculto-na-impressao' : ''}`}
              >
                {/* CABEÇALHO FORMAL DE ORDEM DE COMPRA (VISÍVEL SOMENTE NA IMPRESSÃO) */}
                <div className="print-only" style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      borderBottom: '2px solid #0f172a',
                      paddingBottom: '8px',
                      marginBottom: '12px',
                    }}
                  >
                    <table style={{ width: '100%', border: 'none', margin: 0 }}>
                      <tbody>
                        <tr style={{ border: 'none' }}>
                          <td style={{ border: 'none', padding: 0, verticalAlign: 'top' }}>
                            <h2 style={{ margin: 0, fontSize: '16pt', color: '#0f172a' }}>
                              ORDEM DE COMPRA / PEDIDO DE FORNECIMENTO
                            </h2>
                            <p style={{ margin: '4px 0 0 0', fontSize: '10pt', color: '#475569' }}>
                              Rodada: <b>#{rodadaAtual?.id || selectedRodadaId} — {rodadaAtual?.descricao}</b>
                            </p>
                          </td>
                          <td style={{ border: 'none', padding: 0, textAlign: 'right', verticalAlign: 'top' }}>
                            <p style={{ margin: 0, fontSize: '10pt', color: '#475569' }}>
                              Data de Emissão: <b>{new Date().toLocaleDateString('pt-BR')}</b>
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: '9pt', color: '#64748b' }}>
                              Status: <b>Aprovado para Compra</b>
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Dados do Fornecedor na Impressão */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '9.5pt',
                    }}
                  >
                    <table style={{ width: '100%', border: 'none', margin: 0 }}>
                      <tbody>
                        <tr style={{ border: 'none' }}>
                          <td style={{ border: 'none', padding: '2px 0', width: '50%' }}>
                            <b>Fornecedor:</b> {pedido.fornecedor.nome}
                          </td>
                          <td style={{ border: 'none', padding: '2px 0', width: '50%' }}>
                            <b>Contato / Vendedor:</b> {pedido.fornecedor.contato || 'Não informado'}
                          </td>
                        </tr>
                        <tr style={{ border: 'none' }}>
                          <td style={{ border: 'none', padding: '2px 0' }}>
                            <b>Telefone / WhatsApp:</b> {pedido.fornecedor.telefone || 'Não informado'}
                          </td>
                          <td style={{ border: 'none', padding: '2px 0' }}>
                            <b>E-mail:</b> {pedido.fornecedor.email || 'Não informado'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cabeçalho do Card de Fornecedor na Tela (Oculto na Impressão) */}
                <Group justify="space-between" align="center" mb={6} className="no-print">
                  <Group gap="xs" align="center">
                    <ThemeIcon color="teal" variant="light" size={26} radius="sm">
                      <IconTruck size={16} />
                    </ThemeIcon>
                    <div>
                      <Title order={4} style={{ fontSize: '0.95rem' }}>{pedido.fornecedor.nome}</Title>
                      <Group gap="xs">
                        {pedido.fornecedor.contato && (
                          <Text size="11px" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconUser size={12} /> {pedido.fornecedor.contato}
                          </Text>
                        )}
                        {pedido.fornecedor.telefone && (
                          <Text size="11px" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconPhone size={12} /> {pedido.fornecedor.telefone}
                          </Text>
                        )}
                        {pedido.fornecedor.email && (
                          <Text size="11px" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconMail size={12} /> {pedido.fornecedor.email}
                          </Text>
                        )}
                      </Group>
                    </div>
                  </Group>

                  <Group gap="xs" align="center">
                    {pedido.status_minimo === 'ok' && (
                      <Badge color="teal" variant="filled" size="xs">
                        ✓ Mínimo Ok (+{formatMoney(pedido.diferenca_minimo)})
                      </Badge>
                    )}
                    {pedido.status_minimo === 'abaixo' && (
                      <Badge color="red" variant="filled" size="xs">
                        ⚠️ Abaixo Mínimo (-{formatMoney(pedido.diferenca_minimo)})
                      </Badge>
                    )}
                    {pedido.status_minimo === 'sem_minimo' && (
                      <Badge color="gray" variant="light" size="xs">
                        Sem Mínimo
                      </Badge>
                    )}

                    <Button
                      variant="light"
                      color="gray"
                      size="xs"
                      leftSection={<IconPrinter size={14} />}
                      onClick={() => handleImprimirIndividual(pedido.fornecedor.id)}
                    >
                      Imprimir
                    </Button>

                    <Button
                      variant="light"
                      color="teal"
                      size="xs"
                      leftSection={<IconCopy size={14} />}
                      onClick={() =>
                        handleCopiarPedido(
                          pedido.texto_formatado,
                          pedido.fornecedor.nome,
                        )
                      }
                    >
                      Copiar
                    </Button>
                  </Group>
                </Group>

                {/* Tabela dos Itens do Pedido */}
                <Table withTableBorder striped highlightOnHover mb="xs" verticalSpacing={2} horizontalSpacing={6}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produto / Item</Table.Th>
                      <Table.Th>Embalagem</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Qtd Solicitada</Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>Comprar</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Qtd Total</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Preço Emb.</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Preço Unit.</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Subtotal</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pedido.itens.map((item) => (
                      <Table.Tr key={item.id_produto}>
                        <Table.Td>
                          <Text fw={600} size="xs">
                            {item.produto_nome}
                          </Text>
                          {item.observacao &&
                            !item.observacao.toLowerCase().includes('sugerido menor') &&
                            !item.observacao.toLowerCase().includes('menor preco') &&
                            !item.observacao.toLowerCase().includes('menor preço') && (
                              <Text size="10px" c="dimmed">
                                Obs: {item.observacao}
                              </Text>
                            )}
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="cyan" size="xs">
                            {item.marca ? `[${item.marca}] ` : ''}{item.embalagem}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="xs">
                            {item.quantidade_solicitada} {item.unidade}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Badge color="indigo" variant="filled" size="xs">
                            {item.embalagens_comprar} cx/emb
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="xs" fw={600}>
                            {item.quantidade_efetiva} {item.unidade}
                          </Text>
                          {item.sobra > 0 && (
                            <Text size="10px" c="blue">
                              (+{item.sobra} sobra)
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="xs">{formatMoney(item.preco_embalagem)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="xs" c="dimmed">
                            {formatMoney(item.preco_unitario)} / {item.unidade}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text fw={700} size="xs" c="teal.7">
                            {formatMoney(item.subtotal)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text fw={700} size="xs" ta="right">
                          VALOR TOTAL DO PEDIDO:
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={800} size="sm" c="teal.7">
                          {formatMoney(pedido.total_pedido)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>

                {/* BLOCO FORMAL DE APROVAÇÃO E ASSINATURA (VISÍVEL APENAS NA IMPRESSÃO) */}
                <div className="print-only" style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px dashed #94a3b8' }}>
                  <table style={{ width: '100%', border: 'none' }}>
                    <tbody>
                      <tr style={{ border: 'none' }}>
                        <td style={{ width: '60%', border: 'none', verticalAlign: 'bottom', padding: 0 }}>
                          <p style={{ margin: 0, fontSize: '9pt', color: '#475569' }}>
                            {pedido.fornecedor.pedido_minimo > 0 &&
                              `Pedido mínimo exigido: ${formatMoney(pedido.fornecedor.pedido_minimo)} | `}
                            Condições comerciais de fornecimento conforme cotação aprovada.
                          </p>
                        </td>
                        <td style={{ width: '40%', border: 'none', textAlign: 'center', padding: '0 0 0 20px' }}>
                          <div style={{ borderBottom: '1px solid #0f172a', width: '100%', height: '35px' }}></div>
                          <p style={{ margin: '4px 0 0 0', fontSize: '9pt', fontWeight: 'bold' }}>
                            Responsável / Compras
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Área de Texto Pré-formatado para Envio Rápido (Oculta na Impressão) */}
                <Paper withBorder p="sm" radius="md" className="no-print">
                  <Group justify="space-between" align="center" mb={4}>
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                      Texto Formatado para WhatsApp / E-mail:
                    </Text>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="teal"
                      leftSection={<IconCopy size={12} />}
                      onClick={() =>
                        handleCopiarPedido(
                          pedido.texto_formatado,
                          pedido.fornecedor.nome,
                        )
                      }
                    >
                      Copiar
                    </Button>
                  </Group>
                  <Textarea
                    value={pedido.texto_formatado}
                    readOnly
                    autosize
                    minRows={4}
                    maxRows={10}
                    styles={{
                      input: {
                        fontFamily: 'monospace',
                        fontSize: '12px',
                      },
                    }}
                  />
                </Paper>
              </Card>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}

export default PedidoView
