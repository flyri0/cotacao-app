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
    <Card withBorder radius="md" p="md" style={{ width: '100%' }}>
      <Group justify="space-between" align="center" mb="sm">
        <div>
          <Title order={4} fw={600}>
            {title}
          </Title>
          {subtitle && (
            <Text size="xs" c="dimmed" mt={2}>
              {subtitle}
            </Text>
          )}
        </div>

        <Group gap="xs">
          {kbdHint && (
            <Text size="xs" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
