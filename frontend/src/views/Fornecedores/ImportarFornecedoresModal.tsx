import { Button, FileInput, Group, Modal, Stack, Text } from '@mantine/core'
import { IconDownload, IconFileSpreadsheet } from '@tabler/icons-react'

interface ImportarFornecedoresModalProps {
  opened: boolean
  onClose: () => void
  themeColor: string
  arquivoExcel: File | null
  setArquivoExcel: (file: File | null) => void
  importandoExcel: boolean
  onProcessarImportacao: () => Promise<void>
}

export function ImportarFornecedoresModal({
  opened,
  onClose,
  themeColor,
  arquivoExcel,
  setArquivoExcel,
  importandoExcel,
  onProcessarImportacao,
}: ImportarFornecedoresModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
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
          Faça upload de uma planilha com colunas: <b>Nome / Razão Social</b>, <b>Contato</b>, <b>Telefone</b>,{' '}
          <b>E-mail</b> e <b>Pedido Mínimo</b>.
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
          <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="filled"
            color={themeColor}
            size="xs"
            leftSection={<IconDownload size={14} />}
            loading={importandoExcel}
            onClick={onProcessarImportacao}
          >
            Importar Fornecedores
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
