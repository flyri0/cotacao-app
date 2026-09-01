import { useState, useEffect } from 'react'
import { NumberInput, Text } from '@mantine/core'

interface QuantityInputProps {
  initialValue: number
  onBlur?: (value: number) => void
  onChangeLive?: (value: number) => void
  disabled?: boolean
  unit?: string
}

export function QuantityInput({ initialValue, onBlur, onChangeLive, disabled, unit }: QuantityInputProps) {
  const [value, setValue] = useState<number | string>(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const handleChange = (val: number | string) => {
    setValue(val)
    if (onChangeLive) {
      const num = typeof val === 'number' ? val : parseFloat(val) || 0
      onChangeLive(num)
    }
  }

  const handleBlur = () => {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0
    if (onBlur) onBlur(num)
  }

  return (
    <NumberInput
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      min={0}
      decimalScale={2}
      size="xs"
      rightSectionWidth={75}
      rightSectionPointerEvents="none"
      rightSection={
        unit ? (
          <Text size="xs" fw={700} c="dimmed" mr={8}>
            {unit}
          </Text>
        ) : null
      }
      styles={{
        input: {
          fontWeight: 600,
          textAlign: 'right',
          paddingRight: 80,
        },
      }}
    />
  )
}
