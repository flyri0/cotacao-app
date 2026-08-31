import React from 'react'
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

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  valueColor,
  badge,
}: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.5px' }}>
            {label}
          </Text>
          {Icon && (
            <ThemeIcon color={color} variant="light" size="md" radius="md">
              <Icon size={18} />
            </ThemeIcon>
          )}
        </Group>

        <Group justify="space-between" align="baseline" mt="xs">
          <Title order={2} fw={700} c={valueColor || (color === 'teal' ? 'teal.7' : undefined)}>
            {value}
          </Title>
          {badge && (
            <Badge variant="light" color={badge.color || color} size="sm">
              {badge.label}
            </Badge>
          )}
        </Group>
      </div>

      {subtitle && (
        <Text size="xs" c="dimmed" mt={6}>
          {subtitle}
        </Text>
      )}
    </Paper>
  )
}

export default StatCard
