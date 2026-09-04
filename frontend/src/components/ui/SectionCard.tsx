import type { ReactNode } from 'react'
import { Card, Group, Kbd, Text, Title } from '@mantine/core'

interface SectionCardProps {
  title: string
  subtitle?: string
  kbdHint?: string
  rightSection?: ReactNode
  children: ReactNode
}

export function SectionCard({
  title,
  subtitle,
  kbdHint,
  rightSection,
  children,
}: SectionCardProps) {
  return (
    <Card withBorder radius="sm" p="xs" style={{ width: '100%' }}>
      <Group justify="space-between" align="center" mb={6}>
        <Group gap="xs" align="center">
          <Title order={5} fw={600} style={{ fontSize: '0.88rem' }}>
            {title}
          </Title>
          {subtitle && (
            <Text size="xs" c="dimmed">
              • {subtitle}
            </Text>
          )}
        </Group>

        <Group gap="xs">
          {kbdHint && (
            <Text size="11px" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Pressione <Kbd size="xs">{kbdHint}</Kbd> para avançar
            </Text>
          )}
          {rightSection}
        </Group>
      </Group>

      {children}
    </Card>
  )
}

export default SectionCard
