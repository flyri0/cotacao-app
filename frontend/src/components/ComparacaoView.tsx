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
  useComputedColorScheme,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconScale,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import { PageHeader } from './common/PageHeader'
import { RoundHeaderSelector } from './common/RoundHeaderSelector'
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
}

export function ComparacaoView({
  rodadaAtivaId,
  onRodadaChange,
}: ComparacaoViewProps) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'

  const carregarDados = async (rodadaId?: number) => {
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
        const [listaNec, listaCot] = await Promise.all([
          api.listar_necessidades(idAlvo),
          api.listar_cotacoes(idAlvo),
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
    return { totalItens, totalComCotacao }
  }, [necessidades, rankingsPorProduto])

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      <PageHeader
        icon={IconScale}
        iconColor="orange"
        title="Mapa Comparativo de Cotações"
        subtitle="Normalização por unidade de medida"
        rightSection={
          <RoundHeaderSelector
            rodadas={rodadas}
            selectedRodadaId={selectedRodadaId}
            onSelectRodada={(id) => {
              setSelectedRodadaId(id)
              onRodadaChange?.(id)
              carregarDados(id)
            }}
          />
        }
      />

      {/* Barra de Resumo e Legenda de Cores */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
        <Paper withBorder p="xs" radius="sm">
          <Group justify="space-between">
            <Text size="11px" c="dimmed" fw={700} tt="uppercase">
              Itens na Rodada
            </Text>
            <Badge color="blue" size="xs" variant="light">
              {stats.totalComCotacao}/{stats.totalItens} Cotados
            </Badge>
          </Group>
        </Paper>

        <Paper withBorder p="xs" radius="sm">
          <Group justify="space-between">
            <Text size="11px" c="dimmed" fw={700} tt="uppercase">
              Fornecedores na Matriz
            </Text>
            <Badge color="cyan" size="xs" variant="light" leftSection={<IconTruck size={12} />}>
              {fornecedoresNaTabela.length} Participantes
            </Badge>
          </Group>
        </Paper>

        <Paper withBorder p="xs" radius="sm">
          <Group justify="space-between" align="center">
            <Text size="11px" c="dimmed" fw={700} tt="uppercase">
              Ranking:
            </Text>
            <Group gap={4}>
              <Badge
                size="xs"
                variant="filled"
                styles={{
                  root: {
                    backgroundColor: isDark ? 'rgba(43, 138, 62, 0.4)' : '#bbf7d0',
                    color: isDark ? '#8ce99a' : '#166534',
                  },
                }}
              >
                1º Menor
              </Badge>
              <Badge
                size="xs"
                variant="filled"
                styles={{
                  root: {
                    backgroundColor: isDark ? 'rgba(245, 159, 0, 0.35)' : '#fef08a',
                    color: isDark ? '#ffd43b' : '#854d0e',
                  },
                }}
              >
                2º Lugar
              </Badge>
              <Badge
                size="xs"
                variant="filled"
                styles={{
                  root: {
                    backgroundColor: isDark ? 'rgba(224, 49, 49, 0.35)' : '#fecaca',
                    color: isDark ? '#ffa8a8' : '#991b1b',
                  },
                }}
              >
                3º Lugar
              </Badge>
            </Group>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* TABELA DE EXCEL COMPACTA */}
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
          <Table.ScrollContainer minWidth={850}>
            <Table
              withTableBorder
              withColumnBorders
              striped
              highlightOnHover
              verticalSpacing={3}
              horizontalSpacing={6}
              style={{ fontSize: 'var(--app-font-base, 13px)', borderCollapse: 'collapse' }}
            >
              <Table.Thead style={{ backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : '#f1f3f5' }}>
                <Table.Tr>
                  <Table.Th style={{ width: 280, padding: '5px 8px' }}>
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
                        padding: '8px 6px',
                        borderLeft: isDark ? '1px solid var(--mantine-color-dark-4)' : '1px solid #dee2e6',
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
                      width: 170,
                      textAlign: 'center',
                      padding: '8px 6px',
                      backgroundColor: isDark ? 'rgba(18, 184, 134, 0.20)' : '#e6fcf5',
                      borderLeft: isDark ? '1px solid var(--mantine-color-dark-4)' : '1px solid #dee2e6',
                    }}
                  >
                    <Text fw={700} size="xs" c={isDark ? 'teal.3' : 'teal.9'} tt="uppercase">
                      🏆 Menor Preço
                    </Text>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {necessidades.map((nec) => {
                  const rankingDoProd = rankingsPorProduto.get(nec.id_produto) || []
                  const melhorCotacao = rankingDoProd.length > 0 ? rankingDoProd[0] : null

                  return (
                    <Table.Tr key={nec.id}>
                      {/* Coluna 1: Nome do Produto */}
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

                      {/* Colunas dos Fornecedores (Células Compactas com Background de Ranking) */}
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
                                backgroundColor: isDark ? 'transparent' : '#fcfcfc',
                                color: isDark ? 'var(--mantine-color-dark-2)' : '#adb5bd',
                                padding: '6px',
                                borderLeft: isDark ? '1px solid var(--mantine-color-dark-4)' : '1px solid #dee2e6',
                              }}
                            >
                              -
                            </Table.Td>
                          )
                        }

                        // Posição no ranking do produto
                        const posicao = rankingDoProd.findIndex((c) => c.id === cot.id) + 1

                        // Cor de fundo e texto conforme ranking e tema
                        let bgCell = 'transparent'
                        let textPrecoColor = 'inherit'

                        if (posicao === 1) {
                          bgCell = isDark ? 'rgba(43, 138, 62, 0.35)' : '#d3f9d8'
                          textPrecoColor = isDark ? '#8ce99a' : '#14532d'
                        } else if (posicao === 2) {
                          bgCell = isDark ? 'rgba(245, 159, 0, 0.28)' : '#fff3bf'
                          textPrecoColor = isDark ? '#ffd43b' : '#713f12'
                        } else if (posicao === 3) {
                          bgCell = isDark ? 'rgba(224, 49, 49, 0.28)' : '#ffe3e3'
                          textPrecoColor = isDark ? '#ffa8a8' : '#7f1d1d'
                        }

                        return (
                          <Table.Td
                            key={forn.id}
                            style={{
                              backgroundColor: bgCell,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              padding: '5px 8px',
                              borderLeft: isDark ? '1px solid var(--mantine-color-dark-4)' : '1px solid #dee2e6',
                            }}
                          >
                            <Text fw={700} size="xs" c={textPrecoColor} style={{ lineHeight: 1.2 }}>
                              {formatMoney(cot.preco_unitario)} / {cot.unidade || 'UN'}
                            </Text>
                            <Text size="10px" c="dimmed" style={{ lineHeight: 1.1, marginTop: 2 }}>
                              {cot.marca ? `[${cot.marca}] ` : ''}{cot.embalagem} ({formatMoney(cot.preco_embalagem, 2)})
                            </Text>
                          </Table.Td>
                        )
                      })}

                      {/* Coluna Resumo Menor Preço */}
                      <Table.Td
                        style={{
                          backgroundColor: '#f4fbf7',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          padding: '5px 8px',
                          borderLeft: '1px solid #dee2e6',
                        }}
                      >
                        {melhorCotacao ? (
                          <div>
                            <Text fw={700} size="xs" c="teal.9" style={{ lineHeight: 1.2 }}>
                              {formatMoney(melhorCotacao.preco_unitario)}
                            </Text>
                            <Text size="10px" fw={600} c="teal.8" lineClamp={1}>
                              {melhorCotacao.fornecedor_nome}
                            </Text>
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

