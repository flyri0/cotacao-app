import React from 'react'
import type { ReactNode } from 'react'
import { Badge, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'

interface PageHeaderProps {
  icon: React.ComponentType<{ size?: number; stroke?: number }>
  iconColor?: string
  title: string
  subtitle?: string
  badge?: {
    label: string | number
    color?: string
  }
  rightSection?: ReactNode
}

export function PageHeader({
  icon: Icon,
  iconColor = 'blue',
  title,
  subtitle,
  badge,
  rightSection,
}: PageHeaderProps) {
  return (
    <Group justify="space-between" align="center" mb="xs" style={{ width: '100%' }}>
      <Group gap="sm" align="center">
        <ThemeIcon size={42} radius="md" variant="light" color={iconColor}>
          <Icon size={24} />
        </ThemeIcon>
        <Stack gap={2}>
          <Group gap="xs" align="center">
            <Title order={2} fw={700} style={{ letterSpacing: '-0.3px' }}>
              {title}
            </Title>
            {badge && (
              <Badge size="md" variant="light" color={badge.color || iconColor}>
                {badge.label}
              </Badge>
            )}
          </Group>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Stack>
      </Group>

      {rightSection && <Group gap="xs">{rightSection}</Group>}
    </Group>
  )
}

export default PageHeader
