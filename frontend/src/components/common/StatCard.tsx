import React, { memo } from 'react'
import { Badge, Group, Paper, Text, ThemeIcon, Title } from '@mantine/core'

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: React.ComponentType<{ size?: number }>
  color?: string
  valueColor?: string
  badge?: {
    label: string
    color?: string
  }
}

export const StatCard = memo(function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  valueColor,
  badge,
}: StatCardProps) {
  return (
    <Paper withBorder p="xs" radius="sm" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 64 }}>
      <Group justify="space-between" align="center" gap="xs">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} align="center">
            <Text size="11px" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.3px', lineHeight: 1.1 }}>
              {label}
            </Text>
            {badge && (
              <Badge variant="light" color={badge.color || color} size="xs">
                {badge.label}
              </Badge>
            )}
          </Group>
          <Title order={3} fw={700} c={valueColor || (color === 'teal' ? 'teal' : color === 'red' ? 'red' : undefined)} style={{ fontSize: '1.25rem', lineHeight: 1.2, marginTop: 2 }}>
            {value}
          </Title>
          {subtitle && (
            <Text size="10px" c="dimmed" lineClamp={1}>
              {subtitle}
            </Text>
          )}
        </div>

        {Icon && (
          <ThemeIcon color={color} variant="light" size={28} radius="sm">
            <Icon size={16} />
          </ThemeIcon>
        )}
      </Group>
    </Paper>
  )
})

export default StatCard
