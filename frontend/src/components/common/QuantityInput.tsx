import { useState, useEffect } from 'react'
import { NumberInput, Text } from '@mantine/core'

interface QuantityInputProps {
  initialValue: number
  onBlur?: (value: number) => void
  onChangeLive?: (value: number) => void
  disabled?: boolean
  unit?: string
  width?: number | string
  autoFocus?: boolean
}

export function QuantityInput({
  initialValue,
  onBlur,
  onChangeLive,
  disabled,
  unit,
  width,
  autoFocus,
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
      autoFocus={autoFocus}
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
          <Text size="10px" fw={700} c="dimmed" mr={4}>
            {unit}
          </Text>
        ) : null
      }
      styles={{
        root: {
          width: width || (hasUnit ? 100 : 75),
          marginLeft: 'auto',
        },
        input: {
          fontWeight: 600,
          textAlign: 'right',
          paddingRight: hasUnit ? 38 : 6,
          paddingLeft: 6,
          height: 24,
          minHeight: 24,
          fontSize: '11.5px',
        },
      }}
    />
  )
}
