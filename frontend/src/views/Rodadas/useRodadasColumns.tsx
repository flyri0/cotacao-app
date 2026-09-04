import { useMemo } from 'react'
import type { MRT_ColumnDef } from 'mantine-react-table'
import { Badge, Text, Group, Button, ActionIcon, Tooltip } from '@mantine/core'
import {
  IconChecklist,
  IconLock,
  IconLockOpen,
  IconRotate,
  IconBan,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react'
import type { RodadaComMetricas } from '../../types'

interface UseRodadasColumnsProps {
  rodadaAtivaId?: number
  themeColor: string
  onSelecionarRodada: (id: number, aba: string) => void
  onToggleStatus: (r: RodadaComMetricas) => void
  onEdit: (r: RodadaComMetricas) => void
  onDelete: (r: RodadaComMetricas) => void
}

export function useRodadasColumns({
  rodadaAtivaId,
  themeColor,
  onSelecionarRodada,
  onToggleStatus,
  onEdit,
  onDelete,
}: UseRodadasColumnsProps) {
  // Formatação de Moeda e Data
  const formatMoney = (val?: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-'
    try {
      const parts = isoStr.split(' ')
      const [ano, mes, dia] = parts[0].split('-')
      return `${dia}/${mes}/${ano}`
    } catch {
      return isoStr
    }
  }

  const columns = useMemo<MRT_ColumnDef<RodadaComMetricas>[]>(
    () => [
      {
        accessorKey: 'descricao',
        header: 'Descrição / Nome da Rodada',
        Cell: ({ row }) => {
          const r = row.original
          const isAtiva = r.id === rodadaAtivaId
          const isCancelada = r.status === 'cancelada'

          return (
            <Group gap="xs">
              <Text size="xs" fw={isAtiva ? 700 : 500} c={isCancelada ? 'dimmed' : undefined}>
                {r.descricao}
              </Text>
              {isAtiva && (
                <Badge variant="filled" color="blue" size="xs">
                  Ativa
                </Badge>
              )}
            </Group>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 110,
        Cell: ({ row }) => {
          const r = row.original
          const isAberta = r.status === 'aberta'
          const isCancelada = r.status === 'cancelada'

          if (isAberta)
            return (
              <Badge color="green" variant="light" size="xs" leftSection={<IconLockOpen size={11} />}>
                Aberta
              </Badge>
            )
          if (r.status === 'fechada')
            return (
              <Badge color="gray" variant="outline" size="xs" leftSection={<IconLock size={11} />}>
                Fechada
              </Badge>
            )
          if (isCancelada)
            return (
              <Badge color="red" variant="light" size="sm" leftSection={<IconBan size={12} />}>
                Cancelada
              </Badge>
            )
          return null
        },
      },
      {
        accessorKey: 'data_criacao',
        header: 'Criada em',
        size: 100,
        Cell: ({ row }) => (
          <Text size="xs" c="dimmed">
            {formatDate(row.original.data_criacao)}
          </Text>
        ),
      },
      {
        accessorKey: 'total_necessidades',
        header: 'Produtos',
        size: 100,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Badge variant="light" color="cyan" size="sm">
            {row.original.total_necessidades} itens
          </Badge>
        ),
      },
      {
        accessorKey: 'total_cotacoes',
        header: 'Cotações',
        size: 100,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Badge variant="light" color="indigo" size="sm">
            {row.original.total_cotacoes} cotações
          </Badge>
        ),
      },
      {
        accessorKey: 'valor_total_alocado',
        header: 'Total Alocado',
        size: 130,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => {
          const r = row.original
          const isCancelada = r.status === 'cancelada'
          return (
            <Text size="sm" fw={700} c={r.valor_total_alocado > 0 && !isCancelada ? 'teal.7' : 'dimmed'}>
              {formatMoney(r.valor_total_alocado)}
            </Text>
          )
        },
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 190,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const r = row.original
          const isAtiva = r.id === rodadaAtivaId
          const isAberta = r.status === 'aberta'
          const isCancelada = r.status === 'cancelada'

          return (
            <Group gap={4} justify="center" wrap="nowrap">
              <Tooltip label="Definir como rodada ativa e ir para Necessidades">
                <Button
                  size="compact-xs"
                  variant={isAtiva ? 'filled' : 'light'}
                  color={themeColor}
                  leftSection={<IconChecklist size={13} />}
                  onClick={() => onSelecionarRodada(r.id, 'necessidades')}
                >
                  Abrir
                </Button>
              </Tooltip>

              <Tooltip
                label={
                  isAberta
                    ? 'Fechar / Concluir rodada'
                    : isCancelada
                    ? 'Reativar rodada'
                    : 'Reabrir rodada'
                }
              >
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color={isAberta ? 'gray' : 'teal'}
                  onClick={() => onToggleStatus(r)}
                >
                  {isAberta ? (
                    <IconLock size={15} />
                  ) : isCancelada ? (
                    <IconRotate size={15} />
                  ) : (
                    <IconLockOpen size={15} />
                  )}
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Editar rodada">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color={themeColor}
                  onClick={() => onEdit(r)}
                >
                  <IconEdit size={15} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Excluir rodada permanentemente">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => onDelete(r)}
                >
                  <IconTrash size={15} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [rodadaAtivaId, themeColor, onSelecionarRodada, onToggleStatus, onEdit, onDelete]
  )

  return columns
}
