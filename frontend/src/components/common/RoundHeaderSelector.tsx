import { Badge, Button, Group, Tooltip } from '@mantine/core'
import { IconLock, IconLockOpen, IconPlus, IconRotate } from '@tabler/icons-react'
import { AppSelect } from './AppSelect'
import type { Rodada } from '../../types'

interface RoundHeaderSelectorProps {
  rodadas: Rodada[]
  selectedRodadaId: number | null
  onSelectRodada: (id: number) => void
  onNovaRodadaClick?: () => void
  disabled?: boolean
}

export function RoundHeaderSelector({
  rodadas,
  selectedRodadaId,
  onSelectRodada,
  onNovaRodadaClick,
  disabled = false,
}: RoundHeaderSelectorProps) {
  const rodadaSelecionada = rodadas.find((r) => r.id === selectedRodadaId)
  const isAberta = rodadaSelecionada?.status === 'aberta'

  return (
    <Group gap="xs" align="center">
      <AppSelect
        placeholder="Selecione a rodada..."
        leftSection={<IconRotate size={16} />}
        data={rodadas.map((r) => ({
          value: r.id.toString(),
          label: `${r.descricao} (${r.status === 'aberta' ? 'Aberta' : 'Fechada'})`,
        }))}
        value={selectedRodadaId ? selectedRodadaId.toString() : null}
        onChange={(val) => {
          if (val) onSelectRodada(parseInt(val, 10))
        }}
        style={{ width: 280 }}
        size="sm"
        allowDeselect={false}
        disabled={disabled}
      />

      {rodadaSelecionada && (
        <Tooltip label={isAberta ? 'Rodada aberta para compras' : 'Rodada finalizada/fechada'}>
          <Badge
            color={isAberta ? 'green' : 'gray'}
            variant={isAberta ? 'light' : 'outline'}
            size="md"
            leftSection={isAberta ? <IconLockOpen size={12} /> : <IconLock size={12} />}
          >
            {isAberta ? 'Aberta' : 'Fechada'}
          </Badge>
        </Tooltip>
      )}

      {onNovaRodadaClick && (
        <Tooltip label="Criar nova rodada de cotação">
          <Button
            variant="light"
            color="blue"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={onNovaRodadaClick}
          >
            Nova
          </Button>
        </Tooltip>
      )}
    </Group>
  )
}

export default RoundHeaderSelector
