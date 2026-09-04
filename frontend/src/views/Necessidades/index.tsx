import { useEffect, useState, useMemo } from 'react'
import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  Radio,
  Stack,
  Text,
  TextInput,
  useComputedColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconChecklist,
  IconPackage,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
} from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoundHeaderSelector } from '../../components/form/RoundHeaderSelector'
import { AppSelect } from '../../components/form/AppSelect'
import { getApi } from '../../services/api'
import type { Necessidade, Produto, Rodada } from '../../types'
import { NecessidadesForm } from './NecessidadesForm'
import { useNecessidadesColumns } from './useNecessidadesColumns'

interface NecessidadesViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
  themeColor?: string
}

export function NecessidadesView({
  rodadaAtivaId,
  onRodadaChange,
  themeColor = 'blue',
}: NecessidadesViewProps) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  
  const rodadaAtual = rodadas.find((r) => r.id === selectedRodadaId)
  const isFechada = rodadaAtual?.status === 'fechada'

  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  const selectedNeedIds = useMemo(() => {
    return Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number)
  }, [rowSelection])

  const carregarNecessidades = async (rodadaId: number) => {
    try {
      setLoading(true)
      const api = await getApi()
      const nec = await api.list_needs(rodadaId)
      setNecessidades(nec)
    } catch (error) {
      console.error('Erro ao carregar necessidades:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExcluirEmMassa = () => {
    if (selectedNeedIds.length === 0 || isFechada) return

    modals.openConfirmModal({
      title: (
        <Group gap="xs">
          <IconTrash size={18} color="var(--mantine-color-red-6)" />
          <Text fw={700}>Remover {selectedNeedIds.length} Itens da Rodada</Text>
        </Group>
      ),
      children: (
        <Text size="xs">
          Tem certeza que deseja remover os <b>{selectedNeedIds.length}</b> itens selecionados da lista de necessidades desta rodada?
        </Text>
      ),
      labels: { confirm: 'Remover da Rodada', cancel: 'Cancelar' },
      confirmProps: { color: 'red', size: 'xs' },
      cancelProps: { size: 'xs' },
      onConfirm: async () => {
        try {
          const api = await getApi()
          const res = await api.batch_remove_needs(selectedNeedIds)
          notifications.show({
            title: 'Itens Removidos',
            message: `${res.removidos} item(ns) removidos da rodada com sucesso.`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          })
          setRowSelection({})
          if (selectedRodadaId) {
            await carregarNecessidades(selectedRodadaId)
          }
        } catch (err: any) {
          notifications.show({
            title: 'Erro ao remover itens',
            message: err?.message || 'Falha ao remover necessidades em lote.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        }
      },
    })
  }

  const [modalNovaRodadaOpened, { open: openModalNovaRodada, close: closeModalNovaRodada }] =
    useDisclosure(false)
  const [salvandoRodada, setSalvandoRodada] = useState(false)

  const formNovaRodada = useForm({
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

  const handleCriarNovaRodada = async (values: typeof formNovaRodada.values) => {
    try {
      setSalvandoRodada(true)
      const api = await getApi()
      const duplicarId = values.duplicar_de_id ? parseInt(values.duplicar_de_id, 10) : null
      const nova = await api.create_round(values.descricao, values.status, duplicarId)

      notifications.show({
        title: 'Rodada Criada',
        message: `A rodada "${nova.descricao}" foi criada e selecionada.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      })

      closeModalNovaRodada()
      formNovaRodada.reset()

      const listaRodadas = await api.list_rounds()
      setRodadas(listaRodadas)
      setSelectedRodadaId(nova.id)
      onRodadaChange?.(nova.id)
      await carregarNecessidades(nova.id)
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao criar rodada',
        message: error?.message || 'Falha ao salvar rodada.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvandoRodada(false)
    }
  }

  const carregarDadosIniciais = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      const [listaRodadas, listaProdutos] = await Promise.all([
        api.list_rounds(),
        api.list_products(true),
      ])

      setRodadas(listaRodadas)
      setProdutos(listaProdutos)

      let rodadaId = selectedRodadaId
      if (!rodadaId && listaRodadas.length > 0) {
        rodadaId = listaRodadas[0].id
        setSelectedRodadaId(rodadaId)
        onRodadaChange?.(rodadaId)
      }

      if (rodadaId) {
        const nec = await api.list_needs(rodadaId)
        setNecessidades(nec)
      }
    } catch (error) {
      console.error('Erro ao carregar necessidades:', error)
      notifications.show({
        title: 'Erro de comunicação',
        message: 'Não foi possível carregar as necessidades da rodada.',
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

  const adicionarProdutoPorNome = async (nomeProduto: string) => {
    const nomeLimpo = nomeProduto.trim()
    if (!nomeLimpo) return

    if (!selectedRodadaId) {
      notifications.show({
        title: 'Selecione uma rodada',
        message: 'É necessário selecionar uma rodada ativa para adicionar itens.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    const prod = produtos.find(
      (p) => p.nome.trim().toLowerCase() === nomeLimpo.toLowerCase(),
    )

    try {
      setSubmitting(true)
      const api = await getApi()
      const salva = await api.create_need(
        selectedRodadaId,
        prod ? prod.id : null,
        0,
        prod ? null : nomeLimpo,
      )

      if (salva.produto_novo) {
        notifications.show({
          title: 'Novo Produto Cadastrado',
          message: `"${salva.produto_nome}" foi cadastrado no catálogo e incluído na rodada.`,
          color: 'teal',
          icon: <IconPackage size={16} />,
          autoClose: 3500,
        })
        await carregarDadosIniciais()
      } else {
        notifications.show({
          title: 'Produto Incluído',
          message: `"${salva.produto_nome}" adicionado à rodada.`,
          color: 'green',
          icon: <IconCheck size={16} />,
          autoClose: 1800,
        })
      }

      await carregarNecessidades(selectedRodadaId)
    } catch (error: any) {
      console.error('Erro ao adicionar à rodada:', error)
      notifications.show({
        title: 'Erro ao salvar',
        message: error?.message || 'Falha ao incluir produto na rodada.',
        color: 'red',
        icon: <IconX size={16} />,
      })
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemover = (id: number, produtoNome: string) => {
    modals.openConfirmModal({
      title: 'Remover Item da Rodada',
      centered: true,
      children: (
        <Text size="sm">
          Deseja remover <b>{produtoNome}</b> da lista de necessidades desta rodada?
        </Text>
      ),
      labels: { confirm: 'Remover da Rodada', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          setDeletingId(id)
          const api = await getApi()
          await api.remove_need(id)

          notifications.show({
            title: 'Item Removido',
            message: `"${produtoNome}" foi removido da rodada.`,
            color: 'blue',
            icon: <IconCheck size={16} />,
          })

          if (selectedRodadaId) {
            await carregarNecessidades(selectedRodadaId)
          }
        } catch (error) {
          console.error('Erro ao remover necessidade:', error)
          notifications.show({
            title: 'Erro ao remover',
            message: 'Não foi possível excluir o item da rodada.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  const nomesProdutosDisponiveis = useMemo(() => {
    const idsJaAdicionados = new Set(necessidades.map((n) => n.id_produto))
    return produtos
      .filter((p) => !idsJaAdicionados.has(p.id))
      .map((p) => p.nome)
  }, [produtos, necessidades])

  const columns = useNecessidadesColumns({
    deletingId,
    isFechada,
    handleRemover,
  })

  const table = useMantineReactTable({
    enableDensityToggle: false,
    columns,
    data: necessidades,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    initialState: { density: 'xs', pagination: { pageSize: 15, pageIndex: 0 } },
    renderTopToolbarCustomActions: () => {
      if (selectedNeedIds.length === 0) return null
      return (
        <Paper
          withBorder
          radius="sm"
          p="xs"
          style={{
            width: '100%',
            backgroundColor: isDark
              ? 'var(--mantine-color-dark-6)'
              : 'var(--mantine-color-blue-0)',
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap="xs" align="center">
              <Badge size="sm" variant="filled" color={themeColor}>
                {selectedNeedIds.length} item{selectedNeedIds.length > 1 ? 's' : ''} em falta selecionado{selectedNeedIds.length > 1 ? 's' : ''}
              </Badge>
              <Button
                variant="filled"
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                disabled={isFechada}
                onClick={handleExcluirEmMassa}
              >
                Remover da Rodada
              </Button>
            </Group>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setRowSelection({})}
            >
              Desmarcar Todos
            </Button>
          </Group>
        </Paper>
      )
    },
    mantineTableHeadCellProps: {
      style: {
        padding: '6px 8px',
        fontSize: 'var(--app-font-base, 13px)',
        whiteSpace: 'nowrap',
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: '4px 8px',
        fontSize: 'var(--app-font-base, 13px)',
      },
    },
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: true,
    },
    mantinePaperProps: {
      withBorder: true,
      radius: 'sm',
      shadow: 'none',
    },
  })

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      <PageHeader
        icon={IconChecklist}
        iconColor={themeColor}
        title="Produtos em Falta (Necessidades)"
        subtitle="Selecione no autocomplete ou tecle Enter"
        rightSection={
          <RoundHeaderSelector
            rodadas={rodadas}
            selectedRodadaId={selectedRodadaId}
            themeColor={themeColor}
            onSelectRodada={(id) => {
              setSelectedRodadaId(id)
              onRodadaChange?.(id)
              carregarNecessidades(id)
            }}
            onNovaRodadaClick={openModalNovaRodada}
          />
        }
      />

      <NecessidadesForm
        isFechada={isFechada}
        submitting={submitting}
        themeColor={themeColor}
        produtos={produtos}
        nomesProdutosDisponiveis={nomesProdutosDisponiveis}
        onSubmit={adicionarProdutoPorNome}
      />

      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <MantineReactTable table={table} />
      )}

      <Modal
        opened={modalNovaRodadaOpened}
        onClose={closeModalNovaRodada}
        title={
          <Group gap="xs">
            <IconPlus size={18} />
            <Text fw={700}>Criar Nova Rodada de Cotação</Text>
          </Group>
        }
        radius="sm"
        centered
      >
        <form onSubmit={formNovaRodada.onSubmit(handleCriarNovaRodada)}>
          <Stack gap="sm">
            <TextInput
              label="Descrição / Nome da Rodada"
              size="xs"
              placeholder="Ex: Cotação Geral - Maio 2026"
              required
              autoFocus
              {...formNovaRodada.getInputProps('descricao')}
            />

            <AppSelect
              label="Copiar produtos de rodada anterior (Opcional)"
              description="Duplica os itens em falta da rodada escolhida"
              placeholder="Nenhuma (Começar lista vazia)"
              size="xs"
              data={rodadas.map((r) => ({
                value: String(r.id),
                label: `#${r.id} - ${r.descricao}`,
              }))}
              clearable
              value={formNovaRodada.values.duplicar_de_id}
              onChange={(val) => formNovaRodada.setFieldValue('duplicar_de_id', val)}
            />

            <Radio.Group
              label="Status Inicial"
              size="xs"
              value={formNovaRodada.values.status}
              onChange={(val) => formNovaRodada.setFieldValue('status', val)}
            >
              <Group mt="xs">
                <Radio value="aberta" label="Aberta (Em andamento)" color="teal" size="xs" />
                <Radio value="fechada" label="Fechada" color="gray" size="xs" />
              </Group>
            </Radio.Group>

            <Group justify="flex-end" gap="xs" mt="md">
              <Button variant="subtle" color="gray" size="xs" onClick={closeModalNovaRodada}>
                Cancelar
              </Button>
              <Button type="submit" variant="filled" color={themeColor} size="xs" loading={salvandoRodada} leftSection={<IconPlus size={14} />}>
                Criar e Selecionar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}

export default NecessidadesView
