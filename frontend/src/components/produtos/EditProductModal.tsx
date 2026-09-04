import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconCheck, IconEdit } from '@tabler/icons-react'
import { AppAutocomplete } from '../common'

interface EditProductModalProps {
  opened: boolean
  onClose: () => void
  nome: string
  categoria: string
  onChangeNome: (nome: string) => void
  onChangeCategoria: (cat: string) => void
  onSave: (e?: React.FormEvent) => void
  loading?: boolean
  themeColor?: string
  categoriasSugeridas?: string[]
}

export function EditProductModal({
  opened,
  onClose,
  nome,
  categoria,
  onChangeNome,
  onChangeCategoria,
  onSave,
  loading = false,
  themeColor = 'blue',
  categoriasSugeridas = [],
}: EditProductModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(e)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconEdit size={18} />
          <Text fw={700}>Editar Cadastro do Produto</Text>
        </Group>
      }
      centered
      radius="sm"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Nome do Produto"
            size="xs"
            placeholder="Nome do produto..."
            required
            value={nome}
            onChange={(e) => onChangeNome(e.currentTarget.value)}
          />

          {categoriasSugeridas.length > 0 ? (
            <AppAutocomplete
              label="Categoria"
              size="xs"
              placeholder="Ex: Alimentos, Limpeza, Embalagens..."
              data={categoriasSugeridas}
              value={categoria}
              onChange={onChangeCategoria}
            />
          ) : (
            <TextInput
              label="Categoria"
              size="xs"
              placeholder="Ex: Alimentos, Limpeza, Embalagens..."
              value={categoria}
              onChange={(e) => onChangeCategoria(e.currentTarget.value)}
            />
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

export default EditProductModal
