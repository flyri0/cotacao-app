import { useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import {
  Alert,
  Badge,
  Button,
  Group,
  Kbd,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import { IconCalculator, IconEdit, IconPlus, IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import { AppAutocomplete } from '../../components/form/AppSelect'

import type { EstatisticasProduto, Fornecedor, Produto } from '../../types'

function formatMoney(valor: number, maxDigits = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(valor || 0)
}

const SUGESTOES_EMBALAGEM = [
  'Caixa c/ 24 un',
  'Caixa c/ 12 un',
  'Caixa c/ 50 un',
  'Caixa c/ 5000 un',
  'Caixa c/ 2500 un',
  'Fardo c/ 12 un',
  'Fardo c/ 10 pct',
  'Fardo c/ 8 pct',
  'Pacote c/ 500 un',
  'Pacote avulso',
  'Tira c/ 100 un',
  'Frasco 1L',
  'Galão 5L',
  'Unidade',
]

const SUGESTOES_UNIDADES = [
  'UN',
  'KG',
  'L',
  'PCT',
  'CX',
  'FARDO',
  'FRASCO',
  'GALAO',
  'ROLO',
  'PAR',
  'LATA',
  'M',
]

export interface CotacoesFormValues {
  fornecedorNome: string
  produtoNome: string
  marca: string
  embalagem: string
  qtd_por_embalagem: number
  unidade: string
  preco_embalagem: number
}

interface CotacoesFormProps {
  isFechada: boolean
  themeColor: string
  fornecedores: Fornecedor[]
  nomesFornecedores: string[]
  nomesTodosProdutos: string[]
  submitting: boolean
  onSubmit: (values: CotacoesFormValues) => void
  onEditarProduto: (produto: Produto) => void
  form: UseFormReturnType<CotacoesFormValues>
  statsProduto: EstatisticasProduto | null
  produtoSelecionado: Produto | undefined
}

export interface CotacoesFormRef {
  focusProduto: () => void
  focusFornecedor: () => void
  focusPreco: () => void
}

export const CotacoesForm = forwardRef<CotacoesFormRef, CotacoesFormProps>(
  (
    {
      isFechada,
      themeColor,
      fornecedores,
      nomesFornecedores,
      nomesTodosProdutos,
      submitting,
      onSubmit,
      onEditarProduto,
      form,
      statsProduto,
      produtoSelecionado,
    },
    ref,
  ) => {
    const fornecedorRef = useRef<HTMLInputElement>(null)
    const produtoRef = useRef<HTMLInputElement>(null)
    const marcaRef = useRef<HTMLInputElement>(null)
    const embalagemRef = useRef<HTMLInputElement>(null)
    const qtdRef = useRef<HTMLInputElement>(null)
    const unidadeRef = useRef<HTMLInputElement>(null)
    const precoRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focusProduto: () => produtoRef.current?.focus(),
      focusFornecedor: () => fornecedorRef.current?.focus(),
      focusPreco: () => precoRef.current?.focus(),
    }))

    const fornecedorSelecionado = useMemo(() => {
      return fornecedores.find(
        (f) =>
          f.nome.trim().toLowerCase() ===
          form.values.fornecedorNome.trim().toLowerCase(),
      )
    }, [fornecedores, form.values.fornecedorNome])

    const precoUnitarioPreview = useMemo(() => {
      const qtd = form.values.qtd_por_embalagem || 0
      const preco = form.values.preco_embalagem || 0
      if (qtd > 0 && preco > 0) {
        return preco / qtd
      }
      return 0
    }, [form.values.qtd_por_embalagem, form.values.preco_embalagem])

    return (
      <form onSubmit={form.onSubmit(onSubmit)}>
        <fieldset disabled={isFechada} style={{ border: 'none', padding: 0, margin: 0 }}>
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
              <AppAutocomplete
                ref={fornecedorRef}
                label="Fornecedor (Fixo)"
                size="xs"
                placeholder="Selecione o fornecedor..."
                data={nomesFornecedores}
                required
                limit={8}
                {...form.getInputProps('fornecedorNome')}
                onTabOrEnterNextRef={produtoRef}
              />

              <Stack gap={2}>
                <Group justify="space-between" align="center">
                  <Text size="xs" fw={500}>
                    Produto <Text span c="red">*</Text>
                  </Text>
                  {produtoSelecionado && (
                    <Button
                      variant="subtle"
                      color="blue"
                      size="compact-xs"
                      leftSection={<IconEdit size={11} />}
                      onClick={() => onEditarProduto(produtoSelecionado)}
                    >
                      Editar
                    </Button>
                  )}
                </Group>
                <AppAutocomplete
                  ref={produtoRef}
                  size="xs"
                  placeholder="Digite ou selecione o produto..."
                  data={nomesTodosProdutos}
                  required
                  limit={10}
                  {...form.getInputProps('produtoNome')}
                  onTabOrEnterNextRef={marcaRef}
                />
              </Stack>

              <TextInput
                ref={marcaRef}
                label="Marca (Opcional)"
                size="xs"
                placeholder="Ex: Ypê, Bombril, 3M..."
                {...form.getInputProps('marca')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    embalagemRef.current?.focus()
                  }
                }}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="xs">
              <AppAutocomplete
                ref={embalagemRef}
                label="Embalagem"
                size="xs"
                placeholder="Ex: Caixa c/ 24 un, Fardo c/ 12 un"
                data={SUGESTOES_EMBALAGEM}
                required
                {...form.getInputProps('embalagem')}
                onTabOrEnterNextRef={qtdRef}
              />

              <NumberInput
                ref={qtdRef}
                label="Qtd na Embalagem"
                size="xs"
                placeholder="Ex: 24"
                min={0.001}
                decimalScale={3}
                required
                {...form.getInputProps('qtd_por_embalagem')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    unidadeRef.current?.focus()
                  }
                }}
              />

              <AppAutocomplete
                ref={unidadeRef}
                label="Unidade Medida"
                size="xs"
                placeholder="Ex: UN, KG, L, PCT, CX"
                data={SUGESTOES_UNIDADES}
                required
                {...form.getInputProps('unidade')}
                onTabOrEnterNextRef={precoRef}
              />

              <NumberInput
                ref={precoRef}
                label="Preço Embalagem (R$)"
                size="xs"
                placeholder="0,00"
                min={0}
                decimalScale={2}
                fixedDecimalScale
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                required
                {...form.getInputProps('preco_embalagem')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    form.onSubmit(onSubmit)()
                  }
                }}
              />
            </SimpleGrid>

            {/* Live Preview do Preço Unitário Normalizado + Inteligência de Tendência Histórica */}
            <Alert
              icon={<IconCalculator size={18} />}
              color="teal"
              variant="light"
              radius="sm"
              p="xs"
            >
              <Stack gap={4}>
                <Group justify="space-between" align="center">
                  <div>
                    <Text size="xs" fw={600}>
                      {form.values.produtoNome
                        ? `Item: ${form.values.produtoNome} (Un: ${form.values.unidade || 'UN'})`
                        : 'Preencha os dados do item para visualizar o preço normalizado.'}
                      {fornecedorSelecionado &&
                        ` • Fornecedor: ${fornecedorSelecionado.nome}`}
                      {form.values.marca &&
                        ` • Marca: ${form.values.marca}`}
                    </Text>
                  </div>
                  <Badge size="sm" color="teal" variant="filled">
                    {precoUnitarioPreview > 0
                      ? `${formatMoney(precoUnitarioPreview)} / ${
                          form.values.unidade || 'UN'
                        }`
                      : 'R$ 0,00'}
                  </Badge>
                </Group>

                {/* Painel Inteligente de Comparação Histórica */}
                {produtoSelecionado && statsProduto && statsProduto.total_cotacoes > 0 && (
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

                      {/* Badge Comparativo com Variação Percentual */}
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
                )}
              </Stack>
            </Alert>

            <Group justify="flex-end">
              <Button
                type="submit"
                variant="filled"
                color={themeColor}
                size="xs"
                leftSection={<IconPlus size={14} />}
                loading={submitting}
              >
                Salvar Cotação <Kbd ml={4} size="xs">Enter</Kbd>
              </Button>
            </Group>
          </Stack>
        </fieldset>
      </form>
    )
  },
)

CotacoesForm.displayName = 'CotacoesForm'
