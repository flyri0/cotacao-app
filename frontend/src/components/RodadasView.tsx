import { useEffect, useState, useMemo } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Radio,
  SimpleGrid,
  Stack,
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
  IconTrash,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import { AppSelect, EmptyState, PageHeader, StatCard } from './common'
import { formatMoney, getVirtualizedTableProps } from '../utils'
import { useDataCacheSubscription } from '../hooks'
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

  const carregarRodadas = async (silent = false) => {
    try {
      if (!silent && rodadas.length === 0) setLoading(true)
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
      if (!silent) setLoading(false)
    }
  }

  useDataCacheSubscription('rounds', () => {
    carregarRodadas(true)
  })

  useEffect(() => {
    carregarRodadas()
  }, [])


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

  // KPIs
  const totalAbertas = useMemo(() => rodadas.filter((r) => r.status === 'aberta').length, [rodadas])
  const totalFechadas = useMemo(() => rodadas.filter((r) => r.status === 'fechada').length, [rodadas])
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

  const columns = useMemo<MRT_ColumnDef<RodadaComMetricas>[]>(
    () => [
      {
        accessorKey: 'descricao',
        header: 'Descrição / Nome da Rodada',
        size: 260,
        Cell: ({ row }) => {
          const r = row.original
          const isAtiva = r.id === rodadaAtivaId
          const isCancelada = r.status === 'cancelada'
          return (
            <Group gap="xs" wrap="nowrap">
              <Text size="xs" fw={isAtiva ? 700 : 500} c={isCancelada ? 'dimmed' : undefined} truncate="end">
                {r.descricao}
              </Text>
              {isAtiva && (
                <Badge variant="filled" color={themeColor} size="xs">
                  Ativa
                </Badge>
              )}
            </Group>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        filterVariant: 'select',
        mantineFilterSelectProps: {
          data: [
            { label: 'Aberta', value: 'aberta' },
            { label: 'Fechada', value: 'fechada' },
            { label: 'Cancelada', value: 'cancelada' },
          ],
        },
        Cell: ({ row }) => {
          const r = row.original
          if (r.status === 'aberta') {
            return (
              <Badge color="teal" variant="light" size="xs" leftSection={<IconLockOpen size={11} />}>
                Aberta
              </Badge>
            )
          }
          if (r.status === 'fechada') {
            return (
              <Badge color="gray" variant="outline" size="xs" leftSection={<IconLock size={11} />}>
                Fechada
              </Badge>
            )
          }
          return (
            <Badge color="red" variant="light" size="xs" leftSection={<IconBan size={11} />}>
              Cancelada
            </Badge>
          )
        },
      },
      {
        accessorKey: 'data_criacao',
        header: 'Criada em',
        size: 110,
        Cell: ({ cell }) => (
          <Text size="xs" c="dimmed">
            {formatDate(cell.getValue<string>())}
          </Text>
        ),
      },
      {
        accessorKey: 'total_necessidades',
        header: 'Produtos',
        size: 100,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ cell }) => (
          <Badge variant="light" color="cyan" size="xs">
            {cell.getValue<number>()} itens
          </Badge>
        ),
      },
      {
        accessorKey: 'total_cotacoes',
        header: 'Cotações',
        size: 100,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ cell }) => (
          <Badge variant="light" color="indigo" size="xs">
            {cell.getValue<number>()} cotações
          </Badge>
        ),
      },
      {
        accessorKey: 'valor_total_alocado',
        header: 'Total Alocado',
        size: 130,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => {
          const r = row.original
          const isCancelada = r.status === 'cancelada'
          return (
            <Text size="xs" fw={700} c={r.valor_total_alocado > 0 && !isCancelada ? 'teal' : 'dimmed'}>
              {formatMoney(r.valor_total_alocado)}
            </Text>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 180,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const r = row.original
          const isAtiva = r.id === rodadaAtivaId
          const isAberta = r.status === 'aberta'
          const isCancelada = r.status === 'cancelada'
          return (
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
          )
        },
      },
    ],
    [rodadaAtivaId, themeColor, onSelecionarRodada]
  )

  const table = useMantineReactTable({
    ...getVirtualizedTableProps<RodadaComMetricas>({
      enableTopToolbar: true,
      enableRowVirtualization: true,
      enableColumnFilters: true,
      enableGlobalFilter: true,
    }),
    columns,
    data: rodadas,
    getRowId: (row) => String(row.id),
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
      </Box>

      <Box style={{ flexShrink: 0 }}>
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
      </Box>

      {/* Tabela Mantine React Table de Rodadas */}
      <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading ? (
          <Center p="xl" style={{ flex: 1 }}>
            <Loader size="lg" />
          </Center>
        ) : rodadas.length === 0 ? (
          <EmptyState
            title="Nenhuma rodada encontrada"
            description="Clique no botão acima para criar sua primeira rodada de cotação."
            action={
              <Button
                size="xs"
                variant="light"
                color={themeColor}
                leftSection={<IconPlus size={14} />}
                onClick={openModalCriar}
              >
                Criar Nova Rodada
              </Button>
            }
          />
        ) : (
          <MantineReactTable table={table} />
        )}
      </Box>

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
