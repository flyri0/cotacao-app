import {
  Button,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { type UseFormReturnType } from '@mantine/form'
import { IconEdit } from '@tabler/icons-react'

export interface FornecedorFormValues {
  nome: string
  contato: string
  telefone: string
  email: string
  pedido_minimo: number
}

interface EditSupplierModalProps {
  opened: boolean
  onClose: () => void
  form: UseFormReturnType<FornecedorFormValues>
  onSave: (values: FornecedorFormValues) => void
  loading?: boolean
  themeColor?: string
}

export function EditSupplierModal({
  opened,
  onClose,
  form,
  onSave,
  loading = false,
  themeColor = 'blue',
}: EditSupplierModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconEdit size={18} />
          <Text fw={700}>Editar Fornecedor</Text>
        </Group>
      }
      centered
      radius="sm"
      size="lg"
    >
      <form onSubmit={form.onSubmit(onSave)}>
        <Stack gap="sm">
          <TextInput
            label="Nome / Razão Social"
            size="xs"
            placeholder="Ex: Distribuidora Alvorada"
            required
            {...form.getInputProps('nome')}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
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
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
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

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="filled"
              color={themeColor}
              size="xs"
              loading={loading}
            >
              Salvar Alterações
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

export default EditSupplierModal
