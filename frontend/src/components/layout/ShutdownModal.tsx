import {
  Badge,
  Button,
  Center,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconPower } from '@tabler/icons-react'

interface ShutdownModalProps {
  opened: boolean
  onClose: () => void
  onConfirmShutdown: () => void
}

export function ShutdownModal({
  opened,
  onClose,
  onConfirmShutdown,
}: ShutdownModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon color="red" variant="light" size={24} radius="sm">
            <IconPower size="1.2rem" />
          </ThemeIcon>
          <Text fw={700} size="sm">
            Encerrar Aplicativo
          </Text>
        </Group>
      }
      centered
      size="sm"
    >
      <Stack gap="sm">
        <Text size="sm">
          Deseja realmente desligar o servidor local do <b>Mapa de Cotações</b>? Todas as alterações já estão salvas no banco de dados SQLite.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" size="xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            color="red"
            size="xs"
            leftSection={<IconPower size={14} />}
            onClick={onConfirmShutdown}
          >
            Encerrar Agora
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export function ShutdownCompleteScreen() {
  return (
    <Center
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--mantine-color-body)',
        padding: 20,
      }}
    >
      <Paper withBorder p="xl" radius="md" style={{ maxWidth: 480, textAlign: 'center', boxShadow: 'none' }}>
        <ThemeIcon size={56} radius="xl" color="teal" variant="light" mb="md" mx="auto">
          <IconPower size={32} />
        </ThemeIcon>
        <Title order={3} mb="xs">
          Aplicativo Encerrado com Sucesso
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          O banco de dados SQLite foi sincronizado e o servidor local foi finalizado com segurança.
        </Text>
        <Badge size="lg" color="gray" variant="light">
          Você já pode fechar esta aba do navegador
        </Badge>
      </Paper>
    </Center>
  )
}

export default ShutdownModal
