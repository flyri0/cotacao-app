import { Button, Card, FileInput, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconDatabaseImport } from '@tabler/icons-react'

interface RestoreBackupCardProps {
  arquivoImportar: File | null
  setArquivoImportar: (file: File | null) => void
  onImportBackup: () => Promise<void>
  loading: boolean
}

export function RestoreBackupCard({
  arquivoImportar,
  setArquivoImportar,
  onImportBackup,
  loading,
}: RestoreBackupCardProps) {
  return (
    <Card withBorder shadow="sm" radius="md" p="xl">
      <Stack justify="space-between" h="100%">
        <div>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="teal" variant="light" size="xl" radius="md">
              <IconDatabaseImport size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Restaurar Backup</Title>
              <Text size="xs" c="dimmed">
                Importar arquivo .db existente
              </Text>
            </div>
          </Group>
          <Text size="sm" c="dimmed" mt="xs" mb="sm">
            Carregue um arquivo de cópia de segurança salvo anteriormente no seu computador com todo o histórico e cadastros.
          </Text>

          <FileInput
            placeholder="Selecione o arquivo .db"
            accept=".db,.sqlite"
            value={arquivoImportar}
            onChange={setArquivoImportar}
            size="xs"
          />
        </div>

        <Button
          size="md"
          color="teal"
          variant="filled"
          leftSection={<IconDatabaseImport size={18} />}
          onClick={onImportBackup}
          disabled={!arquivoImportar}
          loading={loading}
          mt="xl"
          fullWidth
        >
          Restaurar e Abrir
        </Button>
      </Stack>
    </Card>
  )
}
