import { Modal, Group, Text, Stack, TextInput, Button, FileInput } from '@mantine/core'
import { IconEdit, IconFileSpreadsheet, IconDownload, IconTag } from '@tabler/icons-react'
import { AppAutocomplete } from '../../components/form/AppSelect'
import type { UseFormReturnType } from '@mantine/form'
import type { Produto } from '../../types'
import type { Dispatch, SetStateAction } from 'react'

interface ProdutosModalsProps {
  themeColor?: string
  
  // Editar
  modalEditarOpened: boolean
  closeModalEditar: () => void
  produtoEmEdicao: Produto | null
  formEdicao: UseFormReturnType<{ nome: string; categoria: string }>
  handleSalvarEdicao: (values: { nome: string; categoria: string }) => Promise<void>
  salvandoEdicao: boolean
  categoriasSugeridas: string[]

  // Importar
  modalImportarOpened: boolean
  closeModalImportar: () => void
  arquivoExcel: File | null
  setArquivoExcel: Dispatch<SetStateAction<File | null>>
  importandoExcel: boolean
  handleProcessarImportacaoExcel: () => Promise<void>

  // Massa
  modalMassaCategoriaOpened: boolean
  closeModalMassaCategoria: () => void
  selectedProductIds: number[]
  novaCategoriaEmMassa: string
  setNovaCategoriaEmMassa: Dispatch<SetStateAction<string>>
  salvandoMassa: boolean
  handleAlterarCategoriaEmMassa: () => Promise<void>
}

export function ProdutosModals({
  themeColor = 'blue',

  modalEditarOpened,
  closeModalEditar,
  produtoEmEdicao,
  formEdicao,
  handleSalvarEdicao,
  salvandoEdicao,
  categoriasSugeridas,

  modalImportarOpened,
  closeModalImportar,
  arquivoExcel,
  setArquivoExcel,
  importandoExcel,
  handleProcessarImportacaoExcel,

  modalMassaCategoriaOpened,
  closeModalMassaCategoria,
  selectedProductIds,
  novaCategoriaEmMassa,
  setNovaCategoriaEmMassa,
  salvandoMassa,
  handleAlterarCategoriaEmMassa,
}: ProdutosModalsProps) {
  return (
    <>
      <Modal
        opened={modalEditarOpened}
        onClose={closeModalEditar}
        title={
          <Group gap="xs">
            <IconEdit size={18} />
            <Text fw={700}>
              Editar Produto: {produtoEmEdicao?.nome}
            </Text>
          </Group>
        }
        centered
        radius="sm"
        size="lg"
      >
        <form onSubmit={formEdicao.onSubmit(handleSalvarEdicao)}>
          <Stack gap="sm">
            <TextInput
              label="Nome do Produto"
              size="xs"
              placeholder="Ex: Detergente Neutro 500ml"
              required
              {...formEdicao.getInputProps('nome')}
            />

            <AppAutocomplete
              label="Categoria"
              size="xs"
              placeholder="Ex: Limpeza, Descartáveis"
              data={categoriasSugeridas}
              {...formEdicao.getInputProps('categoria')}
            />

            <Group justify="flex-end" gap="xs" mt="md">
              <Button variant="subtle" color="gray" size="xs" onClick={closeModalEditar}>
                Cancelar
              </Button>
              <Button type="submit" variant="filled" color={themeColor} size="xs" loading={salvandoEdicao}>
                Salvar Alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        title={
          <Group gap="xs">
            <IconFileSpreadsheet size={18} />
            <Text fw={700}>Importar Produtos via Planilha Excel (.xlsx)</Text>
          </Group>
        }
        centered
        radius="sm"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Faça upload de uma planilha contendo colunas: <b>Nome do Produto</b>, <b>Categoria</b> e <b>Unidade Padrão</b>.
          </Text>

          <FileInput
            label="Arquivo Excel (.xlsx)"
            size="xs"
            placeholder="Selecione o arquivo de produtos..."
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
              Importar Produtos
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={modalMassaCategoriaOpened}
        onClose={closeModalMassaCategoria}
        title={
          <Group gap="xs">
            <IconTag size={18} />
            <Text fw={700}>
              Alterar Categoria em Massa ({selectedProductIds.length} produto{selectedProductIds.length > 1 ? 's' : ''})
            </Text>
          </Group>
        }
        centered
        radius="sm"
        size="md"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Informe a nova categoria para todos os {selectedProductIds.length} produtos selecionados.
          </Text>

          <AppAutocomplete
            label="Nova Categoria"
            size="xs"
            placeholder="Selecione ou digite a nova categoria..."
            data={categoriasSugeridas}
            value={novaCategoriaEmMassa}
            onChange={setNovaCategoriaEmMassa}
          />

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={closeModalMassaCategoria}>
              Cancelar
            </Button>
            <Button
              variant="filled"
              color={themeColor}
              size="xs"
              loading={salvandoMassa}
              onClick={handleAlterarCategoriaEmMassa}
            >
              Aplicar a Todos
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
