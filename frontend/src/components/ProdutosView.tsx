import { useEffect, useState, useMemo, useRef } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  FileInput,
  Group,
  Kbd,
  Loader,
  Modal,
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
  IconDownload,
  IconEdit,
  IconFileSpreadsheet,
  IconPackage,
  IconPlus,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../locales/mrtPtBr'
import { PageHeader } from './common/PageHeader'
import { SectionCard } from './common/SectionCard'
import { AppAutocomplete } from './common/AppSelect'
import { getApi } from '../services/api'
import type { Produto } from '../types'

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
  URL.revokeObjectURL(url)
}

const SUGESTOES_UNIDADES = [
  'UN',
  'PCT',
  'CX',
  'FARDO',
  'KG',
  'L',
  'FRASCO',
  'GALAO',
  'ROLO',
  'PAR',
  'LATA',
  'M',
]

export function ProdutosView() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Produto | null>(null)
  const [modalEditarOpened, { open: openModalEditar, close: closeModalEditar }] =
    useDisclosure(false)

  const nomeRef = useRef<HTMLInputElement>(null)
  const categoriaRef = useRef<HTMLInputElement>(null)
  const unidadeRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    initialValues: {
      nome: '',
      categoria: '',
      unidade_padrao: 'UN',
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do produto é obrigatório' : null,
      unidade_padrao: (value) =>
        value.trim().length === 0 ? 'Informe a unidade de medida padrão' : null,
    },
  })

  const formEdicao = useForm({
    initialValues: {
      nome: '',
      categoria: '',
      unidade_padrao: 'UN',
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do produto é obrigatório' : null,
      unidade_padrao: (value) =>
        value.trim().length === 0 ? 'Informe a unidade de medida padrão' : null,
    },
  })

  // Lista dinâmica de categorias cadastradas para sugestão
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
      const data = await api.listar_produtos()
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
    // Foca no primeiro campo ao carregar
    setTimeout(() => nomeRef.current?.focus(), 150)
  }, [])

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setSubmitting(true)
      const api = await getApi()
      const novoProduto = await api.criar_produto(
        values.nome,
        values.categoria || null,
        values.unidade_padrao,
      )

      notifications.show({
        title: 'Produto Adicionado',
        message: `O produto "${novoProduto.nome}" foi cadastrado com sucesso.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      form.reset()
      form.setFieldValue('unidade_padrao', 'UN')
      await carregarProdutos()

      // Refoca no campo de nome para inclusão contínua imediata
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

  // Abertura do modal de edição
  const handleAbrirEdicao = (p: Produto) => {
    setProdutoEmEdicao(p)
    formEdicao.setValues({
      nome: p.nome,
      categoria: p.categoria || '',
      unidade_padrao: p.unidade_padrao || 'UN',
    })
    openModalEditar()
  }

  // Salvar alterações de edição
  const handleSalvarEdicao = async (values: typeof formEdicao.values) => {
    if (!produtoEmEdicao) return
    try {
      setSalvandoEdicao(true)
      const api = await getApi()
      await api.atualizar_produto(
        produtoEmEdicao.id,
        values.nome,
        values.categoria || null,
        values.unidade_padrao,
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

  // Estado para Modal de Importação Excel
  const [modalImportarOpened, { open: openModalImportar, close: closeModalImportar }] =
    useDisclosure(false)
  const [arquivoExcel, setArquivoExcel] = useState<File | null>(null)
  const [importandoExcel, setImportandoExcel] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)

  // Exportar Catálogo para Excel
  const handleExportarExcel = async () => {
    try {
      setExportandoExcel(true)
      const api = await getApi()
      const res = await api.exportar_produtos_excel()

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

  // Processar Importação de Produtos via Excel
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
          const res = await api.importar_produtos_excel(base64Content)

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
        <Text size="sm">
          Deseja realmente remover o produto <b>{nome}</b>? Todas as cotações e necessidades
          vinculadas a este produto também serão removidas.
        </Text>
      ),
      labels: { confirm: 'Excluir Produto', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          setDeletingId(id)
          const api = await getApi()
          await api.remover_produto(id)

          notifications.show({
            title: 'Produto Removido',
            message: `O produto "${nome}" foi removido com sucesso.`,
            color: 'blue',
            icon: <IconCheck size={16} />,
          })

          await carregarProdutos()
        } catch (error) {
          console.error('Erro ao remover produto:', error)
          notifications.show({
            title: 'Erro ao remover produto',
            message: 'Não foi possível excluir o produto.',
            color: 'red',
            icon: <IconX size={16} />,
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
        header: 'Nome do Produto',
        Cell: ({ cell }) => <Text fw={600}>{cell.getValue<string>()}</Text>,
      },
      {
        accessorKey: 'categoria',
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
        accessorKey: 'unidade_padrao',
        header: 'Unidade Padrão',
        size: 150,
        Cell: ({ cell }) => (
          <Badge variant="light" color="indigo">
            {cell.getValue<string>()}
          </Badge>
        ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 110,
        Cell: ({ row }) => (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Editar produto">
              <ActionIcon
                color="blue"
                variant="subtle"
                onClick={() => handleAbrirEdicao(row.original)}
              >
                <IconEdit size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Excluir produto">
              <ActionIcon
                color="red"
                variant="subtle"
                loading={deletingId === row.original.id}
                onClick={() => handleRemover(row.original.id, row.original.nome)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [deletingId],
  )

  const table = useMantineReactTable({
    columns,
    data: produtos,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: true,
    },
    mantinePaperProps: {
      withBorder: true,
      radius: 'md',
      shadow: 'none',
    },
  })

  return (
    <Stack gap="md" style={{ width: '100%' }}>
      <PageHeader
        icon={IconPackage}
        iconColor="blue"
        title="Cadastro de Produtos"
        subtitle="Cadastre rapidamente itens digitando e usando Enter para avançar entre os campos"
        badge={{
          label: `${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'}`,
          color: 'blue',
        }}
        rightSection={
          <Group gap="sm">
            <Button
              variant="light"
              color="blue"
              leftSection={<IconDownload size={16} />}
              loading={exportandoExcel}
              onClick={handleExportarExcel}
            >
              Exportar para Excel
            </Button>
            <Button
              variant="outline"
              color="blue"
              leftSection={<IconUpload size={16} />}
              onClick={openModalImportar}
            >
              Importar Planilha
            </Button>
          </Group>
        }
      />

      {/* Formulário de Cadastro com Fluxo Rápido por Teclado */}
      <SectionCard
        title="Novo Produto"
        subtitle="Preencha os dados e tecle Enter para salvar imediatamente"
        kbdHint="Enter"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Group align="flex-start" gap="md">
            <TextInput
              ref={nomeRef}
              label="Nome do Produto"
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
              label="Categoria (Autocomplete)"
              placeholder="Ex: Limpeza, Descartáveis"
              data={categoriasSugeridas}
              style={{ flex: 1.5 }}
              {...form.getInputProps('categoria')}
              onTabOrEnterNextRef={unidadeRef}
            />
            <AppAutocomplete
              ref={unidadeRef}
              label="Unidade Padrão"
              placeholder="Ex: UN, PCT, GALAO"
              data={SUGESTOES_UNIDADES}
              required
              style={{ width: 180 }}
              {...form.getInputProps('unidade_padrao')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  form.onSubmit(handleSubmit)()
                }
              }}
            />
            <Button
              type="submit"
              leftSection={<IconPlus size={18} />}
              loading={submitting}
              mt={25}
            >
              Adicionar <Kbd ml={6} size="xs">Enter</Kbd>
            </Button>
          </Group>
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

      {/* Modal de Edição de Produto */}
      <Modal
        opened={modalEditarOpened}
        onClose={closeModalEditar}
        title={
          <Group gap="xs">
            <IconEdit size={20} />
            <Text fw={700}>
              Editar Produto: {produtoEmEdicao?.nome}
            </Text>
          </Group>
        }
        centered
        radius="md"
        size="lg"
      >
        <form onSubmit={formEdicao.onSubmit(handleSalvarEdicao)}>
          <Stack gap="md">
            <TextInput
              label="Nome do Produto"
              placeholder="Ex: Detergente Neutro 500ml"
              required
              {...formEdicao.getInputProps('nome')}
            />

            <AppAutocomplete
              label="Categoria"
              placeholder="Ex: Limpeza, Descartáveis"
              data={categoriasSugeridas}
              {...formEdicao.getInputProps('categoria')}
            />

            <AppAutocomplete
              label="Unidade de Medida Padrão"
              placeholder="Ex: UN, PCT, GALAO"
              data={SUGESTOES_UNIDADES}
              required
              {...formEdicao.getInputProps('unidade_padrao')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" color="gray" onClick={closeModalEditar}>
                Cancelar
              </Button>
              <Button type="submit" color="blue" loading={salvandoEdicao}>
                Salvar Alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de Importação Excel de Produtos */}
      <Modal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        title={
          <Group gap="xs">
            <IconFileSpreadsheet size={22} color="#3B82F6" />
            <Text fw={700}>Importar Produtos via Planilha Excel (.xlsx)</Text>
          </Group>
        }
        centered
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Faça upload de uma planilha contendo colunas: <b>Nome do Produto</b>, <b>Categoria</b> e <b>Unidade Padrão</b>.
          </Text>

          <FileInput
            label="Arquivo Excel (.xlsx)"
            placeholder="Selecione o arquivo de produtos..."
            accept=".xlsx,.xls"
            value={arquivoExcel}
            onChange={setArquivoExcel}
            leftSection={<IconFileSpreadsheet size={18} />}
            clearable
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={closeModalImportar}>
              Cancelar
            </Button>
            <Button
              color="blue"
              leftSection={<IconUpload size={16} />}
              loading={importandoExcel}
              onClick={handleProcessarImportacaoExcel}
            >
              Importar Produtos
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default ProdutosView

