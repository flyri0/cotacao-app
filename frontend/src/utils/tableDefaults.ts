import type { MRT_TableOptions, MRT_RowData } from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../locales/mrtPtBr'

interface VirtualTableConfig {
  enableRowSelection?: boolean
  enableTopToolbar?: boolean
  enableRowVirtualization?: boolean
  enableColumnFilters?: boolean
  enableGlobalFilter?: boolean
  overscan?: number
}

/**
 * Propriedades base padronizadas para MRT virtualizada com flex-height 100%.
 * Remove a paginação ("linhas por página") e ativa a lista virtualizada TanStack Virtual.
 */
export function getVirtualizedTableProps<TData extends MRT_RowData>(
  config: VirtualTableConfig = {}
): Partial<MRT_TableOptions<TData>> {
  const {
    enableTopToolbar = true,
    enableRowVirtualization = false,
    enableColumnFilters = true,
    enableGlobalFilter = true,
    overscan = 8,
  } = config

  return {
    localization: MRT_Localization_PT_BR,
    enableDensityToggle: false,
    enableRowActions: false,
    enablePagination: false,       // Desativa o controle de linhas por página
    enableBottomToolbar: false,     // Remove a barra inferior vazia
    enableTopToolbar,
    enableColumnFilters,
    enableGlobalFilter,
    enableRowVirtualization,        // Virtualização de linhas quando compatível
    enableStickyHeader: true,       // Mantém o cabeçalho fixo no topo da tabela
    rowVirtualizerOptions: enableRowVirtualization
      ? {
          overscan,
        }
      : undefined,
    initialState: {
      density: 'xs',
      showColumnFilters: false,
    },
    mantinePaperProps: {
      withBorder: true,
      radius: 'sm',
      shadow: 'none',
      style: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      },
    },
    mantineTableContainerProps: {
      style: {
        flex: 1,
        height: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: '6px 8px',
        fontSize: 'var(--app-font-base, 13px)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: '4px 8px',
        fontSize: 'var(--app-font-base, 13px)',
      },
    },
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: true,
    },
  }
}
