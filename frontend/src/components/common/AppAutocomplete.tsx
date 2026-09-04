import { forwardRef } from 'react'
import {
  Autocomplete,
  type AutocompleteProps,
  type ComboboxItem,
} from '@mantine/core'

export interface AppAutocompleteProps extends AutocompleteProps {
  onTabOrEnterNextRef?: React.RefObject<HTMLInputElement | HTMLElement | null>
}

/**
 * Normaliza opções para lista de ComboboxItem { value, label }
 */
export function normalizeComboboxOptions(data: any): ComboboxItem[] {
  if (!Array.isArray(data)) return []
  return data.map((item) => {
    if (typeof item === 'string') {
      return { value: item, label: item }
    }
    if (item && typeof item === 'object') {
      return {
        value: String(item.value ?? item.label ?? ''),
        label: String(item.label ?? item.value ?? ''),
        disabled: item.disabled,
      }
    }
    return { value: String(item), label: String(item) }
  })
}

/**
 * Localiza a melhor correspondência (exata > começa com > contém)
 */
export function findBestMatch(inputValue: string, items: ComboboxItem[]): ComboboxItem | null {
  const query = inputValue.trim().toLowerCase()
  if (!query || items.length === 0) return null

  // 1. Correspondência exata
  const exact = items.find(
    (item) =>
      item.value.toLowerCase() === query || item.label.toLowerCase() === query,
  )
  if (exact) return exact

  // 2. Começa com
  const startsWith = items.find(
    (item) =>
      item.value.toLowerCase().startsWith(query) ||
      item.label.toLowerCase().startsWith(query),
  )
  if (startsWith) return startsWith

  // 3. Contém
  const includes = items.find(
    (item) =>
      item.value.toLowerCase().includes(query) ||
      item.label.toLowerCase().includes(query),
  )
  if (includes) return includes

  return null
}

/**
 * Autocomplete com seleção automática da 1ª opção compatível no Tab ou Enter
 */
export const AppAutocomplete = forwardRef<HTMLInputElement, AppAutocompleteProps>(
  (
    {
      data = [],
      value,
      onChange,
      onOptionSubmit,
      onKeyDown,
      onTabOrEnterNextRef,
      ...props
    },
    ref,
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const isTab = e.key === 'Tab' && !e.shiftKey
      const isEnter = e.key === 'Enter' && !e.shiftKey

      if (isTab || isEnter) {
        const rawInput = e.currentTarget.value || (typeof value === 'string' ? value : '')
        const items = normalizeComboboxOptions(data)
        const match = findBestMatch(rawInput, items)

        if (match) {
          onChange?.(match.value)
          onOptionSubmit?.(match.value)
        }

        if (isEnter) {
          e.preventDefault()
          if (onTabOrEnterNextRef?.current) {
            onTabOrEnterNextRef.current.focus()
          }
        }
      }

      onKeyDown?.(e)
    }

    return (
      <Autocomplete
        ref={ref}
        data={data}
        value={value}
        onChange={onChange}
        onOptionSubmit={onOptionSubmit}
        onKeyDown={handleKeyDown}
        selectFirstOptionOnChange
        {...props}
      />
    )
  },
)
AppAutocomplete.displayName = 'AppAutocomplete'

export default AppAutocomplete
