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
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconBan,
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
  themeColor?: string
}

export function RodadasView({
  rodadaAtivaId,
  onSelecionarRodada,
  themeColor = 'blue',
}: RodadasViewProps) {
  const [rodadas, setRodadas] = useState<RodadaComMetricas[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'abertas' | 'fechadas' | 'canceladas'>('todas')

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
      const lista = await api.list_rounds_with_metrics()
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
      if (filtroStatus === 'canceladas') return r.status === 'cancelada'
      return true
    })
  }, [rodadas, busca, filtroStatus])

  // KPIs
  const totalAbertas = useMemo(() => rodadas.filter((r) => r.status === 'aberta').length, [rodadas])
  const totalFechadas = useMemo(() => rodadas.filter((r) => r.status === 'fechada').length, [rodadas])
  const totalCanceladas = useMemo(() => rodadas.filter((r) => r.status === 'cancelada').length, [rodadas])
  const totalFinanceiro = useMemo(
    () => rodadas.filter((r) => r.status !== 'cancelada').reduce((acc, r) => acc + (r.valor_total_alocado || 0), 0),
    [rodadas],
  )

  // Ação 1: Criar Nova Rodada
  const handleCriarRodada = async (values: typeof formNova.values) => {
    try {
      setSalvando(true)
      const api = await getApi()
      const duplicarId = values.duplicar_de_id ? parseInt(values.duplicar_de_id, 10) : null
      const nova = await api.create_round(values.descricao, values.status, duplicarId)

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
      await api.update_round(rodadaEmEdicao.id, values.descricao, values.status)

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

  // Ação 4: Alternar Status Rápido (Abrir / Fechar / Reativar)
  const handleToggleStatus = async (r: RodadaComMetricas) => {
    const novoStatus = r.status === 'aberta' ? 'fechada' : 'aberta'
    try {
      const api = await getApi()
      await api.update_round(r.id, r.descricao, novoStatus)

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

  // Ação 6: Confirmar Exclusão com bloqueio seguro e sugestão de cancelamento
  const handleConfirmarExclusao = async () => {
    if (!rodadaEmExclusao) return
    const rodada = rodadaEmExclusao
    try {
      setSalvando(true)
      const api = await getApi()
      const res = await api.remove_round(rodada.id)

      notifications.show({
        title: 'Rodada Excluída',
        message: res.mensagem || `A rodada #${rodada.id} foi removida permanentemente.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      })

      closeModalExcluir()
      setRodadaEmExclusao(null)
      await carregarRodadas()
    } catch (error: any) {
      console.error('Erro ao excluir rodada:', error)
      const msg = error?.message || 'Não foi possível excluir a rodada.'
      closeModalExcluir()

      modals.open({
        title: (
          <Group gap="xs">
            <IconAlertCircle color="var(--mantine-color-red-6)" size={20} />
            <Text fw={700}>Exclusão Bloqueada</Text>
          </Group>
        ),
        centered: true,
        children: (
          <Stack gap="sm">
            <Text size="sm">{msg}</Text>
            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                color="red"
                leftSection={<IconBan size={16} />}
                onClick={async () => {
                  modals.closeAll()
                  try {
                    const api = await getApi()
                    await api.update_round(rodada.id, rodada.descricao, 'cancelada')
                    notifications.show({
                      title: 'Rodada Cancelada',
                      message: `A rodada #${rodada.id} foi arquivada como cancelada sem perder o histórico comercial.`,
                      color: 'red',
                      icon: <IconBan size={16} />,
                    })
                    await carregarRodadas()
                  } catch (e: any) {
                    notifications.show({
                      title: 'Erro ao cancelar rodada',
                      message: e?.message || 'Falha ao atualizar status.',
                      color: 'red',
                      icon: <IconX size={16} />,
                    })
                  }
                }}
              >
                Cancelar Rodada Agora
              </Button>
              <Button variant="default" onClick={() => modals.closeAll()}>
                Fechar
              </Button>
            </Group>
          </Stack>
        ),
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <PageHeader
        icon={IconRotate}
        iconColor={themeColor}
        title="Gestão de Rodadas de Cotação"
        subtitle="Ciclos de compras e acompanhamento de cotações"
        rightSection={
          <Button
            leftSection={<IconPlus size={14} />}
            variant="filled"
            color={themeColor}
            size="xs"
            onClick={openModalCriar}
          >
            Nova Rodada
          </Button>
        }
      />

      {/* Painel de Indicadores (KPIs) */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
        <StatCard
          label="Total Rodadas"
          value={rodadas.length}
          subtitle="Ciclos registrados"
          icon={IconRotate}
          color={themeColor}
        />

        <StatCard
          label="Abertas"
          value={totalAbertas}
          subtitle="Em cotação ativa"
          icon={IconLockOpen}
          color="teal"
        />

        <StatCard
          label="Fechadas"
          value={totalFechadas}
          subtitle="Histórico consolidado"
          icon={IconLock}
          color="gray"
        />

        <StatCard
          label="Volume Comprado"
          value={formatMoney(totalFinanceiro)}
          subtitle="Total alocado"
          icon={IconTrendingUp}
          color="teal"
        />
      </SimpleGrid>

      {/* Barra de Filtros e Busca */}
      <Card withBorder p="xs" radius="sm">
        <Group justify="space-between">
          <Group gap="xs" style={{ flex: 1, maxWidth: 400 }}>
            <TextInput
              placeholder="Buscar rodada por nome ou ID..."
              leftSection={<IconSearch size={14} />}
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              style={{ flex: 1 }}
              size="xs"
            />
          </Group>

          <Group gap={4}>
            <Text size="11px" c="dimmed" fw={700}>
              Status:
            </Text>
            <Button
              size="compact-xs"
              variant={filtroStatus === 'todas' ? 'filled' : 'light'}
              color="gray"
              onClick={() => setFiltroStatus('todas')}
            >
              Todas ({rodadas.length})
            </Button>
            <Button
              size="compact-xs"
              variant={filtroStatus === 'abertas' ? 'filled' : 'light'}
              color="teal"
              onClick={() => setFiltroStatus('abertas')}
            >
              Abertas ({totalAbertas})
            </Button>
            <Button
              size="compact-xs"
              variant={filtroStatus === 'fechadas' ? 'filled' : 'light'}
              color="gray"
              onClick={() => setFiltroStatus('fechadas')}
            >
              Fechadas ({totalFechadas})
            </Button>
            <Button
              size="compact-xs"
              variant={filtroStatus === 'canceladas' ? 'filled' : 'light'}
              color="red"
              onClick={() => setFiltroStatus('canceladas')}
            >
              Canceladas ({totalCanceladas})
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
        <Card withBorder p={0} radius="sm" style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover verticalSpacing={3} horizontalSpacing={6}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição / Nome da Rodada</Table.Th>
                <Table.Th style={{ width: 110 }}>Status</Table.Th>
                <Table.Th style={{ width: 100 }}>Criada em</Table.Th>
                <Table.Th style={{ width: 100, textAlign: 'center' }}>Produtos</Table.Th>
                <Table.Th style={{ width: 100, textAlign: 'center' }}>Cotações</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Total Alocado</Table.Th>
                <Table.Th style={{ width: 190, textAlign: 'center' }}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rodadasFiltradas.map((r) => {
                const isAtiva = r.id === rodadaAtivaId
                const isAberta = r.status === 'aberta'
                const isCancelada = r.status === 'cancelada'

                return (
                  <Table.Tr key={r.id} style={isAtiva ? { fontWeight: 600 } : undefined}>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="xs" fw={isAtiva ? 700 : 500} c={isCancelada ? 'dimmed' : undefined}>
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
                      {isAberta && (
                        <Badge color="green" variant="light" size="xs" leftSection={<IconLockOpen size={11} />}>
                          Aberta
                        </Badge>
                      )}
                      {r.status === 'fechada' && (
                        <Badge color="gray" variant="outline" size="xs" leftSection={<IconLock size={11} />}>
                          Fechada
                        </Badge>
                      )}
                      {isCancelada && (
                        <Badge color="red" variant="light" size="sm" leftSection={<IconBan size={12} />}>
                          Cancelada
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
                      <Text size="sm" fw={700} c={r.valor_total_alocado > 0 && !isCancelada ? 'teal.7' : 'dimmed'}>
                        {formatMoney(r.valor_total_alocado)}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group gap={4} justify="center" wrap="nowrap">
                        <Tooltip label="Definir como rodada ativa e ir para Necessidades">
                          <Button
                            size="compact-xs"
                            variant={isAtiva ? 'filled' : 'light'}
                            color={themeColor}
                            leftSection={<IconChecklist size={13} />}
                            onClick={() => onSelecionarRodada?.(r.id, 'necessidades')}
                          >
                            Abrir
                          </Button>
                        </Tooltip>

                        <Tooltip
                          label={
                            isAberta
                              ? 'Fechar / Concluir rodada'
                              : isCancelada
                              ? 'Reativar rodada'
                              : 'Reabrir rodada'
                          }
                        >
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color={isAberta ? 'gray' : 'teal'}
                            onClick={() => handleToggleStatus(r)}
                          >
                            {isAberta ? (
                              <IconLock size={15} />
                            ) : isCancelada ? (
                              <IconRotate size={15} />
                            ) : (
                              <IconLockOpen size={15} />
                            )}
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Editar rodada">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color={themeColor}
                            onClick={() => handleAbrirEdicao(r)}
                          >
                            <IconEdit size={15} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Excluir rodada permanentemente">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
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
            <IconRotate size={18} />
            <Text fw={700}>Criar Nova Rodada de Cotação</Text>
          </Group>
        }
        size="md"
        radius="sm"
        centered
      >
        <form onSubmit={formNova.onSubmit(handleCriarRodada)}>
          <Stack gap="sm">
            <TextInput
              label="Descrição / Nome da Rodada"
              size="xs"
              placeholder="Ex: Cotação Mensal - Maio 2026"
              required
              autoFocus
              {...formNova.getInputProps('descricao')}
            />

            <Radio.Group
              label="Status Inicial"
              size="xs"
              value={formNova.values.status}
              onChange={(val) => formNova.setFieldValue('status', val)}
            >
              <Group mt="xs">
                <Radio value="aberta" label="Aberta (Em cotação)" color="teal" size="xs" />
                <Radio value="fechada" label="Fechada (Concluída)" color="gray" size="xs" />
              </Group>
            </Radio.Group>

            {rodadas.length > 0 && (
              <AppSelect
                label="Duplicar Necessidades de Outra Rodada (Opcional)"
                size="xs"
                placeholder="Selecione para copiar itens em falta..."
                data={rodadas.map((r) => ({
                  value: String(r.id),
                  label: `${r.descricao} (${r.total_necessidades} itens)`,
                }))}
                clearable
                {...formNova.getInputProps('duplicar_de_id')}
              />
            )}

            <Group justify="flex-end" gap="xs" mt="md">
              <Button variant="subtle" color="gray" size="xs" onClick={closeModalCriar}>
                Cancelar
              </Button>
              <Button type="submit" variant="filled" color={themeColor} size="xs" loading={salvando}>
                Criar Rodada
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
            <IconEdit size={18} />
            <Text fw={700}>Editar Rodada: {rodadaEmEdicao?.descricao}</Text>
          </Group>
        }
        radius="sm"
        centered
      >
        <form onSubmit={formEdicao.onSubmit(handleSalvarEdicao)}>
          <Stack gap="sm">
            <TextInput
              label="Descrição / Nome da Rodada"
              size="xs"
              required
              autoFocus
              {...formEdicao.getInputProps('descricao')}
            />

            <Radio.Group
              label="Status da Rodada"
              size="xs"
              value={formEdicao.values.status}
              onChange={(val) => formEdicao.setFieldValue('status', val)}
            >
              <Group mt="xs">
                <Radio value="aberta" label="Aberta" color="teal" size="xs" />
                <Radio value="fechada" label="Fechada (Concluída)" color="gray" size="xs" />
                <Radio value="cancelada" label="Cancelada (Arquivada)" color="red" size="xs" />
              </Group>
            </Radio.Group>

            <Group justify="flex-end" gap="xs" mt="md">
              <Button variant="subtle" color="gray" size="xs" onClick={closeModalEditar}>
                Cancelar
              </Button>
              <Button type="submit" variant="filled" color={themeColor} size="xs" loading={salvando}>
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
            <IconTrash size={18} color="var(--mantine-color-red-6)" />
            <Text fw={700} c="red">
              Confirmar Exclusão de Rodada
            </Text>
          </Group>
        }
        radius="sm"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Tem certeza de que deseja excluir permanentemente a rodada{' '}
            <b>"{rodadaEmExclusao?.descricao}"</b>?
          </Text>

          <Text size="xs" c="dimmed">
            Nota: Apenas rodadas sem cotações ou compras registradas podem ser excluídas permanentemente.
            Para ciclos com histórico, utilize a opção "Cancelada" no status para arquivá-los com segurança.
          </Text>

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={closeModalExcluir}>
              Cancelar
            </Button>
            <Button color="red" variant="filled" size="xs" loading={salvando} onClick={handleConfirmarExclusao}>
              Excluir Definitivamente
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default RodadasView
