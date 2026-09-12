import { memo, useState, useEffect } from 'react'
import { NumberInput, Text } from '@mantine/core'

interface QuantityInputProps {
  /** Identificador estável da linha (ex: chave da linha na tabela), repassado às callbacks. */
  rowKey: string
  initialValue: number
  onBlur?: (rowKey: string, value: number) => void
  onChangeLive?: (rowKey: string, value: number) => void
  disabled?: boolean
  unit?: string
  width?: number | string
  autoFocus?: boolean
}

/**
 * Memoizado porque é instanciado uma vez por linha em grids editáveis (ex: Alocação).
 * Para o memo funcionar de verdade, as callbacks devem ser referências estáveis
 * (useCallback) — por isso `rowKey` é repassado como argumento em vez de o chamador
 * precisar criar uma arrow function nova por linha a cada render.
 */
export const QuantityInput = memo(function QuantityInput({
  rowKey,
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
      onChangeLive(rowKey, num)
    }
  }

  const handleBlur = () => {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0
    if (onBlur) onBlur(rowKey, num)
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
})
