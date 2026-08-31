import { useEffect, useState, useMemo, useRef } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  FileInput,
  Group,
  Kbd,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCalculator,
  IconCheck,
  IconDownload,
  IconEdit,
  IconFileSpreadsheet,
  IconInfoCircle,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../locales/mrtPtBr'
import { PageHeader } from './common/PageHeader'
import { RoundHeaderSelector } from './common/RoundHeaderSelector'
import { SectionCard } from './common/SectionCard'
import { AppAutocomplete, AppSelect } from './common/AppSelect'
import { getApi } from '../services/api'
import type {
  Cotacao,
  EstatisticasProduto,
  Fornecedor,
  Necessidade,
  Produto,
  Rodada,
} from '../types'

// Helper para download de arquivos Base64
function downloadBase64File(
  base64Data: string,
  fileName: string,
  mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
) {
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Formatação inteligente: mínimo 2 casas (R$ 5,00) e máximo 4 casas (R$ 0,043)
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

interface CotacoesViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
}

export function CotacoesView({
  rodadaAtivaId,
  onRodadaChange,
}: CotacoesViewProps) {
  const [rodadas, setRodadas] = useState<Rodada[]>([])
  const [selectedRodadaId, setSelectedRodadaId] = useState<number | null>(
    rodadaAtivaId || null,
  )
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Estatísticas de inteligência de preço do produto atualmente em foco
  const [statsProduto, setStatsProduto] = useState<EstatisticasProduto | null>(null)

  // Estado para Modal de Importação Excel
  const [modalImportarOpened, { open: openModalImportar, close: closeModalImportar }] =
    useDisclosure(false)
  const [arquivoExcel, setArquivoExcel] = useState<File | null>(null)
  const [fornecedorImportarId, setFornecedorImportarId] = useState<string | null>(null)
  const [importandoExcel, setImportandoExcel] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)

  const rodadaAtual = rodadas.find((r) => r.id === selectedRodadaId)
  const isFechada = rodadaAtual?.status === 'fechada'

  // Estado para Modal de Edição de Produto
  const [modalEditarProdutoOpened, { open: openModalEditarProduto, close: closeModalEditarProduto }] =
    useDisclosure(false)
  const [produtoParaEditar, setProdutoParaEditar] = useState<Produto | null>(null)
  const [salvandoEdicaoProduto, setSalvandoEdicaoProduto] = useState(false)

  const formEdicaoProduto = useForm({
    initialValues: {
      nome: '',
      categoria: '',
      unidade_padrao: 'UN',
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do produto é obrigatório' : null,
      unidade_padrao: (value) =>
        value.trim().length === 0 ? 'Informe a unidade de medida padrão' : null,
    },
  })

  // Referências para navegação ultrarrápida por teclado
  const fornecedorRef = useRef<HTMLInputElement>(null)
  const produtoRef = useRef<HTMLInputElement>(null)
  const embalagemRef = useRef<HTMLInputElement>(null)
  const qtdRef = useRef<HTMLInputElement>(null)
  const precoRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    initialValues: {
      produtoNome: '',
      fornecedorNome: '',
      embalagem: 'Unidade',
      qtd_por_embalagem: 1,
      preco_embalagem: 0,
    },
    validate: {
      fornecedorNome: (value) =>
        value.trim().length === 0 ? 'Informe o fornecedor' : null,
      produtoNome: (value) =>
        value.trim().length === 0 ? 'Informe o produto' : null,
      embalagem: (value) =>
        value.trim().length === 0 ? 'Informe a embalagem' : null,
      qtd_por_embalagem: (value) =>
        value <= 0 ? 'Quantidade por embalagem deve ser maior que zero' : null,
      preco_embalagem: (value) =>
        value < 0 ? 'O preço da embalagem não pode ser negativo' : null,
    },
  })

  const produtoSelecionado = useMemo(() => {
    return produtos.find(
      (p) =>
        p.nome.trim().toLowerCase() === form.values.produtoNome.trim().toLowerCase(),
    )
  }, [produtos, form.values.produtoNome])

  const fornecedorSelecionado = useMemo(() => {
    return fornecedores.find(
      (f) =>
        f.nome.trim().toLowerCase() ===
        form.values.fornecedorNome.trim().toLowerCase(),
    )
  }, [fornecedores, form.values.fornecedorNome])

  // Busca estatísticas históricas do produto sempre que o produto selecionado mudar
  useEffect(() => {
    if (!produtoSelecionado) {
      setStatsProduto(null)
      return
    }

    let isMounted = true
    const buscarHistorico = async () => {
      try {
        const api = await getApi()
        const stats = await api.obter_estatisticas_produto(produtoSelecionado.id)
        if (isMounted) {
          setStatsProduto(stats)
        }
      } catch (err) {
        console.error('Erro ao buscar histórico do produto:', err)
      }
    }

    buscarHistorico()
    return () => {
      isMounted = false
    }
  }, [produtoSelecionado?.id])

  // Preço unitário pré-calculado em tempo real no formulário
  const precoUnitarioPreview = useMemo(() => {
    const qtd = form.values.qtd_por_embalagem || 0
    const preco = form.values.preco_embalagem || 0
    if (qtd > 0 && preco > 0) {
      return preco / qtd
    }
    return 0
  }, [form.values.qtd_por_embalagem, form.values.preco_embalagem])

  const carregarDadosIniciais = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      const [listaRodadas, listaProdutos, listaFornecedores] = await Promise.all([
        api.listar_rodadas(),
        api.listar_produtos(true),
        api.listar_fornecedores(true),
      ])

      setRodadas(listaRodadas)
      setProdutos(listaProdutos)
      setFornecedores(listaFornecedores)

      let rodadaId = selectedRodadaId
      if (!rodadaId && listaRodadas.length > 0) {
        rodadaId = listaRodadas[0].id
        setSelectedRodadaId(rodadaId)
        onRodadaChange?.(rodadaId)
      }

      if (rodadaId) {
        const [cots, necs] = await Promise.all([
          api.listar_cotacoes(rodadaId),
          api.listar_necessidades(rodadaId),
        ])
        setCotacoes(cots)
        setNecessidades(necs)

        // Se houver fornecedores e nenhum selecionado, pré-seleciona o primeiro
        if (listaFornecedores.length > 0 && !form.values.fornecedorNome) {
          form.setFieldValue('fornecedorNome', listaFornecedores[0].nome)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados de cotações:', error)
      notifications.show({
        title: 'Erro de comunicação',
        message: 'Não foi possível carregar as cotações da rodada.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  const carregarCotacoesENecessidades = async (rodadaId: number) => {
    try {
      setLoading(true)
      const api = await getApi()
      const [cots, necs] = await Promise.all([
        api.listar_cotacoes(rodadaId),
        api.listar_necessidades(rodadaId),
      ])
      setCotacoes(cots)
      setNecessidades(necs)
    } catch (error) {
      console.error('Erro ao carregar cotações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAbrirEdicaoProduto = (produto: Produto) => {
    setProdutoParaEditar(produto)
    formEdicaoProduto.setValues({
      nome: produto.nome,
      categoria: produto.categoria || '',
      unidade_padrao: produto.unidade_padrao || 'UN',
    })
    openModalEditarProduto()
  }

  const handleSalvarEdicaoProduto = async (values: typeof formEdicaoProduto.values) => {
    if (!produtoParaEditar) return
    try {
      setSalvandoEdicaoProduto(true)
      const api = await getApi()
      await api.atualizar_produto(
        produtoParaEditar.id,
        values.nome,
        values.categoria || null,
        values.unidade_padrao,
      )

      notifications.show({
        title: 'Produto Atualizado',
        message: `O produto "${values.nome}" foi atualizado com sucesso.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      closeModalEditarProduto()
      await carregarDadosIniciais()
      if (selectedRodadaId) {
        await carregarCotacoesENecessidades(selectedRodadaId)
      }
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao atualizar produto',
        message: error?.message || 'Falha ao salvar produto.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvandoEdicaoProduto(false)
    }
  }

  useEffect(() => {
    carregarDadosIniciais()
    setTimeout(() => produtoRef.current?.focus(), 150)
  }, [])

  const handleSubmit = async (values: typeof form.values) => {
    if (!selectedRodadaId) {
      notifications.show({
        title: 'Selecione uma rodada',
        message: 'É necessário selecionar uma rodada ativa para registrar cotações.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    const prod = produtos.find(
      (p) => p.nome.trim().toLowerCase() === values.produtoNome.trim().toLowerCase(),
    )
    if (!prod) {
      form.setFieldError('produtoNome', 'Produto não encontrado no cadastro.')
      notifications.show({
        title: 'Produto inexistente',
        message: `O produto "${values.produtoNome}" não foi encontrado no cadastro.`,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
      produtoRef.current?.focus()
      return
    }

    const estaNaRodada = necessidades.some((n) => n.id_produto === prod.id)
    if (!estaNaRodada) {
      form.setFieldError(
        'produtoNome',
        'Este produto não está na lista de necessidades desta rodada.',
      )
      notifications.show({
        title: 'Produto não solicitado na rodada',
        message: `"${values.produtoNome}" não faz parte das necessidades desta rodada. Adicione-o na aba Necessidades se desejar cotá-lo.`,
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      produtoRef.current?.focus()
      return
    }

    const forn = fornecedores.find(
      (f) =>
        f.nome.trim().toLowerCase() === values.fornecedorNome.trim().toLowerCase(),
    )
    if (!forn) {
      form.setFieldError('fornecedorNome', 'Fornecedor não encontrado no cadastro.')
      notifications.show({
        title: 'Fornecedor inexistente',
        message: `O fornecedor "${values.fornecedorNome}" não foi encontrado.`,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
      fornecedorRef.current?.focus()
      return
    }

    try {
      setSubmitting(true)
      const api = await getApi()
      const salva = await api.criar_cotacao(
        selectedRodadaId,
        forn.id,
        prod.id,
        values.embalagem,
        values.qtd_por_embalagem,
        values.preco_embalagem,
      )

      notifications.show({
        title: 'Cotação Registrada',
        message: `"${salva.produto_nome}" (${salva.fornecedor_nome}): ${formatMoney(
          salva.preco_unitario,
        )} / ${salva.produto_unidade_padrao}`,
        color: 'green',
        icon: <IconCheck size={16} />,
        autoClose: 1800,
      })

      // Mantém o fornecedor ativo para lançamento contínuo em lote!
      form.setValues({
        produtoNome: '',
        fornecedorNome: values.fornecedorNome,
        embalagem: 'Unidade',
        qtd_por_embalagem: 1,
        preco_embalagem: 0,
      })

      await carregarCotacoesENecessidades(selectedRodadaId)

      // Refoca instantaneamente no campo de produto para o próximo item
      setTimeout(() => {
        produtoRef.current?.focus()
      }, 50)
    } catch (error: any) {
      console.error('Erro ao salvar cotação:', error)
      notifications.show({
        title: 'Erro ao salvar cotação',
        message: error?.message || 'Falha ao registrar cotação.',
        color: 'red',
        icon: <IconX size={16} />,
      })
      precoRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemover = (id: number, produtoNome: string, fornecedorNome: string) => {
    modals.openConfirmModal({
      title: 'Excluir Cotação',
      centered: true,
      children: (
        <Text size="sm">
          Deseja realmente remover a cotação de <b>{produtoNome}</b> do fornecedor{' '}
          <b>{fornecedorNome}</b>?
        </Text>
      ),
      labels: { confirm: 'Excluir Cotação', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          setDeletingId(id)
          const api = await getApi()
          await api.remover_cotacao(id)

          notifications.show({
            title: 'Cotação Removida',
            message: `Cotação de "${produtoNome}" removida com sucesso.`,
            color: 'blue',
            icon: <IconCheck size={16} />,
          })

          if (selectedRodadaId) {
            await carregarCotacoesENecessidades(selectedRodadaId)
          }
        } catch (error) {
          console.error('Erro ao remover cotação:', error)
          notifications.show({
            title: 'Erro ao remover',
            message: 'Não foi possível excluir a cotação.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        } finally {
          setDeletingId(null)
          produtoRef.current?.focus()
        }
      },
    })
  }

  const handleExportarPlanilhaModelo = async () => {
    if (!selectedRodadaId) {
      notifications.show({
        title: 'Selecione uma rodada',
        message: 'Selecione uma rodada ativa para exportar o modelo de cotação.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    try {
      setExportandoExcel(true)
      const api = await getApi()
      const forn = fornecedores.find(
        (f) =>
          f.nome.trim().toLowerCase() ===
          form.values.fornecedorNome.trim().toLowerCase(),
      )
      const res = await api.exportar_planilha_cotacao(
        selectedRodadaId,
        forn ? forn.id : null,
      )

      if (res.cancelado) {
        return
      }

      if (res.salvo_em_disco) {
        notifications.show({
          title: 'Planilha Exportada com Sucesso',
          message: `Salva em: ${res.caminho}`,
          color: 'teal',
          icon: <IconCheck size={16} />,
        })
      } else if (res.conteudo_base64) {
        downloadBase64File(res.conteudo_base64, res.nome_arquivo || 'cotacao.xlsx')
        notifications.show({
          title: 'Planilha Exportada com Sucesso',
          message: `Arquivo "${res.nome_arquivo}" gerado com ${res.total_itens || res.total || 0} produtos.`,
          color: 'teal',
          icon: <IconCheck size={16} />,
        })
      }
    } catch (error: any) {
      console.error('Erro ao exportar planilha:', error)
      notifications.show({
        title: 'Erro ao exportar planilha',
        message: error?.message || 'Falha na geração do arquivo Excel.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setExportandoExcel(false)
    }
  }

  const handleProcessarImportacaoExcel = async () => {
    if (!selectedRodadaId) {
      notifications.show({
        title: 'Selecione uma rodada',
        message: 'Selecione uma rodada ativa para importar cotações.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    if (!fornecedorImportarId || !arquivoExcel) {
      notifications.show({
        title: 'Dados incompletos',
        message: 'Selecione o fornecedor e anexe o arquivo Excel (.xlsx).',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    try {
      setImportandoExcel(true)
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const result = reader.result as string
          const base64Content = result.split(',')[1] || result
          const api = await getApi()
          const res = await api.importar_planilha_cotacao(
            selectedRodadaId,
            parseInt(fornecedorImportarId, 10),
            base64Content,
          )

          notifications.show({
            title: 'Importação Concluída com Sucesso',
            message: `${res.importados} cotações importadas/atualizadas para ${res.fornecedor_nome}!`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          })

          if (res.erros && res.erros.length > 0) {
            notifications.show({
              title: 'Avisos durante a importação',
              message: `${res.erros.length} linha(s) ignoradas por inconsistência ou produtos não localizados.`,
              color: 'orange',
              icon: <IconAlertCircle size={16} />,
            })
          }

          closeModalImportar()
          setArquivoExcel(null)
          await carregarCotacoesENecessidades(selectedRodadaId)
        } catch (err: any) {
          notifications.show({
            title: 'Falha ao processar arquivo',
            message: err?.message || 'Verifique o formato da planilha.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        } finally {
          setImportandoExcel(false)
        }
      }
      reader.readAsDataURL(arquivoExcel)
    } catch (error: any) {
      setImportandoExcel(false)
    }
  }

  // Autocomplete lista apenas produtos da lista de necessidades da rodada
  const nomesProdutosNecessarios = useMemo(() => {
    return necessidades.map((n) => n.produto_nome)
  }, [necessidades])

  const nomesFornecedores = useMemo(
    () => fornecedores.map((f) => f.nome),
    [fornecedores],
  )

  const columns = useMemo<MRT_ColumnDef<Cotacao>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        Cell: ({ cell }) => <Text fw={600}>{cell.getValue<string>()}</Text>,
      },
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        Cell: ({ cell }) => (
          <Badge variant="outline" color="cyan">
            {cell.getValue<string>()}
          </Badge>
        ),
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem Cotada',
        Cell: ({ cell }) => <Text size="sm">{cell.getValue<string>()}</Text>,
      },
      {
        accessorKey: 'qtd_por_embalagem',
        header: 'Qtd / Emb.',
        size: 130,
        Cell: ({ row }) => (
          <Text size="sm" style={{ textAlign: 'right' }}>
            {row.original.qtd_por_embalagem} {row.original.produto_unidade_padrao}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb. (R$)',
        size: 150,
        Cell: ({ cell }) => (
          <Text fw={500} style={{ textAlign: 'right' }}>
            {formatMoney(cell.getValue<number>(), 2)}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário Normalizado',
        size: 210,
        Cell: ({ row }) => (
          <Badge variant="filled" color="teal" size="md">
            {formatMoney(row.original.preco_unitario)} /{' '}
            {row.original.produto_unidade_padrao}
          </Badge>
        ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 100,
        Cell: ({ row }) => {
          const item = row.original
          const prod = produtos.find((p) => p.id === item.id_produto)
          return (
            <Group gap={4} justify="center">
              {prod && (
                <Tooltip label={`Editar cadastro de "${prod.nome}"`}>
                  <ActionIcon
                    color="blue"
                    variant="subtle"
                    onClick={() => handleAbrirEdicaoProduto(prod)}
                  >
                    <IconEdit size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="Excluir cotação">
                <ActionIcon
                  color="red"
                  variant="subtle"
                  loading={deletingId === item.id}
                  disabled={isFechada}
                  onClick={() =>
                    handleRemover(
                      item.id,
                      item.produto_nome,
                      item.fornecedor_nome,
                    )
                  }
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [deletingId, produtos, isFechada],
  )

  const table = useMantineReactTable({
    columns,
    data: cotacoes,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: true,
    },
    mantinePaperProps: {
      withBorder: true,
      radius: 'md',
      shadow: 'none',
    },
  })

  return (
    <Stack gap="md" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <PageHeader
        icon={IconReceipt}
        iconColor="teal"
        title="Cotações de Preços"
        subtitle="Lançamento ágil de cotações com normalização automática de preço por unidade"
        rightSection={
          <Group gap="sm">
            {isFechada && (
              <Badge variant="filled" color="red" size="md">
                Rodada Fechada - Somente Leitura
              </Badge>
            )}
            <Button
              variant="light"
              color="teal"
              leftSection={<IconDownload size={16} />}
              loading={exportandoExcel}
              onClick={handleExportarPlanilhaModelo}
            >
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              color="teal"
              leftSection={<IconUpload size={16} />}
              onClick={openModalImportar}
              disabled={isFechada}
            >
              Importar Excel
            </Button>
            <RoundHeaderSelector
              rodadas={rodadas}
              selectedRodadaId={selectedRodadaId}
              onSelectRodada={(id) => {
                setSelectedRodadaId(id)
                onRodadaChange?.(id)
                carregarCotacoesENecessidades(id)
              }}
            />
          </Group>
        }
      />

      {/* Dica se não houver necessidades cadastradas */}
      {necessidades.length === 0 && !loading && (
        <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light" radius="md">
          Esta rodada ainda não possui produtos na lista de necessidades. Adicione produtos na aba{' '}
          <b>Necessidades</b> para poder cotá-los aqui.
        </Alert>
      )}

      {/* Formulário Turbo de Cadastro de Cotação */}
      <SectionCard
        title="Nova Cotação de Fornecedor"
        subtitle="O fornecedor fica fixo para lançamento em lote"
        kbdHint="Enter"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <fieldset disabled={isFechada} style={{ border: 'none', padding: 0, margin: 0 }}>
            <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <AppAutocomplete
                ref={fornecedorRef}
                label="Fornecedor (Fixo para Lote)"
                placeholder="Selecione o fornecedor..."
                data={nomesFornecedores}
                required
                limit={8}
                {...form.getInputProps('fornecedorNome')}
                onTabOrEnterNextRef={produtoRef}
              />

              <Stack gap={4}>
                <Group justify="space-between" align="center">
                  <Text size="sm" fw={500}>
                    Produto em Necessidade <Text span c="red">*</Text>
                  </Text>
                  {produtoSelecionado && (
                    <Button
                      variant="subtle"
                      color="blue"
                      size="compact-xs"
                      leftSection={<IconEdit size={12} />}
                      onClick={() => handleAbrirEdicaoProduto(produtoSelecionado)}
                    >
                      Editar Produto
                    </Button>
                  )}
                </Group>
                <AppAutocomplete
                  ref={produtoRef}
                  placeholder={
                    nomesProdutosNecessarios.length > 0
                      ? 'Selecione o produto em necessidade...'
                      : 'Nenhum produto em necessidade nesta rodada'
                  }
                  data={nomesProdutosNecessarios}
                  required
                  limit={8}
                  {...form.getInputProps('produtoNome')}
                  onTabOrEnterNextRef={embalagemRef}
                />
              </Stack>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <AppAutocomplete
                ref={embalagemRef}
                label="Descrição da Embalagem"
                placeholder="Ex: Caixa c/ 24 un, Fardo c/ 12 un, Unidade"
                data={SUGESTOES_EMBALAGEM}
                required
                {...form.getInputProps('embalagem')}
                onTabOrEnterNextRef={qtdRef}
              />

              <NumberInput
                ref={qtdRef}
                label={
                  produtoSelecionado
                    ? `Qtd na Embalagem (${produtoSelecionado.unidade_padrao})`
                    : 'Qtd na Embalagem'
                }
                placeholder="Ex: 24"
                min={0.001}
                decimalScale={3}
                required
                {...form.getInputProps('qtd_por_embalagem')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    precoRef.current?.focus()
                  }
                }}
              />

              <NumberInput
                ref={precoRef}
                label="Preço da Embalagem (R$)"
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
                    form.onSubmit(handleSubmit)()
                  }
                }}
              />
            </SimpleGrid>

            {/* Live Preview do Preço Unitário Normalizado + Inteligência de Tendência Histórica */}
            <Alert
              icon={<IconCalculator size={22} />}
              title="Normalização e Análise de Preço em Tempo Real"
              color="teal"
              variant="light"
              radius="md"
            >
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={600}>
                      {produtoSelecionado
                        ? `Item: ${produtoSelecionado.nome} (Unidade: ${produtoSelecionado.unidade_padrao})`
                        : 'Selecione um produto para visualizar o preço normalizado.'}
                      {fornecedorSelecionado &&
                        ` • Fornecedor: ${fornecedorSelecionado.nome}`}
                    </Text>
                  </div>
                  <Badge size="xl" color="teal" variant="filled">
                    {precoUnitarioPreview > 0
                      ? `${formatMoney(precoUnitarioPreview)} / ${
                          produtoSelecionado?.unidade_padrao || 'un'
                        }`
                      : 'R$ 0,00'}
                  </Badge>
                </Group>

                {/* Painel Inteligente de Comparação Histórica */}
                {produtoSelecionado && statsProduto && statsProduto.total_cotacoes > 0 && (
                  <Paper withBorder p="xs" radius="sm" bg="var(--mantine-color-body)">
                    <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          Histórico: <b>{statsProduto.total_cotacoes}</b> cotações
                        </Text>
                        <Text size="xs" c="dimmed">
                          Menor histórico: <b style={{ color: '#059669' }}>{formatMoney(statsProduto.menor_preco)}</b>
                          {statsProduto.melhor_fornecedor && ` (${statsProduto.melhor_fornecedor})`}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Média: <b>{formatMoney(statsProduto.preco_medio)}</b>
                        </Text>
                      </Group>

                      {/* Badge Comparativo com Variação Percentual */}
                      {precoUnitarioPreview > 0 && (
                        <Group gap="xs">
                          {precoUnitarioPreview < statsProduto.menor_preco ? (
                            <Badge color="green" variant="filled" leftSection={<IconTrendingDown size={14} />}>
                              🔥 NOVO RECORDE (-{(((statsProduto.menor_preco - precoUnitarioPreview) / statsProduto.menor_preco) * 100).toFixed(1)}% mais barato)
                            </Badge>
                          ) : precoUnitarioPreview <= statsProduto.preco_medio ? (
                            <Badge color="teal" variant="light" leftSection={<IconTrendingDown size={14} />}>
                              ✓ Abaixo da média (-{(((statsProduto.preco_medio - precoUnitarioPreview) / statsProduto.preco_medio) * 100).toFixed(1)}%)
                            </Badge>
                          ) : precoUnitarioPreview > statsProduto.maior_preco ? (
                            <Badge color="red" variant="filled" leftSection={<IconTrendingUp size={14} />}>
                              🚨 MAIOR HISTÓRICO (+{(((precoUnitarioPreview - statsProduto.maior_preco) / statsProduto.maior_preco) * 100).toFixed(1)}%)
                            </Badge>
                          ) : (
                            <Badge color="orange" variant="light" leftSection={<IconTrendingUp size={14} />}>
                              ⚠️ +{(((precoUnitarioPreview - statsProduto.preco_medio) / statsProduto.preco_medio) * 100).toFixed(1)}% acima da média
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
                leftSection={<IconPlus size={18} />}
                loading={submitting}
              >
                Salvar Cotação <Kbd ml={6} size="xs">Enter</Kbd>
              </Button>
            </Group>
          </Stack>
          </fieldset>
        </form>
      </SectionCard>

      {/* Mantine React Table */}
      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <MantineReactTable table={table} />
      )}

      {/* Modal de Importação de Planilha Excel */}
      <Modal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        title={
          <Group gap="xs">
            <IconFileSpreadsheet size={22} color="#10B981" />
            <Text fw={700}>Importar Cotações via Planilha Excel (.xlsx)</Text>
          </Group>
        }
        centered
        radius="md"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Selecione o fornecedor que enviou os preços e faça o upload da planilha modelo preenchida.
          </Text>

          <AppSelect
            label="Fornecedor da Planilha"
            placeholder="Selecione qual fornecedor enviou esta cotação..."
            data={fornecedores.map((f) => ({ value: String(f.id), label: f.nome }))}
            value={fornecedorImportarId}
            onChange={setFornecedorImportarId}
            required
          />

          <FileInput
            label="Arquivo Excel (.xlsx)"
            placeholder="Clique para selecionar a planilha..."
            accept=".xlsx,.xls"
            value={arquivoExcel}
            onChange={setArquivoExcel}
            leftSection={<IconFileSpreadsheet size={18} />}
            clearable
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={closeModalImportar}>
              Cancelar
            </Button>
            <Button
              color="teal"
              leftSection={<IconUpload size={16} />}
              loading={importandoExcel}
              onClick={handleProcessarImportacaoExcel}
            >
              Processar e Importar Cotações
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de Edição de Produto */}
      <Modal
        opened={modalEditarProdutoOpened}
        onClose={closeModalEditarProduto}
        title={
          <Group gap="xs">
            <IconEdit size={22} color="#3B82F6" />
            <Text fw={700}>Editar Cadastro do Produto</Text>
          </Group>
        }
        centered
        radius="md"
        size="md"
      >
        <form onSubmit={formEdicaoProduto.onSubmit(handleSalvarEdicaoProduto)}>
          <Stack gap="md">
            <TextInput
              label="Nome do Produto"
              placeholder="Nome do produto..."
              required
              {...formEdicaoProduto.getInputProps('nome')}
            />

            <TextInput
              label="Categoria"
              placeholder="Ex: Alimentos, Limpeza, Embalagens..."
              {...formEdicaoProduto.getInputProps('categoria')}
            />

            <AppSelect
              label="Unidade Padrão"
              placeholder="Selecione a unidade..."
              data={['UN', 'KG', 'L', 'CX', 'PCT', 'FARDO', 'M', 'PAR', 'ROLO']}
              required
              {...formEdicaoProduto.getInputProps('unidade_padrao')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" color="gray" onClick={closeModalEditarProduto}>
                Cancelar
              </Button>
              <Button
                color="blue"
                type="submit"
                leftSection={<IconCheck size={16} />}
                loading={salvandoEdicaoProduto}
              >
                Salvar Alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}

export default CotacoesView

