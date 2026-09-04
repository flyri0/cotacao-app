import { Button, Group, NumberInput, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { SectionCard } from '../../components/ui/SectionCard'
import { useForm } from '@mantine/form'

interface FornecedorFormProps {
  themeColor: string
  onSubmit: (values: {
    nome: string
    contato: string
    telefone: string
    email: string
    pedido_minimo: number
  }) => Promise<void>
  submitting: boolean
}

export function FornecedorForm({ themeColor, onSubmit, submitting }: FornecedorFormProps) {
  const form = useForm({
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

  const handleSubmit = async (values: typeof form.values) => {
    await onSubmit(values)
    form.reset()
  }

  return (
    <SectionCard title="Novo Fornecedor" subtitle="Informe dados de contato e pedido mínimo">
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
  )
}
