import {
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconEdit } from '@tabler/icons-react'
import { AppSelect } from '../common'
import type { Fornecedor } from '../../types'

interface BatchQuotesModalProps {
  opened: boolean
  onClose: () => void
  selectedCount: number
  fornecedores: Fornecedor[]
  fornecedorId: string | null
  onChangeFornecedorId: (id: string | null) => void
  marca: string
  onChangeMarca: (marca: string) => void
  embalagem: string
  onChangeEmbalagem: (emb: string) => void
  qtdEmbalagem: number | string
  onChangeQtdEmbalagem: (val: number | string) => void
  unidade: string
  onChangeUnidade: (un: string) => void
  reajustePct: number | string
  onChangeReajustePct: (val: number | string) => void
  onConfirm: () => void
  loading?: boolean
  themeColor?: string
}

export function BatchQuotesModal({
  opened,
  onClose,
  selectedCount,
  fornecedores,
  fornecedorId,
  onChangeFornecedorId,
  marca,
  onChangeMarca,
  embalagem,
  onChangeEmbalagem,
  qtdEmbalagem,
  onChangeQtdEmbalagem,
  unidade,
  onChangeUnidade,
  reajustePct,
  onChangeReajustePct,
  onConfirm,
  loading = false,
  themeColor = 'blue',
}: BatchQuotesModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconEdit size={18} />
          <Text fw={700}>
            Editar Informações em Massa ({selectedCount} cotação{selectedCount > 1 ? 'ões' : ''})
          </Text>
        </Group>
      }
      centered
      radius="sm"
      size="lg"
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Preencha apenas os campos que deseja alterar em todas as cotações selecionadas. Os campos em branco manterão seus valores originais.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <AppSelect
            label="Mudar Fornecedor"
            size="xs"
            placeholder="Manter fornecedor atual"
            data={fornecedores.map((f) => ({ value: String(f.id), label: f.nome }))}
            value={fornecedorId}
            onChange={onChangeFornecedorId}
            clearable
          />

          <TextInput
            label="Definir Marca"
            size="xs"
            placeholder="Ex: Ypê, Bombril (opcional)"
            value={marca}
            onChange={(e) => onChangeMarca(e.currentTarget.value)}
          />

          <TextInput
            label="Descrição da Embalagem"
            size="xs"
            placeholder="Ex: Caixa c/ 12, Galão 5L"
            value={embalagem}
            onChange={(e) => onChangeEmbalagem(e.currentTarget.value)}
          />

          <Group grow gap="xs">
            <NumberInput
              label="Qtd na Emb."
              size="xs"
              placeholder="Ex: 12"
              min={0.01}
              value={qtdEmbalagem}
              onChange={onChangeQtdEmbalagem}
            />
            <TextInput
              label="Unidade"
              size="xs"
              placeholder="UN, CX, KG"
              value={unidade}
              onChange={(e) => onChangeUnidade(e.currentTarget.value)}
            />
          </Group>
        </SimpleGrid>

        <Paper withBorder p="xs" radius="sm" mt="xs">
          <Text size="xs" fw={700} mb={4}>
            Reajuste Percentual de Preço (%)
          </Text>
          <Text size="11px" c="dimmed" mb="xs">
            Aplica um acréscimo ou desconto percentual sobre o preço da embalagem de cada item selecionado (ex: +5% para reajuste de tabela ou -10% para desconto especial).
          </Text>
          <NumberInput
            size="xs"
            placeholder="Ex: 5 para +5%, -10 para -10%"
            value={reajustePct}
            onChange={onChangeReajustePct}
            suffix="%"
            decimalScale={2}
          />
        </Paper>

        <Group justify="flex-end" gap="xs" mt="md">
          <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="filled"
            color={themeColor}
            size="xs"
            loading={loading}
            onClick={onConfirm}
          >
            Aplicar a Todas
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default BatchQuotesModal
