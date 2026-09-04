import {
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { type UseFormReturnType } from '@mantine/form'
import { IconCheck, IconEdit } from '@tabler/icons-react'
import { AppAutocomplete } from '../common'
import { SUGESTOES_EMBALAGEM, SUGESTOES_UNIDADES } from '../../constants'
import { formatMoney } from '../../utils'

export interface EditQuoteFormValues {
  fornecedorNome: string
  produtoNome: string
  produtoCategoria: string
  marca: string
  embalagem: string
  qtd_por_embalagem: number
  unidade: string
  preco_embalagem: number
}

interface EditQuoteModalProps {
  opened: boolean
  onClose: () => void
  form: UseFormReturnType<EditQuoteFormValues>
  nomesFornecedores: string[]
  nomesTodosProdutos: string[]
  onSave: (values: EditQuoteFormValues) => void
  loading?: boolean
  themeColor?: string
}

export function EditQuoteModal({
  opened,
  onClose,
  form,
  nomesFornecedores,
  nomesTodosProdutos,
  onSave,
  loading = false,
  themeColor = 'blue',
}: EditQuoteModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconEdit size={18} />
          <Text fw={700}>Editar Cotação</Text>
        </Group>
      }
      centered
      radius="sm"
      size="lg"
    >
      <form onSubmit={form.onSubmit(onSave)}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <AppAutocomplete
              label="Fornecedor"
              size="xs"
              placeholder="Selecione o fornecedor..."
              data={nomesFornecedores}
              required
              limit={8}
              {...form.getInputProps('fornecedorNome')}
            />

            <AppAutocomplete
              label="Produto"
              size="xs"
              placeholder="Digite ou selecione o produto..."
              data={nomesTodosProdutos}
              required
              limit={10}
              {...form.getInputProps('produtoNome')}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <TextInput
              label="Categoria do Produto (Opcional)"
              size="xs"
              placeholder="Ex: Alimentos, Limpeza, Embalagens..."
              {...form.getInputProps('produtoCategoria')}
            />

            <TextInput
              label="Marca (Opcional)"
              size="xs"
              placeholder="Ex: Ypê, Bombril, 3M..."
              {...form.getInputProps('marca')}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="xs">
            <AppAutocomplete
              label="Embalagem"
              size="xs"
              placeholder="Ex: Caixa c/ 24 un"
              data={SUGESTOES_EMBALAGEM}
              required
              {...form.getInputProps('embalagem')}
            />

            <NumberInput
              label="Qtd na Embalagem"
              size="xs"
              placeholder="Ex: 24"
              min={0.001}
              decimalScale={3}
              required
              {...form.getInputProps('qtd_por_embalagem')}
            />

            <AppAutocomplete
              label="Unidade Medida"
              size="xs"
              placeholder="Ex: UN, KG, L"
              data={SUGESTOES_UNIDADES}
              required
              {...form.getInputProps('unidade')}
            />

            <NumberInput
              label="Preço Embalagem (R$)"
              size="xs"
              placeholder="0,00"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator="."
              decimalSeparator=","
              prefix="R$ "
              required
              {...form.getInputProps('preco_embalagem')}
            />
          </SimpleGrid>

          {form.values.qtd_por_embalagem > 0 && (
            <Paper p="xs" radius="sm" withBorder bg="var(--mantine-color-gray-light)">
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">Preço Unitário Calculado:</Text>
                <Text fw={700} size="sm" c="teal">
                  {formatMoney(
                    (form.values.preco_embalagem || 0) /
                      (form.values.qtd_por_embalagem || 1),
                  )}{' '}
                  /{' '}
                  {form.values.unidade || 'UN'}
                </Text>
              </Group>
            </Paper>
          )}

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="filled"
              color={themeColor}
              size="xs"
              type="submit"
              leftSection={<IconCheck size={14} />}
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

export default EditQuoteModal
