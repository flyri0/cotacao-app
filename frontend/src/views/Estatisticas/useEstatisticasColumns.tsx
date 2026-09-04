import { useMemo } from 'react'
import { Text, Badge } from '@mantine/core'
import { type MRT_ColumnDef } from 'mantine-react-table'
import type {
  CotacaoHistoricoItem,
  RankingFornecedorItem,
  HistoricoGlobalCotacaoItem,
} from '../../types'
import { formatMoney } from './utils'

export function useEstatisticasColumns() {
  const columnsHistoricoProd = useMemo<MRT_ColumnDef<CotacaoHistoricoItem>[]>(
    () => [
      {
        accessorKey: 'rodada_descricao',
        header: 'Rodada',
        size: 160,
        Cell: ({ row }) => (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <Text fw={600} size="xs" truncate="end">
              {row.original.rodada_descricao}
            </Text>
            <Text size="10px" c="dimmed" truncate="end">
              Data: {row.original.rodada_data}
            </Text>
          </div>
        ),
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
        Cell: ({ cell, row }) => (
          <Text size="xs">
            {cell.getValue<number>()} {row.original.unidade || 'UN'}
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
        Cell: ({ cell, row }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(cell.getValue<number>())} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
    ],
    [],
  )

  const columnsRankingProd = useMemo<MRT_ColumnDef<RankingFornecedorItem>[]>(
    () => [
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 200,
        Cell: ({ cell }) => (
          <Text fw={600} size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'total_ofertas',
        header: 'Cotações Enviadas',
        size: 160,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ cell }) => (
          <Text size="xs">
            {cell.getValue<number>()} {cell.getValue<number>() === 1 ? 'rodada' : 'rodadas'}
          </Text>
        ),
      },
      {
        accessorKey: 'menor_preco_oferecido',
        header: 'Menor Preço',
        size: 140,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_medio_oferecido',
        header: 'Preço Médio',
        size: 140,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs" c="dimmed">
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
    ],
    [],
  )

  const columnsHistoricoForn = useMemo<MRT_ColumnDef<CotacaoHistoricoItem>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto Ofertado',
        size: 200,
        Cell: ({ row }) => (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <Text fw={600} size="xs" truncate="end">
              {row.original.produto_nome}
            </Text>
            {row.original.produto_categoria && (
              <Text size="10px" c="dimmed" truncate="end">
                {row.original.produto_categoria}
              </Text>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'rodada_descricao',
        header: 'Rodada',
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
        Cell: ({ cell, row }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(cell.getValue<number>())} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
    ],
    [],
  )

  const columnsGlobal = useMemo<MRT_ColumnDef<HistoricoGlobalCotacaoItem>[]>(
    () => [
      {
        accessorKey: 'rodada_descricao',
        header: 'Rodada',
        size: 160,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 200,
        Cell: ({ row }) => (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <Text fw={600} size="xs" truncate="end">
              {row.original.produto_nome}
            </Text>
            {row.original.produto_categoria && (
              <Text size="10px" c="dimmed" truncate="end">
                {row.original.produto_categoria}
              </Text>
            )}
          </div>
        ),
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
        Cell: ({ row }) => (
          <Text size="xs" truncate="end">
            {row.original.marca ? `[${row.original.marca}] ` : ''}{row.original.embalagem}
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
        Cell: ({ cell, row }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(cell.getValue<number>())} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        accessorKey: 'foi_alocado',
        header: 'Status Compra',
        size: 140,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ cell }) => {
          const comprado = !!cell.getValue<boolean>()
          return comprado ? (
            <Badge color="teal" variant="filled" size="xs">
              ✓ Comprado
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="xs">
              Cotado
            </Badge>
          )
        },
      },
    ],
    [],
  )

  return {
    columnsHistoricoProd,
    columnsRankingProd,
    columnsHistoricoForn,
    columnsGlobal,
  }
}
