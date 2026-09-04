
import {
  Card,
  Title,
  Text,
  Paper,
  Stack,
  Group,
  ThemeIcon,
  Badge,
  Switch,
  Divider,
  TextInput,
  Button,
  SimpleGrid,
  NumberInput,
} from '@mantine/core'
import {
  IconDatabase,
  IconClock,
  IconFolder,
  IconFolderOpen,
  IconDatabaseImport,
  IconDatabaseExport,
  IconDeviceFloppy,
  IconTrash,
} from '@tabler/icons-react'
import { AppSelect } from '../../components/form/AppSelect'

interface DatabaseSectionProps {
  form: any
  themeColor: string
  selecionandoPasta: boolean
  ultimoBackupSucesso: string
  ultimoBackupStatus: string
  executandoBackupAuto: boolean
  salvandoConfig: boolean
  handleSelecionarPastaBackup: () => void
  handleOpenImportar: () => void
  handleTestarBackupAgora: () => void
  handleSubmitConfigs: (values: any) => void
  handleOpenFormatar: () => void
}

export function DatabaseSection({
  form,
  themeColor,
  selecionandoPasta,
  ultimoBackupSucesso,
  ultimoBackupStatus,
  executandoBackupAuto,
  salvandoConfig,
  handleSelecionarPastaBackup,
  handleOpenImportar,
  handleTestarBackupAgora,
  handleSubmitConfigs,
  handleOpenFormatar,
}: DatabaseSectionProps) {
  return (
    <Card withBorder shadow="none" radius="sm" p="sm">
      <Title order={3} mb="xs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconDatabase size={22} />
        Gerenciamento do Banco de Dados (SQLite Local)
      </Title>
      <Text size="xs" c="dimmed" mb="lg">
        Arquivo local independente (<b>cotacao.db</b>). Todas as ações críticas contam com confirmação segura e timer de proteção.
      </Text>

      {/* Card: Backup Automático Programado */}
      <Paper withBorder p="md" radius="md" mb="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs">
              <ThemeIcon color="blue" variant="light" size="lg" radius="md">
                <IconClock size={20} />
              </ThemeIcon>
              <div>
                <Group gap="xs" align="center">
                  <Title order={4}>Backup Automático Programado</Title>
                  <Badge color={form.values.backup_auto_ativo ? 'teal' : 'gray'} variant="light" size="sm">
                    {form.values.backup_auto_ativo ? 'Ativo' : 'Desativado'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Gera cópias atômicas do banco em outro diretório (outro disco, pendrive ou pasta sincronizada) com retenção automática.
                </Text>
              </div>
            </Group>

            <Switch
              label="Ativar Backup Automático"
              checked={form.values.backup_auto_ativo}
              onChange={(e) => form.setFieldValue('backup_auto_ativo', e.currentTarget.checked)}
              size="md"
              color="teal"
            />
          </Group>

          <Divider my={4} />

          {/* Configurações do Backup Automático */}
          <Stack gap="xs">
            {/* Campo de Seleção Segura de Diretório (readOnly) */}
            <TextInput
              label="Diretório de Destino dos Backups"
              description="Selecione a pasta de destino exclusivamente através do diálogo nativo do sistema."
              placeholder="Nenhuma pasta selecionada. Clique no botão ao lado para escolher..."
              value={form.values.backup_auto_diretorio}
              readOnly
              styles={{ input: { cursor: 'default' } }}
              leftSection={<IconFolder size={16} />}
              rightSectionWidth={170}
              rightSection={
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  leftSection={<IconFolderOpen size={14} />}
                  onClick={handleSelecionarPastaBackup}
                  loading={selecionandoPasta}
                  style={{ marginRight: 4 }}
                >
                  Selecionar Pasta...
                </Button>
              }
            />

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs" mt={4}>
              <AppSelect
                label="Momento / Gatilho"
                description="Quando executar a cópia"
                data={[
                  { value: 'abertura', label: 'Ao Iniciar o Aplicativo' },
                  { value: 'fechamento', label: 'Ao Fechar o Aplicativo' },
                  { value: 'periodico', label: 'Periodicamente por Intervalo' },
                  { value: 'sempre', label: 'Completo (Abertura, Fechamento e Periódico)' },
                ]}
                value={form.values.backup_auto_gatilho}
                onChange={(val) => form.setFieldValue('backup_auto_gatilho', val || 'abertura')}
                allowDeselect={false}
              />

              <AppSelect
                label="Intervalo Periódico"
                description="Frequência em horas"
                data={[
                  { value: '1', label: 'A cada 1 hora' },
                  { value: '2', label: 'A cada 2 horas' },
                  { value: '4', label: 'A cada 4 horas (Padrão)' },
                  { value: '8', label: 'A cada 8 horas' },
                  { value: '12', label: 'A cada 12 horas' },
                  { value: '24', label: 'Diário (a cada 24 horas)' },
                ]}
                value={String(form.values.backup_auto_intervalo_horas || '4')}
                onChange={(val) => form.setFieldValue('backup_auto_intervalo_horas', val || '4')}
                allowDeselect={false}
                disabled={form.values.backup_auto_gatilho === 'abertura' || form.values.backup_auto_gatilho === 'fechamento'}
              />

              <NumberInput
                label="Retenção Máxima"
                description="Backups mais antigos são removidos"
                min={1}
                max={50}
                value={form.values.backup_auto_max_arquivos}
                onChange={(val) => form.setFieldValue('backup_auto_max_arquivos', typeof val === 'number' ? val : 10)}
              />
            </SimpleGrid>

            {/* Barra de Status do Último Backup e Ações */}
            <Paper withBorder p="xs" radius="sm" bg="var(--mantine-color-default-hover)" mt="xs">
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs" align="center">
                  <Text size="xs" fw={600}>Último Backup Realizado:</Text>
                  <Text size="xs" c={ultimoBackupSucesso ? 'dimmed' : 'gray'}>
                    {ultimoBackupSucesso || 'Nenhum backup automático registrado ainda.'}
                  </Text>
                  {ultimoBackupStatus && (
                    <Badge
                      size="xs"
                      color={ultimoBackupStatus === 'Sucesso' ? 'teal' : 'red'}
                      variant="filled"
                    >
                      {ultimoBackupStatus === 'Sucesso' ? '✓ Sucesso' : ultimoBackupStatus}
                    </Badge>
                  )}
                </Group>

                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    leftSection={<IconDatabaseImport size={14} />}
                    onClick={handleOpenImportar}
                  >
                    Restaurar .db
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    leftSection={<IconDatabaseExport size={14} />}
                    onClick={handleTestarBackupAgora}
                    loading={executandoBackupAuto}
                  >
                    Fazer Backup Agora
                  </Button>
                  <Button
                    size="xs"
                    variant="filled"
                    color={themeColor}
                    leftSection={<IconDeviceFloppy size={14} />}
                    onClick={() => handleSubmitConfigs(form.values)}
                    loading={salvandoConfig}
                  >
                    Salvar Opções de Backup
                  </Button>
                </Group>
              </Group>
            </Paper>
          </Stack>
        </Stack>
      </Paper>

      {/* Zona de Perigo: Formatar / Limpar Tudo */}
      <Paper
        withBorder
        p="sm"
        radius="sm"
        mt="xs"
        style={{ borderColor: 'var(--mantine-color-red-light-color)' }}
      >
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" size="md" radius="sm">
              <IconTrash size={18} />
            </ThemeIcon>
            <div>
              <Title order={5} c="red">
                Zona de Perigo: Formatar Banco de Dados
              </Title>
              <Text size="xs" c="dimmed">
                Exclui permanentemente todos os produtos, fornecedores, histórico de cotações, rodadas e decisões de alocação. Requer dupla confirmação de segurança.
              </Text>
            </div>
          </Group>

          <Button
            variant="filled"
            color="red"
            size="xs"
            leftSection={<IconTrash size={14} />}
            onClick={handleOpenFormatar}
          >
            Formatar Banco...
          </Button>
        </Group>
      </Paper>
    </Card>
  )
}
