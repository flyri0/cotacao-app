import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  Center,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconScale,
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
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)

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

  // Mapa de ranking por produto: id_produto -> Array de cotações ordenadas por menor preco_unitario
  const rankingsPorProduto = useMemo(() => {
    const mapa = new Map<number, Cotacao[]>()
    necessidades.forEach((nec) => {
      const cotsDoProd = cotacoes
        .filter((c) => c.id_produto === nec.id_produto)
        .sort((a, b) => a.preco_unitario - b.preco_unitario)
      mapa.set(nec.id_produto, cotsDoProd)
    })
    return mapa
  }, [necessidades, cotacoes])

  // Indicadores rápidos
  const stats = useMemo(() => {
    const totalItens = necessidades.length
    let totalComCotacao = 0
    rankingsPorProduto.forEach((cots) => {
      if (cots.length > 0) totalComCotacao++
    })
    const percentual = totalItens > 0 ? Math.round((totalComCotacao / totalItens) * 100) : 0
    return { totalItens, totalComCotacao, percentual }
  }, [necessidades, rankingsPorProduto])

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      <PageHeader
        icon={IconScale}
        iconColor={themeColor}
        title="Mapa Comparativo de Cotações"
        subtitle="Normalização por unidade de medida"
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

      {/* Cartões KPIs Padronizados (StatCard) */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
        <StatCard
          label="Cobertura de Cotações"
          value={`${stats.totalComCotacao} de ${stats.totalItens}`}
          subtitle="Itens com preço cotado"
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

        <StatCard
          label="Critério de Destaque"
          value="Menor Preço"
          subtitle="Normalizado por unidade (🏆 1º Lugar)"
          color="teal"
          valueColor="teal"
          badge={{ label: 'Melhor Oferta', color: 'teal' }}
        />
      </SimpleGrid>

      {/* SUPER-PLANILHA DE EXCEL COM PAINÉIS CONGELADOS */}
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
        <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={850} style={{ maxHeight: 'calc(100vh - 240px)' }}>
            <Table
              className="table-sticky-column-first table-sticky-header"
              withTableBorder
              withColumnBorders
              striped
              highlightOnHover
              verticalSpacing={4}
              horizontalSpacing={8}
              style={{ fontSize: 'var(--app-font-base, 13px)', borderCollapse: 'collapse' }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 280, padding: '6px 10px' }}>
                    <Text fw={700} size="xs" tt="uppercase" c="dimmed">
                      Produto
                    </Text>
                  </Table.Th>

                  {fornecedoresNaTabela.map((forn) => (
                    <Table.Th
                      key={forn.id}
                      style={{
                        textAlign: 'center',
                        minWidth: 180,
                        padding: '6px 8px',
                      }}
                    >
                      <Text fw={700} size="xs" lineClamp={1}>
                        {forn.nome}
                      </Text>
                      {forn.pedido_minimo > 0 && (
                        <Text size="10px" c="dimmed">
                          Mín: {formatMoney(forn.pedido_minimo)}
                        </Text>
                      )}
                    </Table.Th>
                  ))}

                  <Table.Th
                    style={{
                      width: 190,
                      textAlign: 'center',
                      padding: '6px 8px',
                      backgroundColor: 'var(--mantine-color-teal-light)',
                    }}
                  >
                    <Text fw={700} size="xs" c="teal" tt="uppercase">
                      🏆 Menor Preço
                    </Text>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {necessidades.map((nec) => {
                  const rankingDoProd = rankingsPorProduto.get(nec.id_produto) || []
                  const melhorCotacao = rankingDoProd.length > 0 ? rankingDoProd[0] : null
                  const segundaMelhor = rankingDoProd.length > 1 ? rankingDoProd[1] : null

                  return (
                    <Table.Tr key={nec.id}>
                      {/* Coluna 1: Nome do Produto (Congelada à esquerda via sticky) */}
                      <Table.Td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                        <Text fw={600} size="xs" lineClamp={1}>
                          {nec.produto_nome}
                        </Text>
                        {nec.produto_categoria && (
                          <Text size="10px" c="dimmed">
                            {nec.produto_categoria}
                          </Text>
                        )}
                      </Table.Td>

                      {/* Colunas dos Fornecedores (Células Limpas, Destaque apenas no Vencedor) */}
                      {fornecedoresNaTabela.map((forn) => {
                        const cot = cotacoes.find(
                          (c) => c.id_produto === nec.id_produto && c.id_fornecedor === forn.id,
                        )

                        if (!cot) {
                          return (
                            <Table.Td
                              key={forn.id}
                              style={{
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                color: 'var(--mantine-color-dimmed)',
                                padding: '6px',
                              }}
                            >
                              -
                            </Table.Td>
                          )
                        }

                        // Posição no ranking do produto
                        const posicao = rankingDoProd.findIndex((c) => c.id === cot.id) + 1
                        const isVencedor = posicao === 1

                        return (
                          <Table.Td
                            key={forn.id}
                            style={{
                              backgroundColor: isVencedor ? 'var(--mantine-color-teal-light)' : undefined,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              padding: '5px 8px',
                            }}
                          >
                            <Group gap={4} justify="center" align="center">
                              {isVencedor && (
                                <Text span size="xs">
                                  🏆
                                </Text>
                              )}
                              <Text
                                fw={isVencedor ? 700 : 500}
                                size="xs"
                                c={isVencedor ? 'teal' : undefined}
                                style={{ lineHeight: 1.2 }}
                              >
                                {formatMoney(cot.preco_unitario)} / {cot.unidade || 'UN'}
                              </Text>
                            </Group>
                            <Text size="10px" c="dimmed" style={{ lineHeight: 1.1, marginTop: 2 }}>
                              {cot.marca ? `[${cot.marca}] ` : ''}{cot.embalagem} ({formatMoney(cot.preco_embalagem, 2)})
                            </Text>
                          </Table.Td>
                        )
                      })}

                      {/* Coluna Menor Preço com Cálculo de Economia vs 2º Lugar */}
                      <Table.Td
                        style={{
                          backgroundColor: 'var(--mantine-color-teal-light)',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          padding: '5px 8px',
                        }}
                      >
                        {melhorCotacao ? (
                          <div>
                            <Text fw={700} size="xs" c="teal" style={{ lineHeight: 1.2 }}>
                              {formatMoney(melhorCotacao.preco_unitario)}
                            </Text>
                            <Text size="10px" fw={600} lineClamp={1}>
                              {melhorCotacao.fornecedor_nome}
                            </Text>
                            {segundaMelhor && segundaMelhor.preco_unitario > melhorCotacao.preco_unitario ? (
                              <Badge size="xs" variant="light" color="teal" mt={2}>
                                -{(((segundaMelhor.preco_unitario - melhorCotacao.preco_unitario) / segundaMelhor.preco_unitario) * 100).toFixed(0)}% vs 2º
                              </Badge>
                            ) : rankingDoProd.length === 1 ? (
                              <Badge size="xs" variant="light" color="gray" mt={2}>
                                Única oferta
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <Text size="xs" c="dimmed">
                            -
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
    </Stack>
  )
}

export default ComparacaoView

