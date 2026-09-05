import {
  Group,
  Kbd,
  Modal,
  Table,
  Text,
} from '@mantine/core'
import { IconKeyboard } from '@tabler/icons-react'

interface HelpShortcutsModalProps {
  opened: boolean
  onClose: () => void
}

export function HelpShortcutsModal({ opened, onClose }: HelpShortcutsModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconKeyboard size={18} />
          <Text fw={700}>Atalhos de Teclado do Sistema</Text>
        </Group>
      }
      size="md"
      radius="sm"
      centered
    >
      <Table withTableBorder striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Atalho</Table.Th>
            <Table.Th>Ação</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>1</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Produtos</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>2</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Fornecedores</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>3</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Necessidades</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>4</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Cotações</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>5</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Comparação (Matriz Excel)</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>6</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Alocação</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>7</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Resumo por Fornecedor</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>8</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Gerar Pedido</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>9</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Estatísticas & Histórico</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>0</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Ir para tela de <b>Configurações & Banco</b></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>+</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Aumentar tamanho da fonte do sistema (+0.5px)</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>-</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Diminuir tamanho da fonte do sistema (-0.5px)</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Forçar sincronização das compras (já salvo automaticamente)</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Group gap={4}>
                <Kbd>F1</Kbd> ou <Kbd>Ctrl+K</Kbd>
              </Group>
            </Table.Td>
            <Table.Td>Abrir este guia de atalhos rápidos</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>
              <Kbd>Esc</Kbd>
            </Table.Td>
            <Table.Td>Fechar modal ou limpar seleção</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Modal>
  )
}

export default HelpShortcutsModal
