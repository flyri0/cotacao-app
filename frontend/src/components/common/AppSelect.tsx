import { forwardRef } from 'react'
import {
  Select,
  type SelectProps,
} from '@mantine/core'
import {
  AppAutocomplete,
  type AppAutocompleteProps,
  normalizeComboboxOptions,
  findBestMatch,
} from './AppAutocomplete'

export { AppAutocomplete, type AppAutocompleteProps }

export interface AppSelectProps extends SelectProps {
  onTabOrEnterNextRef?: React.RefObject<HTMLInputElement | HTMLElement | null>
}

/**
 * Select pesquisável com seleção automática da 1ª opção compatível no Tab ou Enter
 */
export const AppSelect = forwardRef<HTMLInputElement, AppSelectProps>(
  (
    {
      data = [],
      value,
      onChange,
      onOptionSubmit,
      onKeyDown,
      onTabOrEnterNextRef,
      searchable = true,
      ...props
    },
    ref,
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const isTab = e.key === 'Tab' && !e.shiftKey
      const isEnter = e.key === 'Enter' && !e.shiftKey

      if (isTab || isEnter) {
        const rawInput = e.currentTarget.value || ''
        const items = normalizeComboboxOptions(data)
        const match = findBestMatch(rawInput, items)

        if (match) {
          onChange?.(match.value, match)
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
      <Select
        ref={ref}
        data={data}
        value={value}
        onChange={onChange}
        onOptionSubmit={onOptionSubmit}
        onKeyDown={handleKeyDown}
        searchable={searchable}
        selectFirstOptionOnChange
        {...props}
      />
    )
  },
)
AppSelect.displayName = 'AppSelect'

export default AppSelect
