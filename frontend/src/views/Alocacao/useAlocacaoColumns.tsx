import { useMemo } from 'react'
import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core'
import { IconArrowsSplit, IconTrash } from '@tabler/icons-react'
import { type MRT_ColumnDef } from 'mantine-react-table'
import { AppSelect } from '../../components/form/AppSelect'
import { QuantityInput } from '../../components/form/QuantityInput'
import type { Cotacao, Fornecedor } from '../../types'
import type { LinhaAlocacao } from './index'
import { formatMoney } from './index'

interface UseAlocacaoColumnsProps {
  cotacoes: Cotacao[]
  fornecedores: Fornecedor[]
  menoresPrecosPorProduto: Map<number, number>
  isFechada: boolean
  themeColor: string
  handleDividirLinha: (key: string) => void
  handleRemoverLinha: (key: string, produtoNome: string) => void
  handleUpdateQtd: (key: string, valor: number | string) => void
  handleUpdateFornecedor: (key: string, idFornStr: string | null) => void
}

export function useAlocacaoColumns({
  cotacoes,
  fornecedores,
  menoresPrecosPorProduto,
  isFechada,
  themeColor,
  handleDividirLinha,
  handleRemoverLinha,
  handleUpdateQtd,
  handleUpdateFornecedor,
}: UseAlocacaoColumnsProps) {
  return useMemo<MRT_ColumnDef<LinhaAlocacao>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 220,
        Cell: ({ row, table }) => {
          const item = row.original
          const allRows = (table.options.data as LinhaAlocacao[]) || []
          const linhasDoProd = allRows.filter((l) => l.id_produto === item.id_produto)
          const isDividido = linhasDoProd.length > 1
          const subIndex = isDividido
            ? linhasDoProd.findIndex((l) => l.key === item.key) + 1
            : 0

          return (
            <Group gap={6} wrap="nowrap">
              <Text fw={600} size="xs" truncate="end" style={{ flex: 1 }}>
                {item.produto_nome}
              </Text>
              {isDividido && (
                <Badge
                  size="xs"
                  variant="light"
                  color={subIndex === 1 ? 'gray' : 'blue'}
                  style={{ flexShrink: 0 }}
                >
                  Parte {subIndex}/{linhasDoProd.length}
                </Badge>
              )}
            </Group>
          )
        },
      },
      {
        accessorKey: 'quantidade_alocada',
        header: 'Qtd a Comprar',
        size: 95,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => {
          const item = row.original
          return (
            <QuantityInput
              initialValue={item.quantidade_alocada}
              onChangeLive={(val) => handleUpdateQtd(item.key, val)}
              disabled={isFechada}
              width={75}
            />
          )
        },
      },
      {
        accessorKey: 'id_fornecedor',
        header: 'Fornecedor',
        size: 220,
        Cell: ({ row }) => {
          const item = row.original
          const cotsDoProd = cotacoes.filter(
            (c) => c.id_produto === item.id_produto,
          )
          const menorPreco = menoresPrecosPorProduto.get(item.id_produto)

          const options = cotsDoProd.map((c) => {
            const isMenor = menorPreco !== undefined && c.preco_unitario <= menorPreco
            return {
              value: c.id_fornecedor.toString(),
              label: `${c.fornecedor_nome}${c.marca ? ` [${c.marca}]` : ''}${isMenor ? ' ⭐ (Melhor Preço)' : ''}`,
            }
          })

          if (options.length === 0) {
            fornecedores.forEach((f) => {
              options.push({
                value: f.id.toString(),
                label: `${f.nome} (Sem cotação)`,
              })
            })
          }

          return (
            <AppSelect
              data={options}
              value={item.id_fornecedor ? item.id_fornecedor.toString() : null}
              onChange={(val) => handleUpdateFornecedor(item.key, val)}
              placeholder="Selecione o fornecedor..."
              size="xs"
              searchable
              disabled={isFechada}
              clearable={false}
              style={{ width: '100%' }}
            />
          )
        },
      },
      {
        id: 'preco_unitario',
        header: 'Preço Unitário',
        size: 150,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || !cot) {
            return (
              <Text size="xs" c="dimmed">
                -
              </Text>
            )
          }

          const menorPreco = menoresPrecosPorProduto.get(item.id_produto)
          const isMenor = menorPreco !== undefined && cot.preco_unitario <= menorPreco

          return (
            <div style={{ textAlign: 'right', width: '100%', overflow: 'hidden' }}>
              <Text fw={700} size="xs" c={isMenor ? 'teal' : undefined} style={{ whiteSpace: 'nowrap' }}>
                {formatMoney(cot.preco_unitario)} / {cot.unidade || 'UN'}
              </Text>
              {isMenor ? (
                <Text size="10px" c="teal" fw={600} style={{ whiteSpace: 'nowrap' }}>
                  ⭐ Menor Preço
                </Text>
              ) : menorPreco && menorPreco > 0 ? (
                <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  +{(((cot.preco_unitario - menorPreco) / menorPreco) * 100).toFixed(0)}% vs menor
                </Text>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'embalagem_cotada',
        header: 'Embalagem',
        size: 160,
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || !cot) {
            return (
              <Text size="xs" c="dimmed">
                -
              </Text>
            )
          }

          return (
            <div style={{ width: '100%', overflow: 'hidden' }}>
              <Text size="xs" fw={600} truncate="end">
                {cot.marca ? `[${cot.marca}] ` : ''}{cot.embalagem}
              </Text>
              <Text size="10px" c="dimmed" truncate="end">
                {formatMoney(cot.preco_embalagem)} ({cot.qtd_por_embalagem} {cot.unidade || 'UN'})
              </Text>
            </div>
          )
        },
      },
      {
        id: 'embalagens_comprar',
        header: 'Compra Efetiva',
        size: 160,
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || item.quantidade_alocada <= 0 || !cot) {
            return (
              <Text size="xs" c="dimmed">
                -
              </Text>
            )
          }

          const fator =
            cot.qtd_por_embalagem > 0 ? cot.qtd_por_embalagem : 1
          const embComprar = Math.ceil(item.quantidade_alocada / fator)
          const totalEfetivo = embComprar * fator
          const diferenca = totalEfetivo - item.quantidade_alocada

          return (
            <div style={{ width: '100%', overflow: 'hidden' }}>
              <Text size="xs" fw={600} truncate="end">
                {embComprar} {embComprar === 1 ? 'embalagem' : 'embalagens'}
              </Text>
              <Text size="10px" c="dimmed" truncate="end">
                Total: <b>{totalEfetivo}</b> {cot.unidade || 'UN'}
                {diferenca > 0 && (
                  <Text span c={themeColor} fw={600}>
                    {' '}
                    (+{diferenca} sobra)
                  </Text>
                )}
              </Text>
            </div>
          )
        },
      },
      {
        id: 'subtotal',
        header: 'Subtotal',
        size: 130,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => {
          const item = row.original
          const cot = cotacoes.find(
            (c) =>
              c.id_produto === item.id_produto &&
              c.id_fornecedor === item.id_fornecedor,
          )

          if (!item.id_fornecedor || item.quantidade_alocada <= 0 || !cot) {
            return (
              <Text size="xs" c="dimmed">
                R$ 0,00
              </Text>
            )
          }

          const fator =
            cot.qtd_por_embalagem > 0 ? cot.qtd_por_embalagem : 1
          const embComprar = Math.ceil(item.quantidade_alocada / fator)
          const subtotal = embComprar * cot.preco_embalagem

          return (
            <Text fw={700} size="xs" c="teal">
              {formatMoney(subtotal)}
            </Text>
          )
        },
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
              <Tooltip label="Dividir este item em outro fornecedor">
                <ActionIcon
                  variant="subtle"
                  color={themeColor}
                  size="sm"
                  disabled={isFechada}
                  onClick={() => handleDividirLinha(item.key)}
                >
                  <IconArrowsSplit size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Remover esta linha de alocação">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  disabled={isFechada}
                  onClick={() => handleRemoverLinha(item.key, item.produto_nome)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [
      cotacoes,
      fornecedores,
      menoresPrecosPorProduto,
      isFechada,
      themeColor,
      handleDividirLinha,
      handleRemoverLinha,
      handleUpdateQtd,
      handleUpdateFornecedor,
    ],
  )
}
