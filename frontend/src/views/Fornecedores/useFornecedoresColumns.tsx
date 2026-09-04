import { useMemo } from 'react'
import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core'
import { IconEdit, IconPower, IconTrash } from '@tabler/icons-react'
import { type MRT_ColumnDef } from 'mantine-react-table'
import type { Fornecedor } from '../../types'

function formatMoney(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0)
}

interface UseFornecedoresColumnsProps {
  themeColor: string
  togglingId: number | null
  deletingId: number | null
  onToggleAtivo: (fornecedor: Fornecedor) => void
  onAbrirEdicao: (fornecedor: Fornecedor) => void
  onRemover: (id: number, nome: string) => void
}

export function useFornecedoresColumns({
  themeColor,
  togglingId,
  deletingId,
  onToggleAtivo,
  onAbrirEdicao,
  onRemover,
}: UseFornecedoresColumnsProps) {
  const columns = useMemo<MRT_ColumnDef<Fornecedor>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Fornecedor',
        size: 220,
        Cell: ({ cell, row }) => (
          <Text fw={600} size="xs" c={row.original.ativo === 0 ? 'dimmed' : undefined} truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'contato',
        header: 'Contato',
        size: 140,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end" c={!cell.getValue() ? 'dimmed' : undefined}>
            {cell.getValue<string | null>() || '-'}
          </Text>
        ),
      },
      {
        accessorKey: 'telefone',
        header: 'Telefone / WhatsApp',
        size: 180,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end" c={!cell.getValue() ? 'dimmed' : undefined}>
            {cell.getValue<string | null>() || '-'}
          </Text>
        ),
      },
      {
        accessorKey: 'email',
        header: 'E-mail',
        size: 180,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return (
            <Text size="xs" truncate="end" c={val ? 'blue' : 'dimmed'}>
              {val || '-'}
            </Text>
          )
        },
      },
      {
        accessorKey: 'pedido_minimo',
        header: 'Pedido Mínimo',
        size: 150,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => {
          const val = cell.getValue<number>()
          return (
            <Text size="xs" fw={val > 0 ? 600 : 400} c={val > 0 ? undefined : 'dimmed'}>
              {formatMoney(val)}
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
              <Tooltip label={isAtivo ? 'Desativar fornecedor' : 'Ativar fornecedor'}>
                <ActionIcon
                  color={isAtivo ? 'teal' : 'gray'}
                  variant="subtle"
                  size="sm"
                  loading={togglingId === row.original.id}
                  onClick={() => onToggleAtivo(row.original)}
                >
                  <IconPower size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Editar fornecedor">
                <ActionIcon
                  color={themeColor}
                  variant="subtle"
                  size="sm"
                  onClick={() => onAbrirEdicao(row.original)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Excluir fornecedor">
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="sm"
                  loading={deletingId === row.original.id}
                  onClick={() => onRemover(row.original.id, row.original.nome)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [deletingId, togglingId, themeColor, onToggleAtivo, onAbrirEdicao, onRemover],
  )

  return columns
}
