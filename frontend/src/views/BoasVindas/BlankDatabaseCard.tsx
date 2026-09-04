import { Button, Card, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'

interface BlankDatabaseCardProps {
  onCreateBlank: () => Promise<void>
  loading: boolean
}

export function BlankDatabaseCard({ onCreateBlank, loading }: BlankDatabaseCardProps) {
  return (
    <Card withBorder shadow="sm" radius="md" p="xl">
      <Stack justify="space-between" h="100%">
        <div>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="blue" variant="light" size="xl" radius="md">
              <IconPlus size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Banco em Branco</Title>
              <Text size="xs" c="dimmed">
                Recomendado para produção
              </Text>
            </div>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            Inicie com um catálogo 100% limpo para cadastrar seus próprios produtos, fornecedores e criar suas primeiras rodadas de cotação.
          </Text>
        </div>

        <Button
          size="md"
          color="blue"
          variant="filled"
          leftSection={<IconPlus size={18} />}
          onClick={onCreateBlank}
          loading={loading}
          mt="xl"
          fullWidth
        >
          Iniciar com Banco Vazio
        </Button>
      </Stack>
    </Card>
  )
}
