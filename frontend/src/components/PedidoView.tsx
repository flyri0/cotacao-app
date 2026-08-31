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

            const observacoesItens = pedido.itens.filter(
              (item) =>
                item.observacao &&
                !item.observacao.toLowerCase().includes('sugerido menor') &&
                !item.observacao.toLowerCase().includes('menor preco') &&
                !item.observacao.toLowerCase().includes('menor preço'),
            )

            const totalEmbalagensFechadas = pedido.itens.reduce(
              (acc, it) => acc + (it.embalagens_comprar || 0),
              0,
            )

            return (
              <Card
                key={pedido.fornecedor.id}
                withBorder
                shadow="none"
                radius="sm"
                p="xs"
                className={`pedido-ordem-compra ${estaOculto ? 'oculto-na-impressao' : ''}`}
              >
                {/* ========================================================= */}
                {/* DOCUMENTO FORMAL DE IMPRESSÃO (ESTILO DANFE - PRINT ONLY) */}
                {/* ========================================================= */}
                <div className="print-only danfe-documento">
                  {/* QUADRO 1: CABEÇALHO DA ORDEM DE COMPRA */}
                  <div className="danfe-quadro">
                    <table className="danfe-header-table">
                      <tbody>
                        <tr>
                          <td style={{ width: '65%' }}>
                            <div
                              style={{
                                fontSize: '13pt',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: '#0f172a',
                              }}
                            >
                              ORDEM DE COMPRA / PEDIDO DE FORNECIMENTO
                            </div>
                            <div style={{ fontSize: '8pt', color: '#334155', marginTop: '2pt' }}>
                              Ciclo de Cotação: <b>#{rodadaAtual?.id || selectedRodadaId} — {rodadaAtual?.descricao}</b>
                            </div>
                          </td>
                          <td style={{ width: '35%', textAlign: 'right', borderLeft: '1px solid #0f172a' }}>
                            <span className="danfe-label">DATA DE EMISSÃO</span>
                            <div className="danfe-valor" style={{ fontSize: '8.5pt' }}>
                              {new Date().toLocaleDateString('pt-BR')} às{' '}
                              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{ fontSize: '7pt', color: '#0f172a', fontWeight: 800, marginTop: '2pt' }}>
                              SITUAÇÃO: APROVADO PARA COMPRA
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* QUADRO 2: IDENTIFICAÇÃO DO FORNECEDOR / DESTINATÁRIO */}
                  <div className="danfe-quadro">
                    <div className="danfe-titulo-quadro">IDENTIFICAÇÃO DO FORNECEDOR (DESTINATÁRIO)</div>
                    <table className="danfe-grid-table">
                      <tbody>
                        <tr>
                          <td style={{ width: '45%' }}>
                            <span className="danfe-label">Razão Social / Nome do Fornecedor</span>
                            <span className="danfe-valor-destaque">{pedido.fornecedor.nome}</span>
                          </td>
                          <td style={{ width: '30%' }}>
                            <span className="danfe-label">Contato / Vendedor</span>
                            <span className="danfe-valor">{pedido.fornecedor.contato || 'Não informado'}</span>
                          </td>
                          <td style={{ width: '25%' }}>
                            <span className="danfe-label">Telefone / WhatsApp</span>
                            <span className="danfe-valor">{pedido.fornecedor.telefone || 'Não informado'}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <span className="danfe-label">E-mail</span>
                            <span className="danfe-valor">{pedido.fornecedor.email || 'Não informado'}</span>
                          </td>
                          <td>
                            <span className="danfe-label">Pedido Mínimo Exigido</span>
                            <span className="danfe-valor">
                              {pedido.fornecedor.pedido_minimo > 0
                                ? formatMoney(pedido.fornecedor.pedido_minimo)
                                : 'Não possui'}
                            </span>
                          </td>
                          <td>
                            <span className="danfe-label">Situação do Pedido Mínimo</span>
                            <span className="danfe-valor">
                              {pedido.status_minimo === 'ok' && `✓ Atingido (+${formatMoney(pedido.diferenca_minimo)})`}
                              {pedido.status_minimo === 'abaixo' && `⚠️ Abaixo (Falta ${formatMoney(pedido.diferenca_minimo)})`}
                              {pedido.status_minimo === 'sem_minimo' && 'Sem exigência'}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* QUADRO 3: TABELA DE ITENS DA ORDEM DE COMPRA */}
                  <table className="danfe-itens-table">
                    <thead>
                      <tr>
                        <th style={{ width: '24pt', textAlign: 'center' }}>Item</th>
                        <th>Descrição do Produto / Marca Ofertada</th>
                        <th style={{ width: '70pt' }}>Embalagem</th>
                        <th style={{ width: '42pt', textAlign: 'right' }}>Qtd Ped.</th>
                        <th style={{ width: '45pt', textAlign: 'center' }}>Comprar</th>
                        <th style={{ width: '48pt', textAlign: 'right' }}>Qtd Total</th>
                        <th style={{ width: '50pt', textAlign: 'right' }}>Preço Emb.</th>
                        <th style={{ width: '50pt', textAlign: 'right' }}>Preço Un.</th>
                        <th style={{ width: '58pt', textAlign: 'right' }}>Subtotal (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedido.itens.map((item, idx) => (
                        <tr key={item.id_produto}>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td>
                            <b>{item.produto_nome}</b>
                            {item.marca ? ` [${item.marca}]` : ''}
                          </td>
                          <td>{item.embalagem}</td>
                          <td style={{ textAlign: 'right' }}>
                            {item.quantidade_solicitada} {item.unidade}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {item.embalagens_comprar} cx/emb
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.quantidade_efetiva} {item.unidade}
                            {item.sobra > 0 ? ` (+${item.sobra})` : ''}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {formatMoney(item.preco_embalagem)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {formatMoney(item.preco_unitario)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatMoney(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* QUADRO 4: TOTAIS DA ORDEM DE COMPRA */}
                  <div className="danfe-quadro">
                    <div className="danfe-titulo-quadro">TOTAIS DA ORDEM DE COMPRA</div>
                    <table className="danfe-totais-table">
                      <tbody>
                        <tr>
                          <td style={{ width: '25%' }}>
                            <span className="danfe-label">Total de Itens</span>
                            <span className="danfe-valor">{pedido.itens.length} produto(s)</span>
                          </td>
                          <td style={{ width: '25%' }}>
                            <span className="danfe-label">Volume de Embalagens</span>
                            <span className="danfe-valor">{totalEmbalagensFechadas} cx/emb</span>
                          </td>
                          <td style={{ width: '25%' }}>
                            <span className="danfe-label">Status Pedido Mínimo</span>
                            <span className="danfe-valor">
                              {pedido.status_minimo === 'ok' && '✓ Mínimo Atingido'}
                              {pedido.status_minimo === 'abaixo' && '⚠️ Abaixo do Mínimo'}
                              {pedido.status_minimo === 'sem_minimo' && 'Sem Pedido Mínimo'}
                            </span>
                          </td>
                          <td style={{ width: '25%', backgroundColor: '#f8fafc', textAlign: 'right' }}>
                            <span className="danfe-label">VALOR TOTAL DO PEDIDO</span>
                            <span className="danfe-valor-destaque" style={{ fontSize: '10.5pt' }}>
                              {formatMoney(pedido.total_pedido)}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* QUADRO 5: OBSERVAÇÕES E DADOS COMPLEMENTARES */}
                  <div className="danfe-quadro">
                    <div className="danfe-titulo-quadro">DADOS COMPLEMENTARES / OBSERVAÇÕES</div>
                    <div style={{ padding: '3pt 5pt', fontSize: '7pt', lineHeight: 1.3, color: '#334155' }}>
                      {observacoesItens.length > 0 && (
                        <div style={{ marginBottom: '2pt' }}>
                          {observacoesItens.map((obs, oIdx) => (
                            <div key={oIdx}>
                              • <b>{obs.produto_nome}:</b> {obs.observacao}
                            </div>
                          ))}
                        </div>
                      )}
                      <div>• Condições comerciais, faturamento e prazos de entrega acordados conforme cotação aprovada.</div>
                      <div>• Favor confirmar o recebimento deste pedido e informar data prevista de faturamento.</div>
                    </div>
                  </div>

                  {/* QUADRO 6: CANHOTO DE RECEBIMENTO E ASSINATURA */}
                  <div className="danfe-quadro">
                    <table className="danfe-assinatura-table">
                      <tbody>
                        <tr>
                          <td style={{ width: '50%' }}>
                            <span className="danfe-label">Confirmação de Recebimento / Fornecedor</span>
                            <div style={{ marginTop: '10pt', fontSize: '7.5pt' }}>
                              Data de Aceite: _____ / _____ / __________
                            </div>
                          </td>
                          <td style={{ width: '50%', textAlign: 'center' }}>
                            <div
                              style={{
                                borderBottom: '1px solid #0f172a',
                                width: '80%',
                                margin: '0 auto',
                                height: '12pt',
                              }}
                            ></div>
                            <span className="danfe-label" style={{ marginTop: '2pt', textAlign: 'center' }}>
                              Responsável / Setor de Compras
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* CABEÇALHO DO CARD NA TELA (NO-PRINT)                       */}
                {/* ========================================================= */}
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

                {/* Tabela dos Itens na Tela (NO-PRINT) */}
                <Table withTableBorder striped highlightOnHover mb="xs" verticalSpacing={2} horizontalSpacing={6} className="no-print">
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
