import { useEffect, useState, useMemo } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
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
  IconPower,
  IconTrash,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import { PageHeader, SectionCard } from './common'
import { EditSupplierModal } from './fornecedores'
import { formatMoney, getVirtualizedTableProps } from '../utils'
import { useDataCacheSubscription } from '../hooks'
import { getApi } from '../services/api'
import type { Fornecedor } from '../types'

export function FornecedoresView({ themeColor = 'blue' }: { themeColor?: string }) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
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

  const carregarFornecedores = async (silent = false) => {
    try {
      if (!silent && fornecedores.length === 0) setLoading(true)
      const api = await getApi()
      const data = await api.list_suppliers(false)
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
      if (!silent) setLoading(false)
    }
  }

  useDataCacheSubscription('suppliers', () => {
    carregarFornecedores(true)
  })

  useEffect(() => {
    carregarFornecedores()
  }, [])

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setSubmitting(true)
      const api = await getApi()
      const novoFornecedor = await api.create_supplier(
        values.nome,
        values.contato || null,
        values.telefone || null,
        values.email || null,
        values.pedido_minimo || 0,
      )

      notifications.show({
        title: 'Fornecedor Cadastrado',
        message: `O fornecedor "${novoFornecedor.nome}" foi cadastrado com sucesso.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      form.reset()
      await carregarFornecedores()
    } catch (error: any) {
      console.error('Erro ao criar fornecedor:', error)
      notifications.show({
        title: 'Erro ao cadastrar fornecedor',
        message: error?.message || 'Verifique se a razão social já existe.',
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
      await api.update_supplier(
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

  const handleToggleAtivo = async (f: Fornecedor) => {
    const novoStatus = f.ativo === 0 ? true : false
    try {
      setTogglingId(f.id)
      const api = await getApi()
      await api.toggle_supplier_status(f.id, novoStatus)

      notifications.show({
        title: novoStatus ? 'Fornecedor Ativado' : 'Fornecedor Desativado',
        message: novoStatus
          ? `O fornecedor "${f.nome}" está ativo e disponível para novas cotações.`
          : `O fornecedor "${f.nome}" foi desativado (não aparecerá em novas cotações).`,
        color: novoStatus ? 'teal' : 'gray',
        icon: novoStatus ? <IconCheck size={16} /> : <IconPower size={16} />,
      })

      await carregarFornecedores()
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao alterar status',
        message: error?.message || 'Não foi possível alterar o status do fornecedor.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setTogglingId(null)
    }
  }

  // Estado para Modal de Importação Excel
  const [modalImportarOpened, { open: openModalImportar, close: closeModalImportar }] =
    useDisclosure(false)
  const [arquivoExcel, setArquivoExcel] = useState<File | null>(null)
  const [importandoExcel, setImportandoExcel] = useState(false)

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
          const res = await api.import_suppliers_excel(base64Content)

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
        <Stack gap="xs">
          <Text size="sm">
            Deseja realmente excluir o fornecedor <b>{nome}</b>?
          </Text>
          <Text size="xs" c="dimmed">
            Nota: Apenas fornecedores sem nenhum histórico vinculado (cotações ou compras) podem ser excluídos permanentemente.
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Excluir Fornecedor', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          setDeletingId(id)
          const api = await getApi()
          const res = await api.remove_supplier(id)

          notifications.show({
            title: 'Fornecedor Removido',
            message: res.mensagem || `O fornecedor "${nome}" foi removido com sucesso.`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          })

          await carregarFornecedores()
        } catch (error: any) {
          console.error('Erro ao remover fornecedor:', error)
          const msg = error?.message || 'Não foi possível excluir o fornecedor.'
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
                      await api.toggle_supplier_status(id, false)
                      notifications.show({
                        title: 'Fornecedor Desativado',
                        message: `O fornecedor "${nome}" foi desativado com sucesso.`,
                        color: 'teal',
                        icon: <IconCheck size={16} />,
                      })
                      await carregarFornecedores()
                    }}
                  >
                    Desativar Fornecedor
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

  const columns = useMemo<MRT_ColumnDef<Fornecedor>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Fornecedor',
        size: 220,
        Cell: ({ cell, row }) => (
          <Text fw={600} size="xs" c={row.original.ativo === 0 ? 'dimmed' : undefined} truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'contato',
        header: 'Contato',
        size: 140,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end" c={!cell.getValue() ? 'dimmed' : undefined}>
            {cell.getValue<string | null>() || '-'}
          </Text>
        ),
      },
      {
        accessorKey: 'telefone',
        header: 'Telefone / WhatsApp',
        size: 180,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end" c={!cell.getValue() ? 'dimmed' : undefined}>
            {cell.getValue<string | null>() || '-'}
          </Text>
        ),
      },
      {
        accessorKey: 'email',
        header: 'E-mail',
        size: 180,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return (
            <Text size="xs" truncate="end" c={val ? 'blue' : 'dimmed'}>
              {val || '-'}
            </Text>
          )
        },
      },
      {
        accessorKey: 'pedido_minimo',
        header: 'Pedido Mínimo',
        size: 150,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => {
          const val = cell.getValue<number>()
          return (
            <Text size="xs" fw={val > 0 ? 600 : 400} c={val > 0 ? undefined : 'dimmed'}>
              {formatMoney(val)}
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
              <Tooltip label={isAtivo ? 'Desativar fornecedor' : 'Ativar fornecedor'}>
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

              <Tooltip label="Editar fornecedor">
                <ActionIcon
                  color={themeColor}
                  variant="subtle"
                  size="sm"
                  onClick={() => handleAbrirEdicao(row.original)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Excluir fornecedor">
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
    ...getVirtualizedTableProps<Fornecedor>({
      enableTopToolbar: true,
      enableRowVirtualization: true,
    }),
    columns,
    data: fornecedores,
    getRowId: (row) => String(row.id),
    enableRowActions: false,
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
          icon={IconTruck}
          iconColor={themeColor}
          title="Cadastro de Fornecedores"
        subtitle="Cadastro mestre e pedidos mínimos"
        badge={{
          label: `${fornecedores.length} ${fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}`,
          color: themeColor,
        }}
        rightSection={
          <Group gap="xs">
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

      {/* Formulário de Cadastro */}
      <Box style={{ flexShrink: 0 }}>
        <SectionCard
          title="Novo Fornecedor"
          subtitle="Informe dados de contato e pedido mínimo"
        >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="xs">
              <TextInput
                label="Nome / Razão Social"
                size="xs"
                placeholder="Ex: Distribuidora Alvorada"
                required
                {...form.getInputProps('nome')}
              />
              <TextInput
                label="Contato / Vendedor"
                size="xs"
                placeholder="Ex: Carlos Oliveira"
                {...form.getInputProps('contato')}
              />
              <TextInput
                label="Telefone / WhatsApp"
                size="xs"
                placeholder="Ex: (11) 98765-4321"
                {...form.getInputProps('telefone')}
              />
              <TextInput
                label="E-mail"
                size="xs"
                placeholder="Ex: vendas@empresa.com.br"
                {...form.getInputProps('email')}
              />
              <NumberInput
                label="Pedido Mínimo (R$)"
                size="xs"
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
                variant="filled"
                color={themeColor}
                size="xs"
                leftSection={<IconPlus size={14} />}
                loading={submitting}
              >
                Adicionar Fornecedor
              </Button>
            </Group>
          </Stack>
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

      {/* Modal de Edição de Fornecedor */}
      <EditSupplierModal
        opened={modalEditarOpened}
        onClose={closeModalEditar}
        form={formEdicao}
        onSave={handleSalvarEdicao}
        loading={salvandoEdicao}
        themeColor={themeColor}
      />

      {/* Modal de Importação Excel de Fornecedores */}
      <Modal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        title={
          <Group gap="xs">
            <IconFileSpreadsheet size={18} />
            <Text fw={700}>Importar Fornecedores via Planilha Excel (.xlsx)</Text>
          </Group>
        }
        centered
        radius="sm"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Faça upload de uma planilha com colunas: <b>Nome / Razão Social</b>, <b>Contato</b>, <b>Telefone</b>, <b>E-mail</b> e <b>Pedido Mínimo</b>.
          </Text>

          <FileInput
            label="Arquivo Excel (.xlsx)"
            size="xs"
            placeholder="Selecione o arquivo de fornecedores..."
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
              Importar Fornecedores
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default FornecedoresView

