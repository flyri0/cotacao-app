import { useMemo } from 'react'
import { Badge, Group, Paper, Progress, Stack, Table, Text } from '@mantine/core'
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react'
import { type MRT_ColumnDef } from 'mantine-react-table'
import { formatMoney } from './utils'
import type { ResumoFornecedorRow } from './types'

export function useResumoColumns() {
  const columns = useMemo<MRT_ColumnDef<ResumoFornecedorRow>[]>(
    () => [
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 200,
        Cell: ({ cell, row }) => (
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <Text fw={600} size="xs" truncate="end">
              {cell.getValue<string>()}
            </Text>
            <Text size="10px" c="dimmed" truncate="end">
              {row.original.itens_comprados_count}{' '}
              {row.original.itens_comprados_count === 1 ? 'item alocado' : 'itens alocados'}
            </Text>
          </div>
        ),
      },
      {
        accessorKey: 'total_alocado',
        header: 'Total Alocado',
        size: 140,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell, row }) => (
          <Text
            fw={700}
            size="xs"
            c={
              row.original.status === 'ok'
                ? 'teal'
                : row.original.status === 'abaixo'
                ? 'red'
                : 'dimmed'
            }
          >
            {formatMoney(cell.getValue<number>())}
          </Text>
        ),
      },
      {
        accessorKey: 'pedido_minimo',
        header: 'Pedido Mínimo',
        size: 140,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs" c={cell.getValue<number>() > 0 ? undefined : 'dimmed'}>
            {cell.getValue<number>() > 0
              ? formatMoney(cell.getValue<number>())
              : 'Sem mínimo'}
          </Text>
        ),
      },
      {
        id: 'progresso',
        header: 'Meta Mínima',
        size: 180,
        Cell: ({ row }) => {
          const { pedido_minimo, total_alocado, percentual_atingido, status } =
            row.original

          if (pedido_minimo === 0) {
            return (
              <Badge variant="light" color="gray" size="xs">
                Livre
              </Badge>
            )
          }

          const color =
            status === 'ok' ? 'teal' : status === 'abaixo' ? 'red' : 'gray'

          return (
            <Stack gap={2} style={{ width: '100%', overflow: 'hidden' }}>
              <Group justify="space-between" gap="xs">
                <Text size="10px" fw={600} c={`${color}.8`}>
                  {percentual_atingido.toFixed(0)}%
                </Text>
                <Text size="10px" c="dimmed">
                  {formatMoney(total_alocado)} / {formatMoney(pedido_minimo)}
                </Text>
              </Group>
              <Progress
                value={percentual_atingido}
                color={color}
                size="xs"
                radius="xl"
                striped={status === 'abaixo'}
                animated={status === 'abaixo'}
              />
            </Stack>
          )
        },
      },
      {
        id: 'status_minimo',
        header: 'Status do Mínimo',
        size: 180,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const { status, diferenca } = row.original

          if (status === 'ok') {
            return (
              <Badge
                leftSection={<IconCheck size={10} />}
                color="teal"
                variant="light"
                size="xs"
              >
                Atingido
              </Badge>
            )
          }

          if (status === 'abaixo') {
            return (
              <Badge
                leftSection={<IconAlertTriangle size={10} />}
                color="red"
                variant="light"
                size="xs"
              >
                Falta {formatMoney(Math.abs(diferenca))}
              </Badge>
            )
          }

          return (
            <Badge color="gray" variant="light" size="xs">
              Sem Compras
            </Badge>
          )
        },
      },
    ],
    [],
  )

  const renderDetailPanel = ({ row }: { row: { original: ResumoFornecedorRow } }) => {
    const { itens_detalhes, fornecedor_nome } = row.original
    if (!itens_detalhes || itens_detalhes.length === 0) {
      return (
        <Text size="xs" c="dimmed" p="xs">
          Nenhum item alocado para este fornecedor.
        </Text>
      )
    }

    return (
      <Paper p="xs" withBorder radius="xs" bg="var(--mantine-color-default-hover)">
        <Text size="xs" fw={700} mb="xs">
          Itens Alocados para {fornecedor_nome}:
        </Text>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Qtd Solicitada</Table.Th>
              <Table.Th>Compra Efetiva (Embalagem)</Table.Th>
              <Table.Th>Subtotal</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itens_detalhes.map((item, idx) => (
              <Table.Tr key={idx}>
                <Table.Td>
                  <b>{item.produto_nome}</b>
                </Table.Td>
                <Table.Td>
                  {item.quantidade} {item.unidade}
                </Table.Td>
                <Table.Td>
                  {item.embalagens}x ({item.embalagem_desc})
                </Table.Td>
                <Table.Td>
                  <b>{formatMoney(item.subtotal)}</b>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    )
  }

  return { columns, renderDetailPanel }
}
