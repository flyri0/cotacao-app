import { useState, useEffect } from 'react'
import { NumberInput, Text } from '@mantine/core'

interface QuantityInputProps {
  initialValue: number
  onBlur: (value: number) => void
  disabled?: boolean
  unit?: string
}

export function QuantityInput({ initialValue, onBlur, disabled, unit }: QuantityInputProps) {
  const [value, setValue] = useState<number | string>(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const handleBlur = () => {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0
    onBlur(num)
  }

  return (
    <NumberInput
      value={value}
      onChange={setValue}
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
