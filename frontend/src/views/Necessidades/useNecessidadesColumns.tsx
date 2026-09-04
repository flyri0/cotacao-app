import { useMemo } from 'react'
import { ActionIcon, Group, Text, Tooltip } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import type { MRT_ColumnDef } from 'mantine-react-table'
import type { Necessidade } from '../../types'

interface UseNecessidadesColumnsProps {
  deletingId: number | null
  isFechada: boolean
  handleRemover: (id: number, produtoNome: string) => void
}

export function useNecessidadesColumns({
  deletingId,
  isFechada,
  handleRemover,
}: UseNecessidadesColumnsProps) {
  return useMemo<MRT_ColumnDef<Necessidade>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto em Falta',
        size: 280,
        Cell: ({ cell }) => (
          <Text fw={600} size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'produto_categoria',
        header: 'Categoria',
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return (
            <Text size="xs" truncate="end" c={!val ? 'dimmed' : undefined}>
              {val || '-'}
            </Text>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 80,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Group justify="center">
            <Tooltip label="Remover produto da rodada">
              <ActionIcon
                color="red"
                variant="subtle"
                size="sm"
                loading={deletingId === row.original.id}
                disabled={isFechada}
                onClick={() => handleRemover(row.original.id, row.original.produto_nome)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [deletingId, isFechada, handleRemover],
  )
}
