import { useMemo } from 'react'
import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core'
import { IconEdit, IconPower, IconTrash } from '@tabler/icons-react'
import type { MRT_ColumnDef } from 'mantine-react-table'
import type { Produto } from '../../types'

interface UseProdutosColumnsProps {
  themeColor: string
  togglingId: number | null
  deletingId: number | null
  handleToggleAtivo: (p: Produto) => void
  handleAbrirEdicao: (p: Produto) => void
  handleRemover: (id: number, nome: string) => void
}

export function useProdutosColumns({
  themeColor,
  togglingId,
  deletingId,
  handleToggleAtivo,
  handleAbrirEdicao,
  handleRemover,
}: UseProdutosColumnsProps) {
  return useMemo<MRT_ColumnDef<Produto>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Produto',
        size: 260,
        Cell: ({ cell, row }) => (
          <Text fw={600} size="xs" c={row.original.ativo === 0 ? 'dimmed' : undefined} truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'categoria',
        header: 'Categoria',
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return (
            <Text size="xs" c={!val ? 'dimmed' : undefined} truncate="end">
              {val || '-'}
            </Text>
          )
        },
      },
      {
        accessorKey: 'ativo',
        header: 'Status',
        size: 100,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Badge
            color={row.original.ativo === 0 ? 'gray' : 'teal'}
            variant={row.original.ativo === 0 ? 'light' : 'filled'}
            size="xs"
          >
            {row.original.ativo === 0 ? 'Inativo' : 'Ativo'}
          </Badge>
        ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 110,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const isAtivo = row.original.ativo !== 0
          return (
            <Group gap={4} wrap="nowrap" justify="center">
              <Tooltip label={isAtivo ? 'Desativar produto' : 'Ativar produto'}>
                <ActionIcon
                  color={isAtivo ? 'teal' : 'gray'}
                  variant="subtle"
                  size="sm"
                  loading={togglingId === row.original.id}
                  onClick={() => handleToggleAtivo(row.original)}
                >
                  <IconPower size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Editar produto">
                <ActionIcon
                  color={themeColor}
                  variant="subtle"
                  size="sm"
                  onClick={() => handleAbrirEdicao(row.original)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Excluir produto">
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="sm"
                  loading={deletingId === row.original.id}
                  onClick={() => handleRemover(row.original.id, row.original.nome)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [deletingId, togglingId, themeColor, handleToggleAtivo, handleAbrirEdicao, handleRemover],
  )
}
