import React from 'react'
import type { ReactNode } from 'react'
import { Card, Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number }>
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({
  icon: Icon = IconSearch,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Card withBorder p="md" radius="sm" style={{ width: '100%' }}>
      <Center py="md">
        <Stack align="center" gap="xs" style={{ maxWidth: 420, textAlign: 'center' }}>
          <ThemeIcon size={56} radius="xl" color="gray" variant="light">
            <Icon size={30} />
          </ThemeIcon>
          <Text fw={600} size="md">
            {title}
          </Text>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
          {action && <div style={{ marginTop: 8 }}>{action}</div>}
        </Stack>
      </Center>
    </Card>
  )
}

export default EmptyState
