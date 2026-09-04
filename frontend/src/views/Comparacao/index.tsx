import { useEffect, useState } from 'react'
import { Center, Loader, SimpleGrid, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconScale, IconTruck, IconX } from '@tabler/icons-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoundHeaderSelector } from '../../components/form/RoundHeaderSelector'
import { StatCard } from '../../components/ui/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { getApi } from '../../services/api'
import type { Cotacao, Fornecedor, Necessidade, Rodada } from '../../types'
import { ComparacaoTable } from './ComparacaoTable'

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
  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState<
    Record<number, number | null>
  >({})
  const [loading, setLoading] = useState(true)

  const rodadaAtual = rodadas.find((r) => r.id === selectedRodadaId)
  const isFechada =
    rodadaAtual?.status === 'fechada' || rodadaAtual?.status === 'cancelada'

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

  // Fornecedores participantes com cotação na rodada (ou todos cadastrados se nenhum cotou)
  const fornecedoresNaTabela = cotacoes.length > 0 ? fornecedores.filter((f) => new Set(cotacoes.map((c) => c.id_fornecedor)).has(f.id)) : fornecedores

  // Stats calculation
  const totalItens = necessidades.length
  let totalComCotacao = 0
  necessidades.forEach((nec) => {
    if (cotacoes.some((c) => c.id_produto === nec.id_produto)) totalComCotacao++
  })
  const percentual =
    totalItens > 0 ? Math.round((totalComCotacao / totalItens) * 100) : 0

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
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

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <StatCard
          label="Cobertura de Cotações"
          value={`${totalComCotacao} de ${totalItens}`}
          subtitle="Itens com preço cotado na rodada"
          icon={IconScale}
          color={themeColor}
          badge={{
            label: `${percentual}% Coberto`,
            color: percentual === 100 ? 'teal' : themeColor,
          }}
        />

        <StatCard
          label="Fornecedores na Matriz"
          value={fornecedoresNaTabela.length.toString()}
          subtitle="Concorrentes cotados nesta rodada"
          icon={IconTruck}
          color="teal"
        />
      </SimpleGrid>

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
        <ComparacaoTable
          necessidades={necessidades}
          cotacoes={cotacoes}
          fornecedoresNaTabela={fornecedoresNaTabela}
          fornecedoresSelecionados={fornecedoresSelecionados}
          isFechada={isFechada}
          themeColor={themeColor}
          onSelecionarFornecedor={handleSelecionarFornecedor}
          onRestaurarMenoresPrecos={handleRestaurarMenoresPrecos}
        />
      )}
    </Stack>
  )
}

export default ComparacaoView
