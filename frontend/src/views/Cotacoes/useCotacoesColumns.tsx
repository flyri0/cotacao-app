import { useMemo } from 'react'
import { ActionIcon, Group, Text, Tooltip } from '@mantine/core'
import { IconEdit, IconTrash } from '@tabler/icons-react'
import { type MRT_ColumnDef } from 'mantine-react-table'
import type { Cotacao } from '../../types'

// Helper para formatação
function formatMoney(valor: number, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

interface UseCotacoesColumnsProps {
  isFechada: boolean
  themeColor: string
  deletingId: number | null
  onEdit: (cotacao: Cotacao) => void
  onRemove: (id: number, produtoNome: string, fornecedorNome: string) => void
}

export function useCotacoesColumns({
  isFechada,
  themeColor,
  deletingId,
  onEdit,
  onRemove,
}: UseCotacoesColumnsProps) {
  const columns = useMemo<MRT_ColumnDef<Cotacao>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 220,
        Cell: ({ cell }) => (
          <Text fw={600} size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'marca',
        header: 'Marca',
        size: 110,
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
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 160,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem',
        size: 140,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'qtd_por_embalagem',
        header: 'Qtd / Emb.',
        size: 110,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => (
          <Text size="xs">
            {row.original.qtd_por_embalagem} {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb.',
        size: 130,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs">
            {formatMoney(cell.getValue<number>(), 2)}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário',
        size: 150,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(row.original.preco_unitario)} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 85,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const item = row.original
          return (
            <Group gap={4} justify="center" wrap="nowrap">
              <Tooltip label={`Editar cotação de "${item.produto_nome}"`}>
                <ActionIcon
                  variant="subtle"
                  color={themeColor}
                  size="sm"
                  disabled={isFechada}
                  onClick={() => onEdit(item)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Remover esta cotação">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  loading={deletingId === item.id}
                  disabled={isFechada}
                  onClick={() =>
                    onRemove(
                      item.id,
                      item.produto_nome,
                      item.fornecedor_nome,
                    )
                  }
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [deletingId, isFechada, themeColor, onEdit, onRemove],
  )

  return columns
}
