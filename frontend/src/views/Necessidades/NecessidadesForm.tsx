import { useRef, useMemo, useEffect } from 'react'
import { Badge, Button, Group, Kbd } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconPlus } from '@tabler/icons-react'
import { SectionCard } from '../../components/ui/SectionCard'
import { AppAutocomplete } from '../../components/form/AppSelect'
import type { Produto } from '../../types'

interface NecessidadesFormProps {
  isFechada: boolean
  submitting: boolean
  themeColor: string
  produtos: Produto[]
  nomesProdutosDisponiveis: string[]
  onSubmit: (nomeProduto: string) => Promise<void>
}

export function NecessidadesForm({
  isFechada,
  submitting,
  themeColor,
  produtos,
  nomesProdutosDisponiveis,
  onSubmit,
}: NecessidadesFormProps) {
  const produtoInputRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    initialValues: {
      produtoNome: '',
    },
    validate: {
      produtoNome: (value) =>
        value.trim().length === 0 ? 'Informe o nome do produto' : null,
    },
  })

  const produtoSelecionado = useMemo(() => {
    return produtos.find(
      (p) =>
        p.nome.trim().toLowerCase() === form.values.produtoNome.trim().toLowerCase(),
    )
  }, [produtos, form.values.produtoNome])

  useEffect(() => {
    setTimeout(() => produtoInputRef.current?.focus(), 150)
  }, [])

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await onSubmit(values.produtoNome)
      form.setFieldValue('produtoNome', '')
    } catch (e) {
      // Error is handled by parent, we still want to keep the form state or let the user fix it
    } finally {
      setTimeout(() => {
        produtoInputRef.current?.focus()
      }, 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (form.values.produtoNome.trim()) {
        handleSubmit({ produtoNome: form.values.produtoNome })
      }
    }
  }

  const handleOptionSubmit = (val: string) => {
    form.setFieldValue('produtoNome', val)
    handleSubmit({ produtoNome: val })
  }

  return (
    <SectionCard
      title="Adicionar Produto à Rodada"
      subtitle="Pressione Enter para incluir"
      kbdHint="Enter"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <fieldset disabled={isFechada} style={{ border: 'none', padding: 0, margin: 0 }}>
          <Group align="flex-end" gap="xs">
            <AppAutocomplete
              ref={produtoInputRef}
              label="Produto"
              size="xs"
              placeholder="Digite o nome do produto..."
              data={nomesProdutosDisponiveis}
              required
              limit={8}
              style={{ flex: 1 }}
              {...form.getInputProps('produtoNome')}
              onOptionSubmit={handleOptionSubmit}
              onKeyDown={handleKeyDown}
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

          {produtoSelecionado && produtoSelecionado.categoria && (
            <Group mt={4} gap="xs">
              <Badge variant="dot" color="teal" size="sm">
                {produtoSelecionado.categoria}
              </Badge>
            </Group>
          )}
        </fieldset>
      </form>
    </SectionCard>
  )
}
