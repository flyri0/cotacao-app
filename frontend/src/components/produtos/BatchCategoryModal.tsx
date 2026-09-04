import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from '@mantine/core'
import { IconTag } from '@tabler/icons-react'
import { AppAutocomplete } from '../common'

interface BatchCategoryModalProps {
  opened: boolean
  onClose: () => void
  selectedCount: number
  categoriasSugeridas: string[]
  novaCategoria: string
  onChangeCategoria: (cat: string) => void
  onConfirm: () => void
  loading?: boolean
  themeColor?: string
}

export function BatchCategoryModal({
  opened,
  onClose,
  selectedCount,
  categoriasSugeridas,
  novaCategoria,
  onChangeCategoria,
  onConfirm,
  loading = false,
  themeColor = 'blue',
}: BatchCategoryModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconTag size={18} />
          <Text fw={700}>
            Alterar Categoria em Massa ({selectedCount} produto{selectedCount > 1 ? 's' : ''})
          </Text>
        </Group>
      }
      centered
      radius="sm"
      size="md"
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Informe a nova categoria para todos os {selectedCount} produtos selecionados.
        </Text>

        <AppAutocomplete
          label="Nova Categoria"
          size="xs"
          placeholder="Selecione ou digite a nova categoria..."
          data={categoriasSugeridas}
          value={novaCategoria}
          onChange={onChangeCategoria}
        />

        <Group justify="flex-end" gap="xs" mt="md">
          <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="filled"
            color={themeColor}
            size="xs"
            loading={loading}
            onClick={onConfirm}
          >
            Aplicar a Todos
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default BatchCategoryModal
