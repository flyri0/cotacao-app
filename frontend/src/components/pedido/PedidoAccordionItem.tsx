import {
  Accordion,
  Badge,
  Button,
  Group,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core'
import {
  IconCopy,
  IconMail,
  IconPhone,
  IconPrinter,
  IconTruck,
  IconUser,
} from '@tabler/icons-react'
import { formatMoney } from '../../utils'
import { DanfeDocument, type PedidoPorFornecedor } from './DanfeDocument'
import type { Rodada } from '../../types'

interface PedidoAccordionItemProps {
  pedido: PedidoPorFornecedor
  estaOculto: boolean
  totalEmbalagensFechadas: number
  themeColor?: string
  rodadaAtual?: Rodada
  selectedRodadaId?: number | null
  onImprimirIndividual: (idFornecedor: number) => void
  onCopiarPedido: (texto: string, nomeForn: string) => void
}

export function PedidoAccordionItem({
  pedido,
  estaOculto,
  totalEmbalagensFechadas,
  themeColor = 'blue',
  rodadaAtual,
  selectedRodadaId,
  onImprimirIndividual,
  onCopiarPedido,
}: PedidoAccordionItemProps) {
  return (
    <Accordion.Item
      value={pedido.fornecedor.id.toString()}
      className={`pedido-ordem-compra ${estaOculto ? 'oculto-na-impressao' : ''}`}
      style={{
        backgroundColor: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-sm)',
      }}
    >
      {/* DOCUMENTO FORMAL DE IMPRESSÃO (ESTILO DANFE - PRINT ONLY) */}
      <DanfeDocument
        pedido={pedido}
        rodadaAtual={rodadaAtual}
        selectedRodadaId={selectedRodadaId}
        totalEmbalagensFechadas={totalEmbalagensFechadas}
      />

      {/* CABEÇALHO DA ABA / CONTROLE DO ACCORDION (NO-PRINT) */}
      <Accordion.Control className="no-print" py="xs">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm" style={{ width: '100%', paddingRight: 8 }}>
          <Group gap="xs" align="center" wrap="nowrap">
            <ThemeIcon color="teal" variant="light" size={28} radius="sm">
              <IconTruck size={16} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm">{pedido.fornecedor.nome}</Text>
              <Group gap="xs">
                {pedido.fornecedor.contato && (
                  <Text size="11px" c="dimmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <IconUser size={12} /> {pedido.fornecedor.contato}
                  </Text>
                )}
                {pedido.fornecedor.telefone && (
                  <Text size="11px" c="dimmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <IconPhone size={12} /> {pedido.fornecedor.telefone}
                  </Text>
                )}
                {pedido.fornecedor.email && (
                  <Text size="11px" c="dimmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <IconMail size={12} /> {pedido.fornecedor.email}
                  </Text>
                )}
              </Group>
            </div>
          </Group>

          <Group gap="xs" align="center" wrap="nowrap">
            {pedido.status_minimo === 'ok' && (
              <Badge color="teal" variant="filled" size="xs">
                ✓ Mínimo Ok (+{formatMoney(pedido.diferenca_minimo)})
              </Badge>
            )}
            {pedido.status_minimo === 'abaixo' && (
              <Badge color="red" variant="filled" size="xs">
                ⚠️ Abaixo Mínimo (-{formatMoney(pedido.diferenca_minimo)})
              </Badge>
            )}
            {pedido.status_minimo === 'sem_minimo' && (
              <Badge color="gray" variant="light" size="xs">
                Sem Mínimo
              </Badge>
            )}

            <Badge color={themeColor} variant="light" size="xs">
              {pedido.itens.length} {pedido.itens.length === 1 ? 'item' : 'itens'} ({totalEmbalagensFechadas} cx)
            </Badge>

            <Text fw={800} size="sm" c="teal" style={{ minWidth: 90, textAlign: 'right' }}>
              {formatMoney(pedido.total_pedido)}
            </Text>

            <Group gap={6} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="light"
                color="gray"
                size="xs"
                leftSection={<IconPrinter size={14} />}
                onClick={() => onImprimirIndividual(pedido.fornecedor.id)}
              >
                Imprimir
              </Button>

              <Button
                variant="light"
                color={themeColor}
                size="xs"
                leftSection={<IconCopy size={14} />}
                onClick={() =>
                  onCopiarPedido(
                    pedido.texto_formatado,
                    pedido.fornecedor.nome,
                  )
                }
              >
                Copiar
              </Button>
            </Group>
          </Group>
        </Group>
      </Accordion.Control>

      {/* CONTEÚDO DA ABA: TABELA EM LARGURA COMPLETA (NO-PRINT) */}
      <Accordion.Panel className="no-print">
        <Table withTableBorder striped highlightOnHover verticalSpacing={3} horizontalSpacing={8}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto / Item</Table.Th>
              <Table.Th>Embalagem</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Qtd Solicitada</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Comprar</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Qtd Total</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Preço Emb.</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Preço Unit.</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Subtotal</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pedido.itens.map((item) => (
              <Table.Tr key={item.id_produto}>
                <Table.Td>
                  <Text fw={600} size="xs">
                    {item.produto_nome}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="cyan" size="xs">
                    {item.marca ? `[${item.marca}] ` : ''}{item.embalagem}
                  </Badge>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="xs">
                    {item.quantidade_solicitada} {item.unidade}
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  <Badge color="indigo" variant="filled" size="xs">
                    {item.embalagens_comprar} cx/emb
                  </Badge>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="xs" fw={600}>
                    {item.quantidade_efetiva} {item.unidade}
                  </Text>
                  {item.sobra > 0 && (
                    <Text size="10px" c="blue">
                      (+{item.sobra} sobra)
                    </Text>
                  )}
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="xs">{formatMoney(item.preco_embalagem)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="xs" c="dimmed">
                    {formatMoney(item.preco_unitario)} / {item.unidade}
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={700} size="xs" c="teal.7">
                    {formatMoney(item.subtotal)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text fw={700} size="xs" ta="right">
                  VALOR TOTAL DO PEDIDO:
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text fw={800} size="sm" c="teal.7">
                  {formatMoney(pedido.total_pedido)}
                </Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

export default PedidoAccordionItem
