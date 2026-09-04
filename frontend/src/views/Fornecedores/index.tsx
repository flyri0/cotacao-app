import { useEffect, useState } from 'react'
import {
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconPower,
  IconTruck,
  IconX,
} from '@tabler/icons-react'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { PageHeader } from '../../components/ui/PageHeader'
import { getApi } from '../../services/api'
import type { Fornecedor } from '../../types'
import { FornecedorForm } from './FornecedorForm'
import { useFornecedoresColumns } from './useFornecedoresColumns'
import { EditarFornecedorModal } from './EditarFornecedorModal'
import { ImportarFornecedoresModal } from './ImportarFornecedoresModal'

export function FornecedoresView({ themeColor = 'blue' }: { themeColor?: string }) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  
  const [fornecedorEmEdicao, setFornecedorEmEdicao] = useState<Fornecedor | null>(null)
  const [modalEditarOpened, { open: openModalEditar, close: closeModalEditar }] = useDisclosure(false)

  const [modalImportarOpened, { open: openModalImportar, close: closeModalImportar }] = useDisclosure(false)
  const [arquivoExcel, setArquivoExcel] = useState<File | null>(null)
  const [importandoExcel, setImportandoExcel] = useState(false)

  const carregarFornecedores = async () => {
    try {
      setLoading(true)
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
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarFornecedores()
  }, [])

  const handleSubmit = async (values: {
    nome: string
    contato: string
    telefone: string
    email: string
    pedido_minimo: number
  }) => {
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

  const handleAbrirEdicao = (f: Fornecedor) => {
    setFornecedorEmEdicao(f)
    openModalEditar()
  }

  const handleSalvarEdicao = async (values: {
    nome: string
    contato: string
    telefone: string
    email: string
    pedido_minimo: number
  }) => {
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
      await api.alternar_status_fornecedor(f.id, novoStatus)

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
                      await api.alternar_status_fornecedor(id, false)
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

  const columns = useFornecedoresColumns({
    themeColor,
    togglingId,
    deletingId,
    onToggleAtivo: handleToggleAtivo,
    onAbrirEdicao: handleAbrirEdicao,
    onRemover: handleRemover,
  })

  const table = useMantineReactTable({
    enableDensityToggle: false,
    columns,
    data: fornecedores,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    initialState: { density: 'xs', pagination: { pageSize: 15, pageIndex: 0 } },
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

      <FornecedorForm
        themeColor={themeColor}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <MantineReactTable table={table} />
      )}

      <EditarFornecedorModal
        opened={modalEditarOpened}
        onClose={closeModalEditar}
        fornecedor={fornecedorEmEdicao}
        themeColor={themeColor}
        onSave={handleSalvarEdicao}
        saving={salvandoEdicao}
      />

      <ImportarFornecedoresModal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        themeColor={themeColor}
        arquivoExcel={arquivoExcel}
        setArquivoExcel={setArquivoExcel}
        importandoExcel={importandoExcel}
        onProcessarImportacao={handleProcessarImportacaoExcel}
      />
    </Stack>
  )
}

export default FornecedoresView
