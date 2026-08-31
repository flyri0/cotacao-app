import React from 'react'
import type { ReactNode } from 'react'
import { Badge, Group, Text, ThemeIcon, Title } from '@mantine/core'

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
    <Group justify="space-between" align="center" mb={4} style={{ width: '100%' }}>
      <Group gap="xs" align="center">
        <ThemeIcon size={28} radius="sm" variant="light" color={iconColor}>
          <Icon size={16} />
        </ThemeIcon>
        <Group gap="xs" align="center">
          <Title order={3} fw={700} style={{ letterSpacing: '-0.2px', fontSize: '1.05rem', lineHeight: 1.2 }}>
            {title}
          </Title>
          {badge && (
            <Badge size="xs" variant="light" color={badge.color || iconColor}>
              {badge.label}
            </Badge>
          )}
          {subtitle && (
            <Text size="xs" c="dimmed" style={{ display: 'none' /* Oculto para salvar espaço vertical, ou visível em telas maiores */ }} visibleFrom="md">
              • {subtitle}
            </Text>
          )}
        </Group>
      </Group>

      {rightSection && <Group gap="xs">{rightSection}</Group>}
    </Group>
  )
}

export default PageHeader
