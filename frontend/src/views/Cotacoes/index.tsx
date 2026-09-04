import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  useComputedColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconEdit,
  IconPackage,
  IconReceipt,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { MRT_Localization_PT_BR } from '../../locales/mrtPtBr'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoundHeaderSelector } from '../../components/form/RoundHeaderSelector'
import { SectionCard } from '../../components/ui/SectionCard'
import { AppAutocomplete, AppSelect } from '../../components/form/AppSelect'
import { getApi } from '../../services/api'
import type {
  Cotacao,
  EstatisticasProduto,
  Fornecedor,
  Necessidade,
  Produto,
  Rodada,
} from '../../types'

import { CotacoesForm, type CotacoesFormValues, type CotacoesFormRef } from './CotacoesForm'
import { useCotacoesColumns } from './useCotacoesColumns'

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

  const [exportandoExcel, setExportandoExcel] = useState(false)

  const rodadaAtual = rodadas.find((r) => r.id === selectedRodadaId)
  const isFechada = rodadaAtual?.status === 'fechada'

  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [modalMassaOpened, { open: openModalMassa, close: closeModalMassa }] = useDisclosure(false)
  const [salvandoMassa, setSalvandoMassa] = useState(false)

  // Campos para edição em massa
  const [massaFornecedorId, setMassaFornecedorId] = useState<string | null>(null)
  const [massaMarca, setMassaMarca] = useState('')
  const [massaEmbalagem, setMassaEmbalagem] = useState('')
  const [massaQtdEmbalagem, setMassaQtdEmbalagem] = useState<number | string>('')
  const [massaUnidade, setMassaUnidade] = useState('')
  const [massaReajustePct, setMassaReajustePct] = useState<number | string>('')

  const selectedQuoteIds = useMemo(() => {
    return Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number)
  }, [rowSelection])

  const formRef = useRef<CotacoesFormRef>(null)

  const form = useForm<CotacoesFormValues>({
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

  const [statsProduto, setStatsProduto] = useState<EstatisticasProduto | null>(null)
  
  const produtoSelecionado = useMemo(() => {
    return produtos.find(
      (p) =>
        p.nome.trim().toLowerCase() === form.values.produtoNome.trim().toLowerCase(),
    )
  }, [produtos, form.values.produtoNome])

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

  useEffect(() => {
    carregarDadosIniciais()
    setTimeout(() => formRef.current?.focusProduto(), 150)
  }, [])

  const handleSubmit = async (values: CotacoesFormValues) => {
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
      formRef.current?.focusFornecedor()
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
      setTimeout(() => formRef.current?.focusProduto(), 50)
    } catch (error: any) {
      console.error('Erro ao salvar cotação:', error)
      notifications.show({
        title: 'Erro ao salvar cotação',
        message: error?.message || 'Falha ao registrar cotação.',
        color: 'red',
        icon: <IconX size={16} />,
      })
      formRef.current?.focusPreco()
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditarEmMassa = async () => {
    if (selectedQuoteIds.length === 0 || isFechada) return

    const updates: any = {}
    if (massaFornecedorId) {
      updates.id_fornecedor = Number(massaFornecedorId)
    }
    if (massaMarca.trim()) {
      updates.marca = massaMarca.trim()
    }
    if (massaEmbalagem.trim()) {
      updates.embalagem = massaEmbalagem.trim()
    }
    if (massaQtdEmbalagem !== '' && Number(massaQtdEmbalagem) > 0) {
      updates.qtd_por_embalagem = Number(massaQtdEmbalagem)
    }
    if (massaUnidade.trim()) {
      updates.unidade = massaUnidade.trim().toUpperCase()
    }
    if (massaReajustePct !== '' && !isNaN(Number(massaReajustePct))) {
      updates.percentual_reajuste = Number(massaReajustePct)
    }

    if (Object.keys(updates).length === 0) {
      notifications.show({
        title: 'Nenhum campo informado',
        message: 'Preencha ao menos um campo para aplicar as alterações em massa.',
        color: 'yellow',
      })
      return
    }

    try {
      setSalvandoMassa(true)
      const api = await getApi()
      const res = await api.batch_update_quotes(selectedQuoteIds, updates)

      if (res.sucesso) {
        notifications.show({
          title: 'Cotações Atualizadas',
          message:
            `${res.atualizados} cotação(ões) atualizada(s) com sucesso.` +
            (res.ignorados > 0
              ? ` (${res.ignorados} ignorada(s) por conflito de produto duplicado)`
              : ''),
          color: res.ignorados > 0 ? 'yellow' : 'teal',
          icon: <IconCheck size={16} />,
        })
        closeModalMassa()
        setMassaFornecedorId(null)
        setMassaMarca('')
        setMassaEmbalagem('')
        setMassaQtdEmbalagem('')
        setMassaUnidade('')
        setMassaReajustePct('')
        setRowSelection({})
        if (selectedRodadaId) {
          await carregarCotacoesENecessidades(selectedRodadaId)
        }
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao atualizar cotações',
        message: err?.message || 'Falha na edição em massa de cotações.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvandoMassa(false)
    }
  }

  const handleExcluirEmMassa = () => {
    if (selectedQuoteIds.length === 0 || isFechada) return

    modals.openConfirmModal({
      title: (
        <Group gap="xs">
          <IconTrash size={18} color="var(--mantine-color-red-6)" />
          <Text fw={700}>Excluir {selectedQuoteIds.length} Cotação(ões)</Text>
        </Group>
      ),
      children: (
        <Text size="xs">
          Tem certeza que deseja excluir permanentemente as <b>{selectedQuoteIds.length}</b> cotações selecionadas desta rodada?
        </Text>
      ),
      labels: { confirm: 'Excluir Cotações', cancel: 'Cancelar' },
      confirmProps: { color: 'red', size: 'xs' },
      cancelProps: { size: 'xs' },
      onConfirm: async () => {
        try {
          const api = await getApi()
          const res = await api.batch_remove_quotes(selectedQuoteIds)
          notifications.show({
            title: 'Cotações Excluídas',
            message: `${res.removidos} cotação(ões) removida(s) com sucesso.`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          })
          setRowSelection({})
          if (selectedRodadaId) {
            await carregarCotacoesENecessidades(selectedRodadaId)
          }
        } catch (err: any) {
          notifications.show({
            title: 'Erro ao excluir cotações',
            message: err?.message || 'Falha ao remover cotações em massa.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        }
      },
    })
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
          formRef.current?.focusProduto()
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

  const columns = useCotacoesColumns({
    isFechada,
    themeColor,
    deletingId,
    onEdit: handleAbrirEdicaoCotacao,
    onRemove: handleRemover,
  })

  const table = useMantineReactTable({
    enableDensityToggle: false,
    columns,
    data: cotacoes,
    localization: MRT_Localization_PT_BR,
    enableRowActions: false,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    enablePagination: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    initialState: { density: 'xs', pagination: { pageSize: 15, pageIndex: 0 } },
    renderTopToolbarCustomActions: () => {
      if (selectedQuoteIds.length === 0) return null
      return (
        <Paper
          withBorder
          radius="sm"
          p="xs"
          style={{
            width: '100%',
            backgroundColor: isDark
              ? 'var(--mantine-color-dark-6)'
              : 'var(--mantine-color-blue-0)',
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap="xs" align="center" wrap="wrap">
              <Badge size="sm" variant="filled" color={themeColor}>
                {selectedQuoteIds.length} cotação{selectedQuoteIds.length > 1 ? 'ões' : ''} selecionada{selectedQuoteIds.length > 1 ? 's' : ''}
              </Badge>
              <Button
                variant="light"
                color={themeColor}
                size="xs"
                leftSection={<IconEdit size={14} />}
                disabled={isFechada}
                onClick={openModalMassa}
              >
                Editar em Massa
              </Button>
              <Button
                variant="filled"
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                disabled={isFechada}
                onClick={handleExcluirEmMassa}
              >
                Excluir Selecionadas
              </Button>
            </Group>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setRowSelection({})}
            >
              Desmarcar Todas
            </Button>
          </Group>
        </Paper>
      )
    },
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

      <SectionCard
        title="Nova Cotação de Fornecedor"
        subtitle="Fornecedor fixo para lançamento em lote"
        kbdHint="Enter"
      >
        <CotacoesForm
          ref={formRef}
          isFechada={isFechada}
          themeColor={themeColor}
          fornecedores={fornecedores}
          nomesFornecedores={nomesFornecedores}
          nomesTodosProdutos={nomesTodosProdutos}
          submitting={submitting}
          onSubmit={handleSubmit}
          onEditarProduto={handleAbrirEdicaoProduto}
          form={form}
          statsProduto={statsProduto}
          produtoSelecionado={produtoSelecionado}
        />
      </SectionCard>

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

      {/* Modal de Edição em Massa de Cotações */}
      <Modal
        opened={modalMassaOpened}
        onClose={closeModalMassa}
        title={
          <Group gap="xs">
            <IconEdit size={18} />
            <Text fw={700}>
              Editar Informações em Massa ({selectedQuoteIds.length} cotação{selectedQuoteIds.length > 1 ? 'ões' : ''})
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
              value={massaFornecedorId}
              onChange={setMassaFornecedorId}
              clearable
            />

            <TextInput
              label="Definir Marca"
              size="xs"
              placeholder="Ex: Ypê, Bombril (opcional)"
              value={massaMarca}
              onChange={(e) => setMassaMarca(e.currentTarget.value)}
            />

            <TextInput
              label="Descrição da Embalagem"
              size="xs"
              placeholder="Ex: Caixa c/ 12, Galão 5L"
              value={massaEmbalagem}
              onChange={(e) => setMassaEmbalagem(e.currentTarget.value)}
            />

            <Group grow gap="xs">
              <NumberInput
                label="Qtd na Emb."
                size="xs"
                placeholder="Ex: 12"
                min={0.01}
                value={massaQtdEmbalagem}
                onChange={setMassaQtdEmbalagem}
              />
              <TextInput
                label="Unidade"
                size="xs"
                placeholder="UN, CX, KG"
                value={massaUnidade}
                onChange={(e) => setMassaUnidade(e.currentTarget.value)}
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
              value={massaReajustePct}
              onChange={setMassaReajustePct}
              suffix="%"
              decimalScale={2}
            />
          </Paper>

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={closeModalMassa}>
              Cancelar
            </Button>
            <Button
              variant="filled"
              color={themeColor}
              size="xs"
              loading={salvandoMassa}
              onClick={handleEditarEmMassa}
            >
              Aplicar a Todas
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
