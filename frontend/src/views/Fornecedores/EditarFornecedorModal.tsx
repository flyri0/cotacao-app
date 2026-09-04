import { useEffect } from 'react'
import { Button, Group, Modal, NumberInput, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconEdit } from '@tabler/icons-react'
import type { Fornecedor } from '../../types'

interface EditarFornecedorModalProps {
  opened: boolean
  onClose: () => void
  fornecedor: Fornecedor | null
  themeColor: string
  onSave: (values: {
    nome: string
    contato: string
    telefone: string
    email: string
    pedido_minimo: number
  }) => Promise<void>
  saving: boolean
}

export function EditarFornecedorModal({
  opened,
  onClose,
  fornecedor,
  themeColor,
  onSave,
  saving,
}: EditarFornecedorModalProps) {
  const formEdicao = useForm({
    initialValues: {
      nome: '',
      contato: '',
      telefone: '',
      email: '',
      pedido_minimo: 0,
    },
    validate: {
      nome: (value) => (value.trim().length === 0 ? 'O nome do fornecedor é obrigatório' : null),
      pedido_minimo: (value) => (value < 0 ? 'O pedido mínimo não pode ser negativo' : null),
    },
  })

  useEffect(() => {
    if (fornecedor && opened) {
      formEdicao.setValues({
        nome: fornecedor.nome,
        contato: fornecedor.contato || '',
        telefone: fornecedor.telefone || '',
        email: fornecedor.email || '',
        pedido_minimo: fornecedor.pedido_minimo || 0,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedor, opened])

  const handleSalvarEdicao = async (values: typeof formEdicao.values) => {
    await onSave(values)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconEdit size={18} />
          <Text fw={700}>Editar Fornecedor: {fornecedor?.nome}</Text>
        </Group>
      }
      centered
      radius="sm"
      size="lg"
    >
      <form onSubmit={formEdicao.onSubmit(handleSalvarEdicao)}>
        <Stack gap="sm">
          <TextInput
            label="Nome / Razão Social"
            size="xs"
            placeholder="Ex: Distribuidora Alvorada"
            required
            {...formEdicao.getInputProps('nome')}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <TextInput
              label="Contato / Vendedor"
              size="xs"
              placeholder="Ex: Carlos Oliveira"
              {...formEdicao.getInputProps('contato')}
            />
            <TextInput
              label="Telefone / WhatsApp"
              size="xs"
              placeholder="Ex: (11) 98765-4321"
              {...formEdicao.getInputProps('telefone')}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <TextInput
              label="E-mail"
              size="xs"
              placeholder="Ex: vendas@empresa.com.br"
              {...formEdicao.getInputProps('email')}
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
              {...formEdicao.getInputProps('pedido_minimo')}
            />
          </SimpleGrid>

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="filled" color={themeColor} size="xs" loading={saving}>
              Salvar Alterações
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
