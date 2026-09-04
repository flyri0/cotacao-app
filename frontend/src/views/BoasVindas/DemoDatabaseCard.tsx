import { Button, Group, Paper, Text, ThemeIcon } from '@mantine/core'
import { IconFlask, IconSparkles } from '@tabler/icons-react'

interface DemoDatabaseCardProps {
  onLoadDemo: () => Promise<void>
  loading: boolean
}

export function DemoDatabaseCard({ onLoadDemo, loading }: DemoDatabaseCardProps) {
  return (
    <Paper withBorder p="md" radius="md" style={{ width: '100%' }}>
      <Group justify="space-between" align="center">
        <div>
          <Group gap="xs">
            <ThemeIcon color="gray" variant="light" size="md" radius="sm">
              <IconFlask size={16} />
            </ThemeIcon>
            <Text fw={600} size="sm">
              Carregar Banco de Dados de Demonstração & Testes
            </Text>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Popula o sistema com 50 produtos em 6 categorias, 8 fornecedores, 3 rodadas fechadas (histórico de preços) e 1 rodada aberta em andamento com cotações e alocações.
          </Text>
        </div>

        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<IconSparkles size={14} />}
          onClick={onLoadDemo}
          loading={loading}
        >
          Carregar Dados de Teste
        </Button>
      </Group>
    </Paper>
  )
}
