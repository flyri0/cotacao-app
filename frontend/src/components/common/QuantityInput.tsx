import { useState, useEffect } from 'react'
import { NumberInput, Text } from '@mantine/core'

interface QuantityInputProps {
  initialValue: number
  onBlur?: (value: number) => void
  onChangeLive?: (value: number) => void
  disabled?: boolean
  unit?: string
  width?: number | string
}

export function QuantityInput({
  initialValue,
  onBlur,
  onChangeLive,
  disabled,
  unit,
  width,
}: QuantityInputProps) {
  const [value, setValue] = useState<number | string>(initialValue)

  useEffect(() => {
    if (Number(initialValue) !== Number(value)) {
      setValue(initialValue)
    }
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

  const hasUnit = Boolean(unit && unit.trim().length > 0)

  return (
    <NumberInput
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      min={0}
      decimalScale={2}
      size="xs"
      hideControls
      rightSectionWidth={hasUnit ? 36 : 0}
      rightSectionPointerEvents="none"
      rightSection={
        hasUnit ? (
          <Text size="xs" fw={700} c="dimmed" mr={4}>
            {unit}
          </Text>
        ) : null
      }
      styles={{
        root: {
          width: width || (hasUnit ? 105 : 75),
          marginLeft: 'auto',
        },
        input: {
          fontWeight: 600,
          textAlign: 'right',
          paddingRight: hasUnit ? 40 : 8,
          paddingLeft: 8,
          height: 26,
          minHeight: 26,
          fontSize: 'var(--app-font-base, 13px)',
        },
      }}
    />
  )
}
