import { Stack, TextInput, Radio, Group, Button } from '@mantine/core'
import { useForm } from '@mantine/form'
import { AppSelect } from '../../components/form/AppSelect'
import type { RodadaComMetricas } from '../../types'

interface RodadasFormProps {
  rodada?: RodadaComMetricas | null
  rodadas?: RodadaComMetricas[]
  onSave: (values: any) => Promise<void>
  onCancel: () => void
  loading: boolean
  themeColor?: string
}

export function RodadasForm({
  rodada,
  rodadas = [],
  onSave,
  onCancel,
  loading,
  themeColor = 'blue',
}: RodadasFormProps) {
  const isEdit = !!rodada
  
  const form = useForm({
    initialValues: {
      descricao: rodada?.descricao || '',
      status: rodada?.status || 'aberta',
      duplicar_de_id: null as string | null,
    },
    validate: {
      descricao: (val) => val.trim().length === 0 ? 'Informe um nome ou descrição para a rodada' : null,
    },
  })

  const handleSubmit = (values: typeof form.values) => {
    return onSave(values)
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="sm">
        <TextInput
          label="Descrição / Nome da Rodada"
          size="xs"
          placeholder={!isEdit ? "Ex: Cotação Mensal - Maio 2026" : undefined}
          required
          autoFocus
          {...form.getInputProps('descricao')}
        />

        <Radio.Group
          label={isEdit ? "Status da Rodada" : "Status Inicial"}
          size="xs"
          value={form.values.status}
          onChange={(val) => form.setFieldValue('status', val)}
        >
          <Group mt="xs">
            <Radio value="aberta" label={isEdit ? "Aberta" : "Aberta (Em cotação)"} color="teal" size="xs" />
            <Radio value="fechada" label="Fechada (Concluída)" color="gray" size="xs" />
            {isEdit && <Radio value="cancelada" label="Cancelada (Arquivada)" color="red" size="xs" />}
          </Group>
        </Radio.Group>

        {!isEdit && rodadas.length > 0 && (
          <AppSelect
            label="Duplicar Necessidades de Outra Rodada (Opcional)"
            size="xs"
            placeholder="Selecione para copiar itens em falta..."
            data={rodadas.map((r) => ({
              value: String(r.id),
              label: `${r.descricao} (${r.total_necessidades} itens)`,
            }))}
            clearable
            {...form.getInputProps('duplicar_de_id')}
          />
        )}

        <Group justify="flex-end" gap="xs" mt="md">
          <Button variant="subtle" color="gray" size="xs" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="filled" color={themeColor} size="xs" loading={loading}>
            {isEdit ? 'Salvar Alterações' : 'Criar Rodada'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
