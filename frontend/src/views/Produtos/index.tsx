import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
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
  IconPackage,
  IconPower,
  IconTag,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { PageHeader } from '../../components/ui/PageHeader'
import { getApi } from '../../services/api'
import type { Produto } from '../../types'

import { useProdutosColumns } from './useProdutosColumns'
import { ProdutosForm } from './ProdutosForm'
import { ProdutosModals } from './ProdutosModals'

function downloadBase64File(
  base64Data: string,
  fileName: string,
  mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
) {
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function Produtos({ themeColor = 'blue' }: { themeColor?: string }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Produto | null>(null)
  const [modalEditarOpened, { open: openModalEditar, close: closeModalEditar }] = useDisclosure(false)

  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [modalMassaCategoriaOpened, { open: openModalMassaCategoria, close: closeModalMassaCategoria }] = useDisclosure(false)
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
    initialValues: { nome: '', categoria: '' },
    validate: {
      nome: (value) => (value.trim().length === 0 ? 'O nome do produto é obrigatório' : null),
    },
  })

  const formEdicao = useForm({
    initialValues: { nome: '', categoria: '' },
    validate: {
      nome: (value) => (value.trim().length === 0 ? 'O nome do produto é obrigatório' : null),
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

  const carregarProdutos = async () => {
    try {
      setLoading(true)
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
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarProdutos()
    setTimeout(() => nomeRef.current?.focus(), 150)
  }, [])

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setSubmitting(true)
      const api = await getApi()
      const novoProduto = await api.create_product(values.nome, values.categoria || null)

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
    formEdicao.setValues({ nome: p.nome, categoria: p.categoria || '' })
    openModalEditar()
  }

  const handleSalvarEdicao = async (values: typeof formEdicao.values) => {
    if (!produtoEmEdicao) return
    try {
      setSalvandoEdicao(true)
      const api = await getApi()
      await api.update_product(produtoEmEdicao.id, values.nome, values.categoria || null)

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
      await api.alternar_status_produto(p.id, novoStatus)

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

  const [modalImportarOpened, { open: openModalImportar, close: closeModalImportar }] = useDisclosure(false)
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
                      await api.alternar_status_produto(id, false)
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

  const columns = useProdutosColumns({
    themeColor,
    togglingId,
    deletingId,
    handleToggleAtivo,
    handleAbrirEdicao,
    handleRemover,
  })

  const table = useMantineReactTable({
    enableDensityToggle: false,
    columns,
    data: produtos,
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
              <Badge size="sm" variant="filled" color={themeColor}>
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

      <ProdutosForm
        form={form}
        handleSubmit={handleSubmit}
        submitting={submitting}
        themeColor={themeColor}
        categoriasSugeridas={categoriasSugeridas}
        nomeRef={nomeRef}
        categoriaRef={categoriaRef}
      />

      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <MantineReactTable table={table} />
      )}

      <ProdutosModals
        themeColor={themeColor}
        modalEditarOpened={modalEditarOpened}
        closeModalEditar={closeModalEditar}
        produtoEmEdicao={produtoEmEdicao}
        formEdicao={formEdicao}
        handleSalvarEdicao={handleSalvarEdicao}
        salvandoEdicao={salvandoEdicao}
        categoriasSugeridas={categoriasSugeridas}
        modalImportarOpened={modalImportarOpened}
        closeModalImportar={closeModalImportar}
        arquivoExcel={arquivoExcel}
        setArquivoExcel={setArquivoExcel}
        importandoExcel={importandoExcel}
        handleProcessarImportacaoExcel={handleProcessarImportacaoExcel}
        modalMassaCategoriaOpened={modalMassaCategoriaOpened}
        closeModalMassaCategoria={closeModalMassaCategoria}
        selectedProductIds={selectedProductIds}
        novaCategoriaEmMassa={novaCategoriaEmMassa}
        setNovaCategoriaEmMassa={setNovaCategoriaEmMassa}
        salvandoMassa={salvandoMassa}
        handleAlterarCategoriaEmMassa={handleAlterarCategoriaEmMassa}
      />
    </Stack>
  )
}

export default Produtos
