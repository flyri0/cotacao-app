import { useEffect, useState, useMemo, useRef } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  FileInput,
  Group,
  Kbd,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconEdit,
  IconFileSpreadsheet,
  IconPackage,
  IconPlus,
  IconPower,
  IconTag,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import { AppAutocomplete, PageHeader, SectionCard } from './common'
import { BatchCategoryModal, EditProductModal } from './produtos'
import { downloadBase64File, getVirtualizedTableProps } from '../utils'
import { useDataCacheSubscription } from '../hooks'
import { getApi } from '../services/api'
import type { Produto } from '../types'

export function ProdutosView({ themeColor = 'blue' }: { themeColor?: string }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Produto | null>(null)
  const [modalEditarOpened, { open: openModalEditar, close: closeModalEditar }] =
    useDisclosure(false)

  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [modalMassaCategoriaOpened, { open: openModalMassaCategoria, close: closeModalMassaCategoria }] =
    useDisclosure(false)
  const [novaCategoriaEmMassa, setNovaCategoriaEmMassa] = useState('')
  const [salvandoMassa, setSalvandoMassa] = useState(false)

  const selectedProductIds = useMemo(() => {
    return Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number)
  }, [rowSelection])

  const handleAlterarCategoriaEmMassa = async () => {
    if (selectedProductIds.length === 0) return
    try {
      setSalvandoMassa(true)
      const api = await getApi()
      const res = await api.batch_update_products_category(
        selectedProductIds,
        novaCategoriaEmMassa.trim() || null,
      )
      notifications.show({
        title: 'Categorias Atualizadas',
        message: `${res.atualizados} produto(s) atualizados com sucesso.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      })
      closeModalMassaCategoria()
      setNovaCategoriaEmMassa('')
      setRowSelection({})
      await carregarProdutos()
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao atualizar',
        message: err?.message || 'Falha ao atualizar categorias em massa.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvandoMassa(false)
    }
  }

  const handleAtivarEmMassa = async () => {
    if (selectedProductIds.length === 0) return
    try {
      const api = await getApi()
      const res = await api.batch_toggle_products_active(selectedProductIds, true)
      notifications.show({
        title: 'Produtos Ativados',
        message: `${res.atualizados} produto(s) ativados com sucesso.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      })
      setRowSelection({})
      await carregarProdutos()
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.message || 'Falha ao ativar produtos.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    }
  }

  const handleInativarEmMassa = async () => {
    if (selectedProductIds.length === 0) return
    try {
      const api = await getApi()
      const res = await api.batch_toggle_products_active(selectedProductIds, false)
      notifications.show({
        title: 'Produtos Inativados',
        message: `${res.atualizados} produto(s) inativados.`,
        color: 'gray',
        icon: <IconPower size={16} />,
      })
      setRowSelection({})
      await carregarProdutos()
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.message || 'Falha ao inativar produtos.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    }
  }

  const handleExcluirEmMassa = () => {
    if (selectedProductIds.length === 0) return

    modals.openConfirmModal({
      title: (
        <Group gap="xs">
          <IconTrash size={18} color="var(--mantine-color-red-6)" />
          <Text fw={700}>Excluir {selectedProductIds.length} Produto(s)</Text>
        </Group>
      ),
      children: (
        <Text size="xs">
          Tem certeza que deseja excluir os <b>{selectedProductIds.length}</b> produto(s) selecionados?
          Produtos vinculados a cotações, necessidades ou alocações não serão excluídos para preservar o histórico.
        </Text>
      ),
      labels: { confirm: 'Excluir Selecionados', cancel: 'Cancelar' },
      confirmProps: { color: 'red', size: 'xs' },
      cancelProps: { size: 'xs' },
      onConfirm: async () => {
        try {
          const api = await getApi()
          const res = await api.batch_delete_products(selectedProductIds)
          notifications.show({
            title: 'Exclusão Concluída',
            message: res.mensagem,
            color: res.bloqueados > 0 ? 'yellow' : 'teal',
            icon: <IconCheck size={16} />,
          })
          setRowSelection({})
          await carregarProdutos()
        } catch (err: any) {
          notifications.show({
            title: 'Erro ao excluir',
            message: err?.message || 'Falha ao excluir produtos em massa.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        }
      },
    })
  }

  const nomeRef = useRef<HTMLInputElement>(null)
  const categoriaRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    initialValues: {
      nome: '',
      categoria: '',
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do produto é obrigatório' : null,
    },
  })

  const formEdicao = useForm({
    initialValues: {
      nome: '',
      categoria: '',
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do produto é obrigatório' : null,
    },
  })

  const categoriasSugeridas = useMemo(() => {
    const set = new Set<string>()
    produtos.forEach((p) => {
      if (p.categoria && p.categoria.trim()) {
        set.add(p.categoria.trim())
      }
    })
    return Array.from(set)
  }, [produtos])

  const carregarProdutos = async (silent = false) => {
    try {
      if (!silent && produtos.length === 0) setLoading(true)
      const api = await getApi()
      const data = await api.list_products(false)
      setProdutos(data)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      notifications.show({
        title: 'Erro ao carregar produtos',
        message: 'Não foi possível buscar a lista de produtos.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useDataCacheSubscription('products', () => {
    carregarProdutos(true)
  })

  useEffect(() => {
    carregarProdutos()
    setTimeout(() => nomeRef.current?.focus(), 150)
  }, [])

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setSubmitting(true)
      const api = await getApi()
      const novoProduto = await api.create_product(
        values.nome,
        values.categoria || null,
      )

      notifications.show({
        title: 'Produto Adicionado',
        message: `O produto "${novoProduto.nome}" foi cadastrado com sucesso.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      form.reset()
      await carregarProdutos()

      setTimeout(() => {
        nomeRef.current?.focus()
      }, 50)
    } catch (error: any) {
      console.error('Erro ao criar produto:', error)
      notifications.show({
        title: 'Erro ao salvar produto',
        message: error?.message || 'Verifique se o nome já existe.',
        color: 'red',
        icon: <IconX size={16} />,
      })
      nomeRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  const handleAbrirEdicao = (p: Produto) => {
    setProdutoEmEdicao(p)
    formEdicao.setValues({
      nome: p.nome,
      categoria: p.categoria || '',
    })
    openModalEditar()
  }

  const handleSalvarEdicao = async (values: typeof formEdicao.values) => {
    if (!produtoEmEdicao) return
    try {
      setSalvandoEdicao(true)
      const api = await getApi()
      await api.update_product(
        produtoEmEdicao.id,
        values.nome,
        values.categoria || null,
      )

      notifications.show({
        title: 'Produto Atualizado',
        message: `O produto "${values.nome}" foi atualizado com sucesso.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      closeModalEditar()
      setProdutoEmEdicao(null)
      await carregarProdutos()
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error)
      notifications.show({
        title: 'Erro ao atualizar produto',
        message: error?.message || 'Verifique se o nome informado já existe.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const handleToggleAtivo = async (p: Produto) => {
    const novoStatus = p.ativo === 0 ? true : false
    try {
      setTogglingId(p.id)
      const api = await getApi()
      await api.toggle_product_status(p.id, novoStatus)

      notifications.show({
        title: novoStatus ? 'Produto Ativado' : 'Produto Desativado',
        message: novoStatus
          ? `O produto "${p.nome}" está ativo e disponível para novas cotações.`
          : `O produto "${p.nome}" foi desativado (não aparecerá em novas cotações).`,
        color: novoStatus ? 'teal' : 'gray',
        icon: novoStatus ? <IconCheck size={16} /> : <IconPower size={16} />,
      })

      await carregarProdutos()
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao alterar status',
        message: error?.message || 'Não foi possível alterar o status do produto.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setTogglingId(null)
    }
  }

  const [modalImportarOpened, { open: openModalImportar, close: closeModalImportar }] =
    useDisclosure(false)
  const [arquivoExcel, setArquivoExcel] = useState<File | null>(null)
  const [importandoExcel, setImportandoExcel] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)

  const handleExportarExcel = async () => {
    try {
      setExportandoExcel(true)
      const api = await getApi()
      const res = await api.export_products_excel()

      if (res.cancelado) {
        return
      }

      if (res.salvo_em_disco) {
        notifications.show({
          title: 'Planilha Exportada com Sucesso',
          message: `Salva em: ${res.caminho}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        })
      } else if (res.conteudo_base64) {
        downloadBase64File(res.conteudo_base64, res.nome_arquivo || 'produtos.xlsx')
        notifications.show({
          title: 'Planilha Exportada com Sucesso',
          message: `${res.total || 0} produtos exportados para Excel com sucesso.`,
          color: 'green',
          icon: <IconCheck size={16} />,
        })
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao exportar',
        message: err?.message || 'Falha ao gerar planilha de produtos.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setExportandoExcel(false)
    }
  }

  const handleProcessarImportacaoExcel = async () => {
    if (!arquivoExcel) {
      notifications.show({
        title: 'Selecione o arquivo',
        message: 'Faça o upload do arquivo Excel (.xlsx) contendo os produtos.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    try {
      setImportandoExcel(true)
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const result = reader.result as string
          const base64Content = result.split(',')[1] || result
          const api = await getApi()
          const res = await api.import_products_excel(base64Content)

          notifications.show({
            title: 'Importação Concluída',
            message: `${res.importados} produtos cadastrados/atualizados via Excel!`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          })

          closeModalImportar()
          setArquivoExcel(null)
          await carregarProdutos()
        } catch (e: any) {
          notifications.show({
            title: 'Erro na importação',
            message: e?.message || 'Falha ao processar arquivo.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        } finally {
          setImportandoExcel(false)
        }
      }
      reader.readAsDataURL(arquivoExcel)
    } catch (e) {
      setImportandoExcel(false)
    }
  }

  const handleRemover = (id: number, nome: string) => {
    modals.openConfirmModal({
      title: 'Excluir Produto',
      centered: true,
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Deseja realmente excluir o produto <b>{nome}</b>?
          </Text>
          <Text size="xs" c="dimmed">
            Nota: Apenas produtos sem nenhum histórico vinculado (necessidades, cotações ou compras) podem ser excluídos permanentemente.
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Excluir Produto', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          setDeletingId(id)
          const api = await getApi()
          const res = await api.remove_product(id)

          notifications.show({
            title: 'Produto Excluído',
            message: res.mensagem || `O produto "${nome}" foi excluído com sucesso.`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          })

          await carregarProdutos()
        } catch (error: any) {
          console.error('Erro ao remover produto:', error)
          const msg = error?.message || 'Não foi possível excluir o produto.'
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
                    color="teal"
                    leftSection={<IconPower size={16} />}
                    onClick={async () => {
                      modals.closeAll()
                      const api = await getApi()
                      await api.toggle_product_status(id, false)
                      notifications.show({
                        title: 'Produto Desativado',
                        message: `O produto "${nome}" foi desativado com sucesso.`,
                        color: 'teal',
                        icon: <IconCheck size={16} />,
                      })
                      await carregarProdutos()
                    }}
                  >
                    Desativar Produto
                  </Button>
                  <Button variant="default" onClick={() => modals.closeAll()}>
                    Fechar
                  </Button>
                </Group>
              </Stack>
            ),
          })
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  const columns = useMemo<MRT_ColumnDef<Produto>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Produto',
        size: 260,
        Cell: ({ cell, row }) => (
          <Text fw={600} size="xs" c={row.original.ativo === 0 ? 'dimmed' : undefined} truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'categoria',
        header: 'Categoria',
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return (
            <Text size="xs" c={!val ? 'dimmed' : undefined} truncate="end">
              {val || '-'}
            </Text>
          )
        },
      },
      {
        accessorKey: 'ativo',
        header: 'Status',
        size: 100,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Badge
            color={row.original.ativo === 0 ? 'gray' : 'teal'}
            variant={row.original.ativo === 0 ? 'light' : 'filled'}
            size="xs"
          >
            {row.original.ativo === 0 ? 'Inativo' : 'Ativo'}
          </Badge>
        ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 110,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const isAtivo = row.original.ativo !== 0
          return (
            <Group gap={4} wrap="nowrap" justify="center">
              <Tooltip label={isAtivo ? 'Desativar produto' : 'Ativar produto'}>
                <ActionIcon
                  color={isAtivo ? 'teal' : 'gray'}
                  variant="subtle"
                  size="sm"
                  loading={togglingId === row.original.id}
                  onClick={() => handleToggleAtivo(row.original)}
                >
                  <IconPower size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Editar produto">
                <ActionIcon
                  color={themeColor}
                  variant="subtle"
                  size="sm"
                  onClick={() => handleAbrirEdicao(row.original)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Excluir produto">
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="sm"
                  loading={deletingId === row.original.id}
                  onClick={() => handleRemover(row.original.id, row.original.nome)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [deletingId, togglingId, themeColor],
  )

  const table = useMantineReactTable({
    ...getVirtualizedTableProps<Produto>({
      enableTopToolbar: true,
    }),
    columns,
    data: produtos,
    enableRowActions: false,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    renderTopToolbarCustomActions: () => {
      if (selectedProductIds.length === 0) return null
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
            <Group gap="xs" align="center" wrap="wrap">
              <Badge size="xs" variant="filled" color={themeColor}>
                {selectedProductIds.length} produto{selectedProductIds.length > 1 ? 's' : ''} selecionado{selectedProductIds.length > 1 ? 's' : ''}
              </Badge>
              <Button
                variant="light"
                color={themeColor}
                size="xs"
                leftSection={<IconTag size={14} />}
                onClick={openModalMassaCategoria}
              >
                Alterar Categoria
              </Button>
              <Button
                variant="light"
                color="teal"
                size="xs"
                leftSection={<IconPower size={14} />}
                onClick={handleAtivarEmMassa}
              >
                Ativar
              </Button>
              <Button
                variant="light"
                color="gray"
                size="xs"
                leftSection={<IconPower size={14} />}
                onClick={handleInativarEmMassa}
              >
                Inativar
              </Button>
              <Button
                variant="filled"
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                onClick={handleExcluirEmMassa}
              >
                Excluir Selecionados
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
        <PageHeader
          icon={IconPackage}
          iconColor={themeColor}
          title="Cadastro de Produtos"
        subtitle="Cadastre itens digitando e usando Enter"
        badge={{
          label: `${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'}`,
          color: themeColor,
        }}
        rightSection={
          <Group gap="xs">
            <Button
              variant="light"
              color={themeColor}
              size="xs"
              leftSection={<IconUpload size={14} />}
              loading={exportandoExcel}
              onClick={handleExportarExcel}
            >
              Exportar para Excel
            </Button>
            <Button
              variant="outline"
              color={themeColor}
              size="xs"
              leftSection={<IconDownload size={14} />}
              onClick={openModalImportar}
            >
              Importar do Excel
            </Button>
          </Group>
        }
      />
      </Box>

      {/* Formulário de Cadastro com Fluxo Rápido por Teclado */}
      <Box style={{ flexShrink: 0 }}>
        <SectionCard
          title="Novo Produto"
          subtitle="Preencha e tecle Enter para salvar"
          kbdHint="Enter"
        >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Group align="flex-end" gap="xs">
            <TextInput
              ref={nomeRef}
              label="Nome do Produto"
              size="xs"
              placeholder="Ex: Detergente Neutro 500ml"
              required
              style={{ flex: 2 }}
              {...form.getInputProps('nome')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (form.values.nome.trim()) {
                    categoriaRef.current?.focus()
                  }
                }
              }}
            />
            <AppAutocomplete
              ref={categoriaRef}
              label="Categoria"
              size="xs"
              placeholder="Ex: Limpeza, Descartáveis"
              data={categoriasSugeridas}
              style={{ flex: 1.5 }}
              {...form.getInputProps('categoria')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  form.onSubmit(handleSubmit)()
                }
              }}
            />
            <Button
              type="submit"
              variant="filled"
              color={themeColor}
              size="xs"
              leftSection={<IconPlus size={14} />}
              loading={submitting}
            >
              Adicionar <Kbd ml={4} size="xs">Enter</Kbd>
            </Button>
          </Group>
        </form>
      </SectionCard>
      </Box>

      {/* Mantine React Table */}
      <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading ? (
          <Center p="xl" style={{ flex: 1 }}>
            <Loader size="lg" />
          </Center>
        ) : (
          <MantineReactTable table={table} />
        )}
      </Box>

      {/* Modal de Edição de Produto */}
      <EditProductModal
        opened={modalEditarOpened}
        onClose={closeModalEditar}
        nome={formEdicao.values.nome}
        categoria={formEdicao.values.categoria}
        onChangeNome={(val) => formEdicao.setFieldValue('nome', val)}
        onChangeCategoria={(val) => formEdicao.setFieldValue('categoria', val)}
        onSave={() => formEdicao.onSubmit(handleSalvarEdicao)()}
        loading={salvandoEdicao}
        themeColor={themeColor}
        categoriasSugeridas={categoriasSugeridas}
      />

      {/* Modal de Importação Excel de Produtos */}
      <Modal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        title={
          <Group gap="xs">
            <IconFileSpreadsheet size={18} />
            <Text fw={700}>Importar Produtos via Planilha Excel (.xlsx)</Text>
          </Group>
        }
        centered
        radius="sm"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Faça upload de uma planilha contendo colunas: <b>Nome do Produto</b>, <b>Categoria</b> e <b>Unidade Padrão</b>.
          </Text>

          <FileInput
            label="Arquivo Excel (.xlsx)"
            size="xs"
            placeholder="Selecione o arquivo de produtos..."
            accept=".xlsx,.xls"
            value={arquivoExcel}
            onChange={setArquivoExcel}
            leftSection={<IconFileSpreadsheet size={14} />}
            clearable
            required
          />

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={closeModalImportar}>
              Cancelar
            </Button>
            <Button
              variant="filled"
              color={themeColor}
              size="xs"
              leftSection={<IconDownload size={14} />}
              loading={importandoExcel}
              onClick={handleProcessarImportacaoExcel}
            >
              Importar Produtos
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de Alteração de Categoria em Massa */}
      <BatchCategoryModal
        opened={modalMassaCategoriaOpened}
        onClose={closeModalMassaCategoria}
        selectedCount={selectedProductIds.length}
        categoriasSugeridas={categoriasSugeridas}
        novaCategoria={novaCategoriaEmMassa}
        onChangeCategoria={setNovaCategoriaEmMassa}
        onConfirm={handleAlterarCategoriaEmMassa}
        loading={salvandoMassa}
        themeColor={themeColor}
      />
    </Stack>
  )
}

export default ProdutosView

