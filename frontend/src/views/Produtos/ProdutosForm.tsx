import { Group, Button, TextInput, Kbd } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { AppAutocomplete } from '../../components/form/AppSelect'
import { SectionCard } from '../../components/ui/SectionCard'
import type { UseFormReturnType } from '@mantine/form'
import type { RefObject } from 'react'

interface ProdutosFormProps {
  form: UseFormReturnType<{ nome: string; categoria: string }>
  handleSubmit: (values: { nome: string; categoria: string }) => Promise<void>
  submitting: boolean
  themeColor?: string
  categoriasSugeridas: string[]
  nomeRef: RefObject<HTMLInputElement | null>
  categoriaRef: RefObject<HTMLInputElement | null>
}

export function ProdutosForm({
  form,
  handleSubmit,
  submitting,
  themeColor = 'blue',
  categoriasSugeridas,
  nomeRef,
  categoriaRef,
}: ProdutosFormProps) {
  return (
    <SectionCard
      title="Novo Produto"
      subtitle="Preencha e tecle Enter para salvar"
      kbdHint="Enter"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Group align="flex-end" gap="xs">
          <TextInput
            ref={nomeRef}
            label="Nome do Produto"
            size="xs"
            placeholder="Ex: Detergente Neutro 500ml"
            required
            style={{ flex: 2 }}
            {...form.getInputProps('nome')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (form.values.nome.trim()) {
                  categoriaRef.current?.focus()
                }
              }
            }}
          />
          <AppAutocomplete
            ref={categoriaRef}
            label="Categoria"
            size="xs"
            placeholder="Ex: Limpeza, Descartáveis"
            data={categoriasSugeridas}
            style={{ flex: 1.5 }}
            {...form.getInputProps('categoria')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                form.onSubmit(handleSubmit)()
              }
            }}
          />
          <Button
            type="submit"
            variant="filled"
            color={themeColor}
            size="xs"
            leftSection={<IconPlus size={14} />}
            loading={submitting}
          >
            Adicionar <Kbd ml={4} size="xs">Enter</Kbd>
          </Button>
        </Group>
      </form>
    </SectionCard>
  )
}
