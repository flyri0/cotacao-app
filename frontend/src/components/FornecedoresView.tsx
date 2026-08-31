import { useEffect, useState, useMemo } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  FileInput,
  Group,
  Loader,
  Modal,
  NumberInput,
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
  IconCheck,
  IconDownload,
  IconEdit,
  IconFileSpreadsheet,
  IconPlus,
  IconTrash,
  IconTruck,
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
import { getApi } from '../services/api'
import type { Fornecedor } from '../types'

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

function formatMoney(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0)
}

export function FornecedoresView() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [fornecedorEmEdicao, setFornecedorEmEdicao] = useState<Fornecedor | null>(null)
  const [modalEditarOpened, { open: openModalEditar, close: closeModalEditar }] =
    useDisclosure(false)

  const form = useForm({
    initialValues: {
      nome: '',
      contato: '',
      telefone: '',
      email: '',
      pedido_minimo: 0,
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do fornecedor é obrigatório' : null,
      pedido_minimo: (value) =>
        value < 0 ? 'O pedido mínimo não pode ser negativo' : null,
    },
  })

  const formEdicao = useForm({
    initialValues: {
      nome: '',
      contato: '',
      telefone: '',
      email: '',
      pedido_minimo: 0,
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do fornecedor é obrigatório' : null,
      pedido_minimo: (value) =>
        value < 0 ? 'O pedido mínimo não pode ser negativo' : null,
    },
  })

  const carregarFornecedores = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      const data = await api.listar_fornecedores()
      setFornecedores(data)
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error)
      notifications.show({
        title: 'Erro ao carregar fornecedores',
        message: 'Não foi possível buscar a lista de fornecedores.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarFornecedores()
  }, [])

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setSubmitting(true)
      const api = await getApi()
      const novoFornecedor = await api.criar_fornecedor(
        values.nome,
        values.contato || null,
        values.telefone || null,
        values.email || null,
        values.pedido_minimo || 0,
      )

      notifications.show({
        title: 'Fornecedor Adicionado',
        message: `O fornecedor "${novoFornecedor.nome}" foi cadastrado com sucesso.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      form.reset()
      await carregarFornecedores()
    } catch (error: any) {
      console.error('Erro ao criar fornecedor:', error)
      notifications.show({
        title: 'Erro ao salvar fornecedor',
        message: error?.message || 'Verifique os dados informados.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Abertura do modal de edição
  const handleAbrirEdicao = (f: Fornecedor) => {
    setFornecedorEmEdicao(f)
    formEdicao.setValues({
      nome: f.nome,
      contato: f.contato || '',
      telefone: f.telefone || '',
      email: f.email || '',
      pedido_minimo: f.pedido_minimo || 0,
    })
    openModalEditar()
  }

  // Salvar alterações de edição
  const handleSalvarEdicao = async (values: typeof formEdicao.values) => {
    if (!fornecedorEmEdicao) return
    try {
      setSalvandoEdicao(true)
      const api = await getApi()
      await api.atualizar_fornecedor(
        fornecedorEmEdicao.id,
        values.nome,
        values.contato || null,
        values.telefone || null,
        values.email || null,
        values.pedido_minimo || 0,
      )

      notifications.show({
        title: 'Fornecedor Atualizado',
        message: `O fornecedor "${values.nome}" foi atualizado com sucesso.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      closeModalEditar()
      setFornecedorEmEdicao(null)
      await carregarFornecedores()
    } catch (error: any) {
      console.error('Erro ao atualizar fornecedor:', error)
      notifications.show({
        title: 'Erro ao atualizar fornecedor',
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

  // Exportar Catálogo de Fornecedores para Excel
  const handleExportarExcel = async () => {
    try {
      setExportandoExcel(true)
      const api = await getApi()
      const res = await api.exportar_fornecedores_excel()

      if (res.cancelado) {
        return
      }

      if (res.salvo_em_disco) {
        notifications.show({
          title: 'Planilha Exportada com Sucesso',
          message: `Salva em: ${res.caminho}`,
          color: 'cyan',
          icon: <IconCheck size={16} />,
        })
      } else if (res.conteudo_base64) {
        downloadBase64File(res.conteudo_base64, res.nome_arquivo || 'fornecedores.xlsx')
        notifications.show({
          title: 'Planilha Exportada com Sucesso',
          message: `${res.total || 0} fornecedores exportados para Excel com sucesso.`,
          color: 'cyan',
          icon: <IconCheck size={16} />,
        })
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao exportar',
        message: err?.message || 'Falha ao gerar planilha de fornecedores.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setExportandoExcel(false)
    }
  }

  // Processar Importação de Fornecedores via Excel
  const handleProcessarImportacaoExcel = async () => {
    if (!arquivoExcel) {
      notifications.show({
        title: 'Selecione o arquivo',
        message: 'Faça o upload do arquivo Excel (.xlsx) contendo os fornecedores.',
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
          const res = await api.importar_fornecedores_excel(base64Content)

          notifications.show({
            title: 'Importação Concluída',
            message: `${res.importados} fornecedores cadastrados/atualizados via Excel!`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          })

          closeModalImportar()
          setArquivoExcel(null)
          await carregarFornecedores()
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
      title: 'Excluir Fornecedor',
      centered: true,
      children: (
        <Text size="sm">
          Deseja realmente remover o fornecedor <b>{nome}</b>? Todas as cotações e alocações
          vinculadas a este fornecedor também serão excluídas.
        </Text>
      ),
      labels: { confirm: 'Excluir Fornecedor', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          setDeletingId(id)
          const api = await getApi()
          await api.remover_fornecedor(id)

          notifications.show({
            title: 'Fornecedor Removido',
            message: `O fornecedor "${nome}" foi removido com sucesso.`,
            color: 'blue',
            icon: <IconCheck size={16} />,
          })

          await carregarFornecedores()
        } catch (error) {
          console.error('Erro ao remover fornecedor:', error)
          notifications.show({
            title: 'Erro ao remover fornecedor',
            message: 'Não foi possível excluir o fornecedor.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  const columns = useMemo<MRT_ColumnDef<Fornecedor>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Fornecedor / Razão Social',
        Cell: ({ cell }) => <Text fw={600}>{cell.getValue<string>()}</Text>,
      },
      {
        accessorKey: 'contato',
        header: 'Contato',
        size: 150,
        Cell: ({ cell }) => <Text size="sm">{cell.getValue<string | null>() || '-'}</Text>,
      },
      {
        accessorKey: 'telefone',
        header: 'Telefone / WhatsApp',
        size: 160,
        Cell: ({ cell }) => <Text size="sm">{cell.getValue<string | null>() || '-'}</Text>,
      },
      {
        accessorKey: 'email',
        header: 'E-mail',
        size: 200,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return val ? (
            <Text size="sm" c="blue">
              {val}
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          )
        },
      },
      {
        accessorKey: 'pedido_minimo',
        header: 'Pedido Mínimo',
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<number>()
          return (
            <Badge variant="light" color={val > 0 ? 'teal' : 'gray'} size="md">
              {formatMoney(val)}
            </Badge>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 110,
        Cell: ({ row }) => (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Editar fornecedor">
              <ActionIcon
                color="blue"
                variant="subtle"
                onClick={() => handleAbrirEdicao(row.original)}
              >
                <IconEdit size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Excluir fornecedor">
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
    data: fornecedores,
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
        icon={IconTruck}
        iconColor="cyan"
        title="Cadastro de Fornecedores"
        subtitle="Cadastro mestre de fornecedores participantes e seus respectivos pedidos mínimos"
        badge={{
          label: `${fornecedores.length} ${fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}`,
          color: 'cyan',
        }}
        rightSection={
          <Group gap="sm">
            <Button
              variant="light"
              color="cyan"
              leftSection={<IconDownload size={16} />}
              loading={exportandoExcel}
              onClick={handleExportarExcel}
            >
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              color="cyan"
              leftSection={<IconUpload size={16} />}
              onClick={openModalImportar}
            >
              Importar Excel
            </Button>
          </Group>
        }
      />

      {/* Formulário de Cadastro */}
      <SectionCard
        title="Novo Fornecedor"
        subtitle="Informe os dados de contato e o valor de faturamento mínimo para compra"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <TextInput
                label="Nome / Razão Social"
                placeholder="Ex: Distribuidora Alvorada"
                required
                {...form.getInputProps('nome')}
              />
              <TextInput
                label="Contato / Vendedor"
                placeholder="Ex: Carlos Oliveira"
                {...form.getInputProps('contato')}
              />
              <TextInput
                label="Telefone / WhatsApp"
                placeholder="Ex: (11) 98765-4321"
                {...form.getInputProps('telefone')}
              />
              <TextInput
                label="E-mail"
                placeholder="Ex: vendas@empresa.com.br"
                {...form.getInputProps('email')}
              />
              <NumberInput
                label="Pedido Mínimo (R$)"
                placeholder="0,00"
                min={0}
                decimalScale={2}
                fixedDecimalScale
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                {...form.getInputProps('pedido_minimo')}
              />
            </SimpleGrid>

            <Group justify="flex-end">
              <Button
                type="submit"
                leftSection={<IconPlus size={18} />}
                loading={submitting}
              >
                Adicionar Fornecedor
              </Button>
            </Group>
          </Stack>
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

      {/* Modal de Edição de Fornecedor */}
      <Modal
        opened={modalEditarOpened}
        onClose={closeModalEditar}
        title={
          <Group gap="xs">
            <IconEdit size={20} />
            <Text fw={700}>
              Editar Fornecedor: {fornecedorEmEdicao?.nome}
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
              label="Nome / Razão Social"
              placeholder="Ex: Distribuidora Alvorada"
              required
              {...formEdicao.getInputProps('nome')}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Contato / Vendedor"
                placeholder="Ex: Carlos Oliveira"
                {...formEdicao.getInputProps('contato')}
              />
              <TextInput
                label="Telefone / WhatsApp"
                placeholder="Ex: (11) 98765-4321"
                {...formEdicao.getInputProps('telefone')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="E-mail"
                placeholder="Ex: vendas@empresa.com.br"
                {...formEdicao.getInputProps('email')}
              />
              <NumberInput
                label="Pedido Mínimo (R$)"
                placeholder="0,00"
                min={0}
                decimalScale={2}
                fixedDecimalScale
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                {...formEdicao.getInputProps('pedido_minimo')}
              />
            </SimpleGrid>

            <Group justify="flex-end" mt="md">
              <Button variant="light" color="gray" onClick={closeModalEditar}>
                Cancelar
              </Button>
              <Button type="submit" color="cyan" loading={salvandoEdicao}>
                Salvar Alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de Importação Excel de Fornecedores */}
      <Modal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        title={
          <Group gap="xs">
            <IconFileSpreadsheet size={22} color="#06B6D4" />
            <Text fw={700}>Importar Fornecedores via Planilha Excel (.xlsx)</Text>
          </Group>
        }
        centered
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Faça upload de uma planilha com colunas: <b>Nome / Razão Social</b>, <b>Contato</b>, <b>Telefone</b>, <b>E-mail</b> e <b>Pedido Mínimo</b>.
          </Text>

          <FileInput
            label="Arquivo Excel (.xlsx)"
            placeholder="Selecione o arquivo de fornecedores..."
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
              color="cyan"
              leftSection={<IconUpload size={16} />}
              loading={importandoExcel}
              onClick={handleProcessarImportacaoExcel}
            >
              Importar Fornecedores
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default FornecedoresView

