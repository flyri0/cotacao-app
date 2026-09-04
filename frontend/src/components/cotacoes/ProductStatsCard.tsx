import {
  Badge,
  Group,
  Paper,
  Text,
} from '@mantine/core'
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import { formatMoney } from '../../utils'
import type { EstatisticasProduto } from '../../types'

interface ProductStatsCardProps {
  statsProduto: EstatisticasProduto | null
  precoUnitarioPreview: number
}

/**
 * Painel inteligente com resumo histórico e tendência de preço do produto em foco.
 */
export function ProductStatsCard({
  statsProduto,
  precoUnitarioPreview,
}: ProductStatsCardProps) {
  if (!statsProduto || statsProduto.total_cotacoes <= 0) return null

  return (
    <Paper withBorder p={4} radius="xs" bg="var(--mantine-color-body)">
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Group gap="xs">
          <Text size="10px" c="dimmed">
            Histórico: <b>{statsProduto.total_cotacoes}</b>
          </Text>
          <Text size="10px" c="dimmed">
            Menor: <Text span c="teal" fw={700}>{formatMoney(statsProduto.menor_preco)}</Text>
            {statsProduto.melhor_fornecedor && ` (${statsProduto.melhor_fornecedor})`}
          </Text>
          <Text size="10px" c="dimmed">
            Média: <b>{formatMoney(statsProduto.preco_medio)}</b>
          </Text>
        </Group>

        {precoUnitarioPreview > 0 && (
          <Group gap="xs">
            {precoUnitarioPreview < statsProduto.menor_preco ? (
              <Badge color="teal" size="xs" variant="filled" leftSection={<IconTrendingDown size={12} />}>
                🔥 NOVO RECORDE (-{(((statsProduto.menor_preco - precoUnitarioPreview) / statsProduto.menor_preco) * 100).toFixed(1)}%)
              </Badge>
            ) : precoUnitarioPreview <= statsProduto.preco_medio ? (
              <Badge color="teal" size="xs" variant="light" leftSection={<IconTrendingDown size={12} />}>
                ✓ Abaixo média (-{(((statsProduto.preco_medio - precoUnitarioPreview) / statsProduto.preco_medio) * 100).toFixed(1)}%)
              </Badge>
            ) : precoUnitarioPreview > statsProduto.maior_preco ? (
              <Badge color="red" size="xs" variant="filled" leftSection={<IconTrendingUp size={12} />}>
                🚨 MAIOR (+{(((precoUnitarioPreview - statsProduto.maior_preco) / statsProduto.maior_preco) * 100).toFixed(1)}%)
              </Badge>
            ) : (
              <Badge color="orange" size="xs" variant="light" leftSection={<IconTrendingUp size={12} />}>
                ⚠️ +{(((precoUnitarioPreview - statsProduto.preco_medio) / statsProduto.preco_medio) * 100).toFixed(1)}%
              </Badge>
            )}
          </Group>
        )}
      </Group>
    </Paper>
  )
}

export default ProductStatsCard
