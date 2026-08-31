import { useEffect, useState, useMemo } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  Radio,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconCheck,
  IconChecklist,
  IconEdit,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconRotate,
  IconSearch,
  IconTrash,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react'
import { PageHeader } from './common/PageHeader'
import { StatCard } from './common/StatCard'
import { EmptyState } from './common/EmptyState'
import { AppSelect } from './common/AppSelect'
import { getApi } from '../services/api'
import type { RodadaComMetricas } from '../types'

interface RodadasViewProps {
  rodadaAtivaId?: number
  onSelecionarRodada?: (idRodada: number, redirecionarParaAba?: string) => void
}

export function RodadasView({
  rodadaAtivaId,
  onSelecionarRodada,
}: RodadasViewProps) {
  const [rodadas, setRodadas] = useState<RodadaComMetricas[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todas')

  // Modais
  const [modalCriarOpened, { open: openModalCriar, close: closeModalCriar }] =
    useDisclosure(false)
  const [modalEditarOpened, { open: openModalEditar, close: closeModalEditar }] =
    useDisclosure(false)
  const [modalExcluirOpened, { open: openModalExcluir, close: closeModalExcluir }] =
    useDisclosure(false)

  // Estados de seleção para ações
  const [rodadaEmEdicao, setRodadaEmEdicao] = useState<RodadaComMetricas | null>(null)
  const [rodadaEmExclusao, setRodadaEmExclusao] = useState<RodadaComMetricas | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Formulário de Nova Rodada
  const formNova = useForm({
    initialValues: {
      descricao: '',
      status: 'aberta',
      duplicar_de_id: null as string | null,
    },
    validate: {
      descricao: (val) =>
        val.trim().length === 0 ? 'Informe um nome ou descrição para a rodada' : null,
    },
  })

  // Formulário de Edição de Rodada
  const formEdicao = useForm({
    initialValues: {
      descricao: '',
      status: 'aberta',
    },
    validate: {
      descricao: (val) =>
        val.trim().length === 0 ? 'Informe um nome ou descrição para a rodada' : null,
    },
  })

  const carregarRodadas = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      const lista = await api.listar_rodadas_com_metricas()
      setRodadas(lista)
    } catch (error) {
      console.error('Erro ao carregar rodadas:', error)
      notifications.show({
        title: 'Erro ao carregar rodadas',
        message: 'Não foi possível buscar a lista de rodadas de cotação.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarRodadas()
  }, [])

  // Formatação de Moeda
  const formatMoney = (val?: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  // Formatação de Data
  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-'
    try {
      const parts = isoStr.split(' ')
      const [ano, mes, dia] = parts[0].split('-')
      return `${dia}/${mes}/${ano}`
    } catch {
      return isoStr
    }
  }

  // Filtragem e Busca
  const rodadasFiltradas = useMemo(() => {
    return rodadas.filter((r) => {
      const matchBusca =
        r.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        String(r.id).includes(busca)

      if (!matchBusca) return false
      if (filtroStatus === 'abertas') return r.status === 'aberta'
      if (filtroStatus === 'fechadas') return r.status === 'fechada'
      return true
    })
  }, [rodadas, busca, filtroStatus])

  // KPIs
  const totalAbertas = useMemo(() => rodadas.filter((r) => r.status === 'aberta').length, [rodadas])
  const totalFechadas = useMemo(() => rodadas.filter((r) => r.status === 'fechada').length, [rodadas])
  const totalFinanceiro = useMemo(
    () => rodadas.reduce((acc, r) => acc + (r.valor_total_alocado || 0), 0),
    [rodadas],
  )

  // Ação 1: Criar Nova Rodada
  const handleCriarRodada = async (values: typeof formNova.values) => {
    try {
      setSalvando(true)
      const api = await getApi()
      const duplicarId = values.duplicar_de_id ? parseInt(values.duplicar_de_id, 10) : null
      const nova = await api.criar_rodada(values.descricao, values.status, duplicarId)

      notifications.show({
        title: 'Rodada Criada com Sucesso',
        message: `A rodada "${nova.descricao}" foi inicializada e definida como ativa.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      })

      closeModalCriar()
      formNova.reset()
      await carregarRodadas()
      onSelecionarRodada?.(nova.id, 'necessidades')
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao criar rodada',
        message: error?.message || 'Falha ao gravar nova rodada.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvando(false)
    }
  }

  // Ação 2: Abrir Modal de Edição
  const handleAbrirEdicao = (r: RodadaComMetricas) => {
    setRodadaEmEdicao(r)
    formEdicao.setValues({
      descricao: r.descricao,
      status: r.status,
    })
    openModalEditar()
  }

  // Ação 3: Salvar Edição
  const handleSalvarEdicao = async (values: typeof formEdicao.values) => {
    if (!rodadaEmEdicao) return
    try {
      setSalvando(true)
      const api = await getApi()
      await api.atualizar_rodada(rodadaEmEdicao.id, values.descricao, values.status)

      notifications.show({
        title: 'Rodada Atualizada',
        message: 'As alterações foram salvas com sucesso.',
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      closeModalEditar()
      setRodadaEmEdicao(null)
      await carregarRodadas()
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao atualizar',
        message: error?.message || 'Falha ao salvar alterações.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvando(false)
    }
  }

  // Ação 4: Alternar Status Rápido (Abrir / Fechar)
  const handleToggleStatus = async (r: RodadaComMetricas) => {
    const novoStatus = r.status === 'aberta' ? 'fechada' : 'aberta'
    try {
      const api = await getApi()
      await api.atualizar_rodada(r.id, r.descricao, novoStatus)

      notifications.show({
        title: novoStatus === 'fechada' ? 'Rodada Concluída / Fechada' : 'Rodada Reaberta',
        message: `O status da rodada #${r.id} foi alterado para ${novoStatus}.`,
        color: novoStatus === 'fechada' ? 'gray' : 'green',
        icon: novoStatus === 'fechada' ? <IconLock size={16} /> : <IconLockOpen size={16} />,
      })

      await carregarRodadas()
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao alterar status',
        message: error?.message || 'Falha na atualização.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    }
  }

  // Ação 5: Abrir Modal de Exclusão
  const handleAbrirExclusao = (r: RodadaComMetricas) => {
    setRodadaEmExclusao(r)
    openModalExcluir()
  }

  // Ação 6: Confirmar Exclusão
  const handleConfirmarExclusao = async () => {
    if (!rodadaEmExclusao) return
    try {
      setSalvando(true)
      const api = await getApi()
      await api.remover_rodada(rodadaEmExclusao.id)

      notifications.show({
        title: 'Rodada Excluída',
        message: `A rodada #${rodadaEmExclusao.id} foi removida.`,
        color: 'blue',
        icon: <IconTrash size={16} />,
      })

      closeModalExcluir()
      setRodadaEmExclusao(null)
      await carregarRodadas()
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao excluir rodada',
        message: error?.message || 'Não foi possível excluir a rodada.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Stack gap="md" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <PageHeader
        icon={IconRotate}
        iconColor="blue"
        title="Gestão de Rodadas de Cotação"
        subtitle="Crie novos ciclos de compras, acompanhe o andamento de cotações e arquive rodadas concluídas"
        rightSection={
          <Button
            leftSection={<IconPlus size={16} />}
            color="blue"
            size="sm"
            onClick={openModalCriar}
          >
            Nova Rodada
          </Button>
        }
      />

      {/* Painel de Indicadores (KPIs) */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <StatCard
          label="Total de Rodadas"
          value={rodadas.length}
          subtitle="Ciclos de cotação registrados"
          icon={IconRotate}
          color="blue"
        />

        <StatCard
          label="Rodadas Abertas"
          value={totalAbertas}
          subtitle="Em cotação ou alocação ativa"
          icon={IconLockOpen}
          color="green"
        />

        <StatCard
          label="Rodadas Fechadas"
          value={totalFechadas}
          subtitle="Concluídas e arquivadas"
          icon={IconLock}
          color="gray"
        />

        <StatCard
          label="Volume Comprado"
          value={formatMoney(totalFinanceiro)}
          subtitle="Soma de compras alocadas"
          icon={IconTrendingUp}
          color="teal"
        />
      </SimpleGrid>

      {/* Barra de Filtros e Busca */}
      <Card withBorder p="sm" radius="md">
        <Group justify="space-between">
          <Group gap="sm" style={{ flex: 1, maxWidth: 500 }}>
            <TextInput
              placeholder="Buscar rodada por nome ou ID..."
              leftSection={<IconSearch size={16} />}
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              style={{ flex: 1 }}
              size="sm"
            />
          </Group>

          <Group gap="xs">
            <Text size="xs" c="dimmed" fw={700}>
              Status:
            </Text>
            <Button
              size="xs"
              variant={filtroStatus === 'todas' ? 'filled' : 'light'}
              color="gray"
              onClick={() => setFiltroStatus('todas')}
            >
              Todas ({rodadas.length})
            </Button>
            <Button
              size="xs"
              variant={filtroStatus === 'abertas' ? 'filled' : 'light'}
              color="green"
              onClick={() => setFiltroStatus('abertas')}
            >
              Abertas ({totalAbertas})
            </Button>
            <Button
              size="xs"
              variant={filtroStatus === 'fechadas' ? 'filled' : 'light'}
              color="gray"
              onClick={() => setFiltroStatus('fechadas')}
            >
              Fechadas ({totalFechadas})
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Tabela de Rodadas */}
      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : rodadasFiltradas.length === 0 ? (
        <EmptyState
          title="Nenhuma rodada encontrada"
          description={
            busca
              ? 'Tente ajustar os termos da busca para encontrar o ciclo desejado.'
              : 'Clique no botão acima para criar sua primeira rodada de cotação.'
          }
          action={
            !busca && (
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<IconPlus size={14} />}
                onClick={openModalCriar}
              >
                Criar Primeira Rodada
              </Button>
            )
          }
        />
      ) : (
        <Card withBorder p={0} radius="md" style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição / Nome da Rodada</Table.Th>
                <Table.Th style={{ width: 120 }}>Status</Table.Th>
                <Table.Th style={{ width: 120 }}>Criada em</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'center' }}>Produtos</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'center' }}>Cotações</Table.Th>
                <Table.Th style={{ width: 160, textAlign: 'right' }}>Total Alocado</Table.Th>
                <Table.Th style={{ width: 220, textAlign: 'center' }}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rodadasFiltradas.map((r) => {
                const isAtiva = r.id === rodadaAtivaId
                const isAberta = r.status === 'aberta'

                return (
                  <Table.Tr key={r.id} style={isAtiva ? { fontWeight: 600 } : undefined}>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm" fw={isAtiva ? 700 : 500}>
                          {r.descricao}
                        </Text>
                        {isAtiva && (
                          <Badge variant="filled" color="blue" size="xs">
                            Ativa
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      {isAberta ? (
                        <Badge color="green" variant="light" size="sm" leftSection={<IconLockOpen size={12} />}>
                          Aberta
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="outline" size="sm" leftSection={<IconLock size={12} />}>
                          Fechada
                        </Badge>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {formatDate(r.data_criacao)}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge variant="light" color="cyan" size="sm">
                        {r.total_necessidades} itens
                      </Badge>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge variant="light" color="indigo" size="sm">
                        {r.total_cotacoes} cotações
                      </Badge>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={700} c={r.valor_total_alocado > 0 ? 'teal.7' : 'dimmed'}>
                        {formatMoney(r.valor_total_alocado)}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group gap={6} justify="center">
                        <Tooltip label="Definir como rodada ativa e ir para Necessidades">
                          <Button
                            size="compact-xs"
                            variant={isAtiva ? 'filled' : 'light'}
                            color="blue"
                            leftSection={<IconChecklist size={13} />}
                            onClick={() => onSelecionarRodada?.(r.id, 'necessidades')}
                          >
                            Abrir
                          </Button>
                        </Tooltip>

                        <Tooltip label={isAberta ? 'Fechar / Concluir rodada' : 'Reabrir rodada'}>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color={isAberta ? 'gray' : 'green'}
                            onClick={() => handleToggleStatus(r)}
                          >
                            {isAberta ? <IconLock size={15} /> : <IconLockOpen size={15} />}
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Editar descrição da rodada">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            onClick={() => handleAbrirEdicao(r)}
                          >
                            <IconEdit size={15} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Excluir rodada permanentemente">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="red"
                            onClick={() => handleAbrirExclusao(r)}
                          >
                            <IconTrash size={15} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* MODAL: Nova Rodada */}
      <Modal
        opened={modalCriarOpened}
        onClose={closeModalCriar}
        title={
          <Group gap="xs">
            <IconRotate size={22} color="#228be6" />
            <Text fw={700}>Criar Nova Rodada de Cotação</Text>
          </Group>
        }
        size="md"
        centered
      >
        <form onSubmit={formNova.onSubmit(handleCriarRodada)}>
          <Stack gap="md">
            <TextInput
              label="Descrição / Nome da Rodada"
              placeholder="Ex: Cotação Mensal - Maio 2026"
              required
              autoFocus
              {...formNova.getInputProps('descricao')}
            />

            <AppSelect
              label="Copiar lista de necessidades de rodada anterior (Opcional)"
              description="Duplica os produtos necessários da rodada selecionada para poupar digitação"
              placeholder="Nenhum (Começar com lista em branco)"
              data={rodadas.map((r) => ({
                value: String(r.id),
                label: `${r.descricao} (${r.total_necessidades} produtos)`,
              }))}
              clearable
              value={formNova.values.duplicar_de_id}
              onChange={(val) => formNova.setFieldValue('duplicar_de_id', val)}
            />

            <Radio.Group
              label="Status Inicial"
              value={formNova.values.status}
              onChange={(val) => formNova.setFieldValue('status', val)}
            >
              <Group mt="xs">
                <Radio value="aberta" label="Aberta (Em cotação e alocação)" />
                <Radio value="fechada" label="Fechada (Arquivada)" />
              </Group>
            </Radio.Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeModalCriar}>
                Cancelar
              </Button>
              <Button type="submit" color="blue" loading={salvando} leftSection={<IconPlus size={16} />}>
                Criar e Ativar Rodada
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* MODAL: Editar Rodada */}
      <Modal
        opened={modalEditarOpened}
        onClose={closeModalEditar}
        title={
          <Group gap="xs">
            <IconEdit size={22} color="#228be6" />
            <Text fw={700}>Editar Rodada: {rodadaEmEdicao?.descricao}</Text>
          </Group>
        }
        centered
      >
        <form onSubmit={formEdicao.onSubmit(handleSalvarEdicao)}>
          <Stack gap="md">
            <TextInput
              label="Descrição / Nome da Rodada"
              required
              autoFocus
              {...formEdicao.getInputProps('descricao')}
            />

            <Radio.Group
              label="Status da Rodada"
              value={formEdicao.values.status}
              onChange={(val) => formEdicao.setFieldValue('status', val)}
            >
              <Group mt="xs">
                <Radio value="aberta" label="Aberta (Em cotação)" />
                <Radio value="fechada" label="Fechada (Concluída)" />
              </Group>
            </Radio.Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeModalEditar}>
                Cancelar
              </Button>
              <Button type="submit" color="blue" loading={salvando}>
                Salvar Alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* MODAL: Excluir Rodada */}
      <Modal
        opened={modalExcluirOpened}
        onClose={closeModalExcluir}
        title={
          <Group gap="xs">
            <IconTrash size={22} color="#fa5252" />
            <Text fw={700} c="red.8">
              Confirmar Exclusão de Rodada
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Tem certeza de que deseja excluir permanentemente a rodada{' '}
            <b>"{rodadaEmExclusao?.descricao}"</b>?
          </Text>

          <Text size="xs" c="dimmed">
            Esta ação excluirá todas as necessidades, cotações e alocações vinculadas a esta rodada.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeModalExcluir}>
              Cancelar
            </Button>
            <Button color="red" loading={salvando} onClick={handleConfirmarExclusao}>
              Excluir Definitivamente
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default RodadasView
