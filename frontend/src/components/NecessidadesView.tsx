import { useEffect, useState, useMemo, useRef } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Kbd,
  Loader,
  Modal,
  Radio,
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
  IconCheck,
  IconChecklist,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../locales/mrtPtBr'
import { PageHeader } from './common/PageHeader'
import { RoundHeaderSelector } from './common/RoundHeaderSelector'
import { SectionCard } from './common/SectionCard'
import { AppAutocomplete, AppSelect } from './common/AppSelect'
import { getApi } from '../services/api'
import type { Necessidade, Produto, Rodada } from '../types'

interface NecessidadesViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
}

export function NecessidadesView({
  rodadaAtivaId,
  onRodadaChange,
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

  const produtoInputRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    initialValues: {
      produtoNome: '',
    },
    validate: {
      produtoNome: (value) =>
        value.trim().length === 0 ? 'Informe o nome do produto' : null,
    },
  })

  // Produto selecionado no autocomplete
  const produtoSelecionado = useMemo(() => {
    return produtos.find(
      (p) =>
        p.nome.trim().toLowerCase() === form.values.produtoNome.trim().toLowerCase(),
    )
  }, [produtos, form.values.produtoNome])

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

  useEffect(() => {
    carregarDadosIniciais()
    setTimeout(() => produtoInputRef.current?.focus(), 150)
  }, [])

  // Adição ultra rápida de produto à rodada
  const adicionarProdutoPorNome = async (nomeProduto: string) => {
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
      (p) => p.nome.trim().toLowerCase() === nomeProduto.trim().toLowerCase(),
    )

    if (!prod) {
      form.setFieldError(
        'produtoNome',
        'Produto não encontrado. Digite ou selecione um produto cadastrado.',
      )
      notifications.show({
        title: 'Produto inexistente',
        message: `O produto "${nomeProduto}" não foi encontrado no cadastro.`,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
      produtoInputRef.current?.focus()
      return
    }

    try {
      setSubmitting(true)
      const api = await getApi()
      const salva = await api.create_need(selectedRodadaId, prod.id, 0)

      notifications.show({
        title: 'Produto Incluído',
        message: `"${salva.produto_nome}" adicionado à rodada.`,
        color: 'green',
        icon: <IconCheck size={16} />,
        autoClose: 1800,
      })

      form.setFieldValue('produtoNome', '')
      await carregarNecessidades(selectedRodadaId)

      // Mantém o cursor pronto para o próximo item
      setTimeout(() => {
        produtoInputRef.current?.focus()
      }, 50)
    } catch (error: any) {
      console.error('Erro ao adicionar à rodada:', error)
      notifications.show({
        title: 'Erro ao salvar',
        message: error?.message || 'Falha ao incluir produto na rodada.',
        color: 'red',
        icon: <IconX size={16} />,
      })
      produtoInputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (values: typeof form.values) => {
    await adicionarProdutoPorNome(values.produtoNome)
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
          produtoInputRef.current?.focus()
        }
      },
    })
  }

  // Apenas produtos que AINDA NÃO foram adicionados a esta rodada para facilitar a busca rápida
  const nomesProdutosDisponiveis = useMemo(() => {
    const idsJaAdicionados = new Set(necessidades.map((n) => n.id_produto))
    return produtos
      .filter((p) => !idsJaAdicionados.has(p.id))
      .map((p) => p.nome)
  }, [produtos, necessidades])

  const columns = useMemo<MRT_ColumnDef<Necessidade>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto em Falta na Rodada',
        Cell: ({ cell }) => <Text fw={600}>{cell.getValue<string>()}</Text>,
      },
      {
        accessorKey: 'produto_categoria',
        header: 'Categoria',
        size: 180,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return val ? (
            <Badge variant="dot" color="teal">
              {val}
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 90,
        Cell: ({ row }) => (
          <Tooltip label="Remover produto da rodada">
            <ActionIcon
              color="red"
              variant="subtle"
              loading={deletingId === row.original.id}
              disabled={isFechada}
              onClick={() => handleRemover(row.original.id, row.original.produto_nome)}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [deletingId, isFechada],
  )

  const table = useMantineReactTable({
    enableDensityToggle: false,
    columns,
    data: necessidades,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    initialState: { density: 'xs', pagination: { pageSize: 15, pageIndex: 0 } },
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
        iconColor="indigo"
        title="Produtos em Falta (Necessidades)"
        subtitle="Selecione no autocomplete ou tecle Enter"
        rightSection={
          <Group gap="xs">
            {isFechada && (
              <Badge variant="filled" color="red" size="xs">
                Rodada Fechada
              </Badge>
            )}
            <RoundHeaderSelector
              rodadas={rodadas}
              selectedRodadaId={selectedRodadaId}
              onSelectRodada={(id) => {
                setSelectedRodadaId(id)
                onRodadaChange?.(id)
                carregarNecessidades(id)
              }}
              onNovaRodadaClick={openModalNovaRodada}
            />
          </Group>
        }
      />

      {/* Formulário Ultrarrápido de Inclusão por Teclado */}
      <SectionCard
        title="Adicionar Produto à Rodada"
        subtitle="Pressione Enter para incluir"
        kbdHint="Enter"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <fieldset disabled={isFechada} style={{ border: 'none', padding: 0, margin: 0 }}>
            <Group align="flex-end" gap="xs">
            <AppAutocomplete
              ref={produtoInputRef}
              label="Produto"
              size="xs"
              placeholder="Digite o nome do produto..."
              data={nomesProdutosDisponiveis}
              required
              limit={8}
              style={{ flex: 1 }}
              {...form.getInputProps('produtoNome')}
              onOptionSubmit={(val) => {
                form.setFieldValue('produtoNome', val)
                adicionarProdutoPorNome(val)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (form.values.produtoNome.trim()) {
                    adicionarProdutoPorNome(form.values.produtoNome)
                  }
                }
              }}
            />

            <Button
              type="submit"
              size="xs"
              leftSection={<IconPlus size={15} />}
              loading={submitting}
            >
              Adicionar <Kbd ml={4} size="xs">Enter</Kbd>
            </Button>
          </Group>

          {produtoSelecionado && produtoSelecionado.categoria && (
            <Group mt={4} gap="xs">
              <Badge variant="dot" color="teal" size="sm">
                {produtoSelecionado.categoria}
              </Badge>
            </Group>
          )}
          </fieldset>
        </form>
      </SectionCard>

      {/* Mantine React Table */}
      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <MantineReactTable table={table} />
      )}

      {/* Modal Criar Nova Rodada */}
      <Modal
        opened={modalNovaRodadaOpened}
        onClose={closeModalNovaRodada}
        title={
          <Group gap="xs">
            <IconPlus size={20} color="#228be6" />
            <Text fw={700}>Criar Nova Rodada de Cotação</Text>
          </Group>
        }
        centered
      >
        <form onSubmit={formNovaRodada.onSubmit(handleCriarNovaRodada)}>
          <Stack gap="md">
            <TextInput
              label="Descrição / Nome da Rodada"
              placeholder="Ex: Cotação Geral - Maio 2026"
              required
              autoFocus
              {...formNovaRodada.getInputProps('descricao')}
            />

            <AppSelect
              label="Copiar produtos de rodada anterior (Opcional)"
              description="Duplica os itens em falta da rodada escolhida"
              placeholder="Nenhuma (Começar lista vazia)"
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
              value={formNovaRodada.values.status}
              onChange={(val) => formNovaRodada.setFieldValue('status', val)}
            >
              <Group mt="xs">
                <Radio value="aberta" label="Aberta (Em andamento)" />
                <Radio value="fechada" label="Fechada" />
              </Group>
            </Radio.Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeModalNovaRodada}>
                Cancelar
              </Button>
              <Button type="submit" color="blue" loading={salvandoRodada} leftSection={<IconPlus size={16} />}>
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

