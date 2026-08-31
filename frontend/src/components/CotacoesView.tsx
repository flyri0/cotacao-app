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
    },
    validate: {
      nome: (value) =>
        value.trim().length === 0 ? 'O nome do produto é obrigatório' : null,
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
        api.listar_produtos(false),
        api.listar_fornecedores(true),
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
        api.listar_cotacoes(idRodada),
        api.listar_necessidades(idRodada),
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
      await api.atualizar_produto(
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
      const salva = await api.criar_cotacao(
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
        Cell: ({ cell }) => <Text fw={600}>{cell.getValue<string>()}</Text>,
      },
      {
        accessorKey: 'marca',
        header: 'Marca',
        size: 130,
        Cell: ({ cell }) => {
          const val = cell.getValue<string | null>()
          return val ? (
            <Badge variant="light" color="indigo">
              {val}
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          )
        },
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
            {row.original.qtd_por_embalagem} {row.original.unidade || 'UN'}
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
            {row.original.unidade || 'UN'}
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
    initialState: { density: 'xs', pagination: { pageSize: 15, pageIndex: 0 } },
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
        iconColor="teal"
        title="Cotações de Preços"
        subtitle="Normalização automática de preço por unidade"
        rightSection={
          <Group gap="xs">
            {isFechada && (
              <Badge variant="filled" color="red" size="xs">
                Rodada Fechada
              </Badge>
            )}
            <Button
              variant="light"
              color="teal"
              size="xs"
              leftSection={<IconDownload size={14} />}
              loading={exportandoExcel}
              onClick={handleExportarPlanilhaModelo}
            >
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              color="teal"
              size="xs"
              leftSection={<IconUpload size={14} />}
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
                          Menor: <b style={{ color: '#059669' }}>{formatMoney(statsProduto.menor_preco)}</b>
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
                            <Badge color="green" size="xs" variant="filled" leftSection={<IconTrendingDown size={12} />}>
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
                size="xs"
                leftSection={<IconPlus size={15} />}
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
            Selecione o fornecedor que enviou os preços e faça o upload da planilha modelo preenchida. Novos produtos serão cadastrados automaticamente.
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

