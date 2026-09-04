import { useEffect, useState, useMemo, useRef } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
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
  IconEdit,
  IconPackage,
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
import { AppAutocomplete } from './common/AppSelect'
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

interface CotacoesViewProps {
  rodadaAtivaId?: number
  onRodadaChange?: (id: number) => void
  themeColor?: string
}

export function CotacoesView({
  rodadaAtivaId,
  onRodadaChange,
  themeColor = 'blue',
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
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do produto é obrigatório' : null,
    },
  })

  // Estado para Modal de Edição Completa de Cotação
  const [modalEditarCotacaoOpened, { open: openModalEditarCotacao, close: closeModalEditarCotacao }] =
    useDisclosure(false)
  const [cotacaoParaEditar, setCotacaoParaEditar] = useState<Cotacao | null>(null)
  const [salvandoEdicaoCotacao, setSalvandoEdicaoCotacao] = useState(false)

  const formEdicaoCotacao = useForm({
    initialValues: {
      fornecedorNome: '',
      produtoNome: '',
      produtoCategoria: '',
      marca: '',
      embalagem: 'Unidade',
      qtd_por_embalagem: 1,
      unidade: 'UN',
      preco_embalagem: 0,
    },
    validate: {
      fornecedorNome: (value) =>
        value.trim().length === 0 ? 'Informe o fornecedor' : null,
      produtoNome: (value) =>
        value.trim().length === 0 ? 'Informe o produto' : null,
      embalagem: (value) =>
        value.trim().length === 0 ? 'Informe a embalagem' : null,
      unidade: (value) =>
        value.trim().length === 0 ? 'Informe a unidade de medida' : null,
      qtd_por_embalagem: (value) =>
        value <= 0 ? 'Quantidade por embalagem deve ser maior que zero' : null,
      preco_embalagem: (value) =>
        value < 0 ? 'O preço da embalagem não pode ser negativo' : null,
    },
  })

  // Referências para navegação ultrarrápida por teclado
  const fornecedorRef = useRef<HTMLInputElement>(null)
  const produtoRef = useRef<HTMLInputElement>(null)
  const marcaRef = useRef<HTMLInputElement>(null)
  const embalagemRef = useRef<HTMLInputElement>(null)
  const qtdRef = useRef<HTMLInputElement>(null)
  const unidadeRef = useRef<HTMLInputElement>(null)
  const precoRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    initialValues: {
      fornecedorNome: '',
      produtoNome: '',
      marca: '',
      embalagem: 'Unidade',
      qtd_por_embalagem: 1,
      unidade: 'UN',
      preco_embalagem: 0,
    },
    validate: {
      fornecedorNome: (value) =>
        value.trim().length === 0 ? 'Informe o fornecedor' : null,
      produtoNome: (value) =>
        value.trim().length === 0 ? 'Informe o produto' : null,
      embalagem: (value) =>
        value.trim().length === 0 ? 'Informe a embalagem' : null,
      unidade: (value) =>
        value.trim().length === 0 ? 'Informe a unidade de medida' : null,
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
        const stats = await api.get_product_statistics(produtoSelecionado.id)
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
        api.list_rounds(),
        api.list_products(false),
        api.list_suppliers(true),
      ])

      setRodadas(listaRodadas)
      setProdutos(listaProdutos)
      setFornecedores(listaFornecedores)

      // Se houver uma rodada ativa definida externamente ou seleciona a mais recente
      if (rodadaAtivaId) {
        setSelectedRodadaId(rodadaAtivaId)
        await carregarCotacoesENecessidades(rodadaAtivaId)
      } else if (listaRodadas.length > 0) {
        const primeiraAberta =
          listaRodadas.find((r) => r.status === 'aberta') || listaRodadas[0]
        setSelectedRodadaId(primeiraAberta.id)
        onRodadaChange?.(primeiraAberta.id)
        await carregarCotacoesENecessidades(primeiraAberta.id)
      }
    } catch (error) {
      console.error('Erro ao carregar dados iniciais de cotações:', error)
      notifications.show({
        title: 'Erro ao carregar dados',
        message: 'Não foi possível carregar as informações da base.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  const carregarCotacoesENecessidades = async (idRodada: number) => {
    try {
      setLoading(true)
      const api = await getApi()
      const [listaCotacoes, listaNecessidades] = await Promise.all([
        api.list_quotes(idRodada),
        api.list_needs(idRodada),
      ])
      setCotacoes(listaCotacoes)
      setNecessidades(listaNecessidades)
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
    })
    openModalEditarProduto()
  }

  const handleSalvarEdicaoProduto = async (values: typeof formEdicaoProduto.values) => {
    if (!produtoParaEditar) return
    try {
      setSalvandoEdicaoProduto(true)
      const api = await getApi()
      await api.update_product(
        produtoParaEditar.id,
        values.nome,
        values.categoria || null,
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

  const handleAbrirEdicaoCotacao = (cotacao: Cotacao) => {
    const prod = produtos.find((p) => p.id === cotacao.id_produto)
    setCotacaoParaEditar(cotacao)
    formEdicaoCotacao.setValues({
      fornecedorNome: cotacao.fornecedor_nome,
      produtoNome: cotacao.produto_nome,
      produtoCategoria: prod?.categoria || '',
      marca: cotacao.marca || '',
      embalagem: cotacao.embalagem || 'Unidade',
      qtd_por_embalagem: cotacao.qtd_por_embalagem || 1,
      unidade: cotacao.unidade || 'UN',
      preco_embalagem: cotacao.preco_embalagem || 0,
    })
    openModalEditarCotacao()
  }

  const handleSalvarEdicaoCotacao = async (values: typeof formEdicaoCotacao.values) => {
    if (!cotacaoParaEditar) return
    const forn = fornecedores.find(
      (f) =>
        f.nome.trim().toLowerCase() === values.fornecedorNome.trim().toLowerCase(),
    )
    if (!forn) {
      formEdicaoCotacao.setFieldError('fornecedorNome', 'Fornecedor não encontrado no cadastro.')
      notifications.show({
        title: 'Fornecedor não cadastrado',
        message: `O fornecedor "${values.fornecedorNome}" não foi encontrado. Cadastre-o na aba Fornecedores.`,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    try {
      setSalvandoEdicaoCotacao(true)
      const api = await getApi()
      const atualizada = await api.update_quote(
        cotacaoParaEditar.id,
        forn.id,
        null,
        values.produtoNome,
        values.marca || null,
        values.embalagem,
        values.qtd_por_embalagem,
        values.unidade,
        values.preco_embalagem,
        values.produtoCategoria || null,
      )

      if (atualizada.produto_novo) {
        notifications.show({
          title: 'Novo Produto Cadastrado',
          message: `"${atualizada.produto_nome}" foi cadastrado no catálogo e incluído nas necessidades desta rodada.`,
          color: 'teal',
          icon: <IconPackage size={16} />,
          autoClose: 3500,
        })
      }

      notifications.show({
        title: 'Cotação Atualizada',
        message: `Cotação de "${atualizada.produto_nome}" (${atualizada.fornecedor_nome}) atualizada com sucesso!`,
        color: 'green',
        icon: <IconCheck size={16} />,
        autoClose: 2500,
      })

      closeModalEditarCotacao()
      await carregarDadosIniciais()
      if (selectedRodadaId) {
        await carregarCotacoesENecessidades(selectedRodadaId)
      }
    } catch (error: any) {
      console.error('Erro ao atualizar cotação:', error)
      notifications.show({
        title: 'Erro ao atualizar cotação',
        message: error?.message || 'Falha ao atualizar cotação.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvandoEdicaoCotacao(false)
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

    const forn = fornecedores.find(
      (f) =>
        f.nome.trim().toLowerCase() === values.fornecedorNome.trim().toLowerCase(),
    )
    if (!forn) {
      form.setFieldError('fornecedorNome', 'Fornecedor não encontrado no cadastro.')
      notifications.show({
        title: 'Fornecedor não cadastrado',
        message: `O fornecedor "${values.fornecedorNome}" não foi encontrado. Cadastre-o na aba Fornecedores antes de cotar.`,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
      fornecedorRef.current?.focus()
      return
    }

    try {
      setSubmitting(true)
      const api = await getApi()
      const salva = await api.create_quote(
        selectedRodadaId,
        forn.id,
        null,
        values.produtoNome,
        values.marca || null,
        values.embalagem,
        values.qtd_por_embalagem,
        values.unidade,
        values.preco_embalagem,
      )

      if (salva.produto_novo) {
        notifications.show({
          title: 'Novo Produto Cadastrado',
          message: `"${salva.produto_nome}" foi cadastrado no catálogo e incluído nas necessidades desta rodada.`,
          color: 'teal',
          icon: <IconPackage size={16} />,
          autoClose: 3500,
        })
        await carregarDadosIniciais()
      }

      notifications.show({
        title: 'Cotação Registrada',
        message: `"${salva.produto_nome}" (${salva.fornecedor_nome}): ${formatMoney(
          salva.preco_unitario,
        )} / ${salva.unidade}${salva.marca ? ` [${salva.marca}]` : ''}`,
        color: 'green',
        icon: <IconCheck size={16} />,
        autoClose: 2000,
      })

      // Mantém o fornecedor e unidade ativos para lançamento contínuo em lote!
      form.setValues({
        produtoNome: '',
        marca: '',
        fornecedorNome: values.fornecedorNome,
        embalagem: 'Unidade',
        qtd_por_embalagem: 1,
        unidade: values.unidade || 'UN',
        preco_embalagem: 0,
      })

      await carregarCotacoesENecessidades(selectedRodadaId)
      setTimeout(() => produtoRef.current?.focus(), 50)
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
          await api.remove_quote(id)

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

  const handleExportarExcel = async () => {
    if (!selectedRodadaId) {
      notifications.show({
        title: 'Selecione uma rodada',
        message: 'Selecione uma rodada ativa para exportar as cotações.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    try {
      setExportandoExcel(true)
      const api = await getApi()
      const res = await api.export_quote_spreadsheet(selectedRodadaId)

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
        downloadBase64File(res.conteudo_base64, res.nome_arquivo || 'cotacoes.xlsx')
        notifications.show({
          title: 'Planilha Exportada com Sucesso',
          message: `Arquivo "${res.nome_arquivo}" gerado com ${res.total_itens || res.total || 0} itens.`,
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

  const nomesTodosProdutos = useMemo(() => {
    const set = new Set<string>()
    necessidades.forEach((n) => set.add(n.produto_nome))
    produtos.forEach((p) => set.add(p.nome))
    return Array.from(set)
  }, [necessidades, produtos])

  const nomesFornecedores = useMemo(
    () => fornecedores.map((f) => f.nome),
    [fornecedores],
  )

  const columns = useMemo<MRT_ColumnDef<Cotacao>[]>(
    () => [
      {
        accessorKey: 'produto_nome',
        header: 'Produto',
        size: 220,
        Cell: ({ cell }) => (
          <Text fw={600} size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'marca',
        header: 'Marca',
        size: 110,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return (
            <Text size="xs" truncate="end" c={!val ? 'dimmed' : undefined}>
              {val || '-'}
            </Text>
          )
        },
      },
      {
        accessorKey: 'fornecedor_nome',
        header: 'Fornecedor',
        size: 160,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'embalagem',
        header: 'Embalagem',
        size: 140,
        Cell: ({ cell }) => (
          <Text size="xs" truncate="end">
            {cell.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'qtd_por_embalagem',
        header: 'Qtd / Emb.',
        size: 110,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => (
          <Text size="xs">
            {row.original.qtd_por_embalagem} {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_embalagem',
        header: 'Preço Emb.',
        size: 130,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ cell }) => (
          <Text size="xs">
            {formatMoney(cell.getValue<number>(), 2)}
          </Text>
        ),
      },
      {
        accessorKey: 'preco_unitario',
        header: 'Preço Unitário',
        size: 150,
        mantineTableHeadCellProps: { align: 'right' },
        mantineTableBodyCellProps: { align: 'right' },
        Cell: ({ row }) => (
          <Text fw={700} size="xs" c="teal">
            {formatMoney(row.original.preco_unitario)} / {row.original.unidade || 'UN'}
          </Text>
        ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        size: 85,
        mantineTableHeadCellProps: { align: 'center' },
        mantineTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => {
          const item = row.original
          return (
            <Group gap={4} justify="center" wrap="nowrap">
              <Tooltip label={`Editar cotação de "${item.produto_nome}"`}>
                <ActionIcon
                  variant="subtle"
                  color={themeColor}
                  size="sm"
                  disabled={isFechada}
                  onClick={() => handleAbrirEdicaoCotacao(item)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Remover esta cotação">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
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
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )
        },
      },
    ],
    [deletingId, produtos, isFechada, themeColor],
  )

  const table = useMantineReactTable({
    enableDensityToggle: false,
    columns,
    data: cotacoes,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    initialState: { density: 'xs', pagination: { pageSize: 15, pageIndex: 0 } },
    mantineTableHeadCellProps: {
      style: {
        padding: '6px 8px',
        fontSize: 'var(--app-font-base, 13px)',
        whiteSpace: 'nowrap',
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: '4px 8px',
        fontSize: 'var(--app-font-base, 13px)',
      },
    },
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: true,
    },
    mantinePaperProps: {
      withBorder: true,
      radius: 'sm',
      shadow: 'none',
    },
  })

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <PageHeader
        icon={IconReceipt}
        iconColor={themeColor}
        title="Cotações de Preços"
        subtitle="Normalização automática de preço por unidade"
        rightSection={
          <Group gap="xs">
            <Button
              variant="light"
              color={themeColor}
              size="xs"
              leftSection={<IconUpload size={14} />}
              loading={exportandoExcel}
              onClick={handleExportarExcel}
            >
              Exportar para Excel
            </Button>
            <RoundHeaderSelector
              rodadas={rodadas}
              selectedRodadaId={selectedRodadaId}
              themeColor={themeColor}
              onSelectRodada={(id) => {
                setSelectedRodadaId(id)
                onRodadaChange?.(id)
                carregarCotacoesENecessidades(id)
              }}
            />
          </Group>
        }
      />

      {/* Formulário Turbo de Cadastro de Cotação */}
      <SectionCard
        title="Nova Cotação de Fornecedor"
        subtitle="Fornecedor fixo para lançamento em lote"
        kbdHint="Enter"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
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
                      onClick={() => handleAbrirEdicaoProduto(produtoSelecionado)}
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
                    form.onSubmit(handleSubmit)()
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
      </SectionCard>

      {/* Mantine React Table */}
      {loading ? (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <MantineReactTable table={table} />
      )}


      {/* Modal de Edição Completa de Cotação */}
      <Modal
        opened={modalEditarCotacaoOpened}
        onClose={closeModalEditarCotacao}
        title={
          <Group gap="xs">
            <IconEdit size={18} />
            <Text fw={700}>Editar Cotação</Text>
          </Group>
        }
        centered
        radius="sm"
        size="lg"
      >
        <form onSubmit={formEdicaoCotacao.onSubmit(handleSalvarEdicaoCotacao)}>
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <AppAutocomplete
                label="Fornecedor"
                size="xs"
                placeholder="Selecione o fornecedor..."
                data={nomesFornecedores}
                required
                limit={8}
                {...formEdicaoCotacao.getInputProps('fornecedorNome')}
              />

              <AppAutocomplete
                label="Produto"
                size="xs"
                placeholder="Digite ou selecione o produto..."
                data={nomesTodosProdutos}
                required
                limit={10}
                {...formEdicaoCotacao.getInputProps('produtoNome')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <TextInput
                label="Categoria do Produto (Opcional)"
                size="xs"
                placeholder="Ex: Alimentos, Limpeza, Embalagens..."
                {...formEdicaoCotacao.getInputProps('produtoCategoria')}
              />

              <TextInput
                label="Marca (Opcional)"
                size="xs"
                placeholder="Ex: Ypê, Bombril, 3M..."
                {...formEdicaoCotacao.getInputProps('marca')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="xs">
              <AppAutocomplete
                label="Embalagem"
                size="xs"
                placeholder="Ex: Caixa c/ 24 un"
                data={SUGESTOES_EMBALAGEM}
                required
                {...formEdicaoCotacao.getInputProps('embalagem')}
              />

              <NumberInput
                label="Qtd na Embalagem"
                size="xs"
                placeholder="Ex: 24"
                min={0.001}
                decimalScale={3}
                required
                {...formEdicaoCotacao.getInputProps('qtd_por_embalagem')}
              />

              <AppAutocomplete
                label="Unidade Medida"
                size="xs"
                placeholder="Ex: UN, KG, L"
                data={SUGESTOES_UNIDADES}
                required
                {...formEdicaoCotacao.getInputProps('unidade')}
              />

              <NumberInput
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
                {...formEdicaoCotacao.getInputProps('preco_embalagem')}
              />
            </SimpleGrid>

            {formEdicaoCotacao.values.qtd_por_embalagem > 0 && (
              <Paper p="xs" radius="sm" withBorder bg="var(--mantine-color-gray-light)">
                <Group justify="space-between" align="center">
                  <Text size="xs" c="dimmed">Preço Unitário Calculado:</Text>
                  <Text fw={700} size="sm" c="teal">
                    {formatMoney(
                      (formEdicaoCotacao.values.preco_embalagem || 0) /
                        (formEdicaoCotacao.values.qtd_por_embalagem || 1)
                    )}{' '}
                    /{' '}
                    {formEdicaoCotacao.values.unidade || 'UN'}
                  </Text>
                </Group>
              </Paper>
            )}

            <Group justify="flex-end" gap="xs" mt="md">
              <Button variant="subtle" color="gray" size="xs" onClick={closeModalEditarCotacao}>
                Cancelar
              </Button>
              <Button
                variant="filled"
                color={themeColor}
                size="xs"
                type="submit"
                leftSection={<IconCheck size={14} />}
                loading={salvandoEdicaoCotacao}
              >
                Salvar Alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de Edição de Produto */}
      <Modal
        opened={modalEditarProdutoOpened}
        onClose={closeModalEditarProduto}
        title={
          <Group gap="xs">
            <IconEdit size={18} />
            <Text fw={700}>Editar Cadastro do Produto</Text>
          </Group>
        }
        centered
        radius="sm"
        size="md"
      >
        <form onSubmit={formEdicaoProduto.onSubmit(handleSalvarEdicaoProduto)}>
          <Stack gap="sm">
            <TextInput
              label="Nome do Produto"
              size="xs"
              placeholder="Nome do produto..."
              required
              {...formEdicaoProduto.getInputProps('nome')}
            />

            <TextInput
              label="Categoria"
              size="xs"
              placeholder="Ex: Alimentos, Limpeza, Embalagens..."
              {...formEdicaoProduto.getInputProps('categoria')}
            />

            <Group justify="flex-end" gap="xs" mt="md">
              <Button variant="subtle" color="gray" size="xs" onClick={closeModalEditarProduto}>
                Cancelar
              </Button>
              <Button
                variant="filled"
                color={themeColor}
                size="xs"
                type="submit"
                leftSection={<IconCheck size={14} />}
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

