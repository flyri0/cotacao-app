import { useEffect, useState, useRef } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  FileInput,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBriefcase,
  IconBrowser,
  IconBuildingStore,
  IconCheck,
  IconCoins,
  IconDatabase,
  IconDatabaseExport,
  IconDatabaseImport,
  IconDeviceDesktop,
  IconDeviceFloppy,
  IconDimensions,
  IconFileDatabase,
  IconFolder,
  IconMoon,
  IconPackage,
  IconPalette,
  IconReceipt,
  IconScale,
  IconSettings,
  IconShoppingCart,
  IconSun,
  IconTrash,
  IconTrendingUp,
  IconTypography,
  IconX,
} from '@tabler/icons-react'
import { PageHeader } from './common/PageHeader'
import { AppSelect } from './common/AppSelect'
import { getApi } from '../services/api'
import type { ConfiguracoesApp } from '../types'

export const OPCOES_ICONES = [
  { value: 'Scale', label: 'Balança de Comparação (Padrão)', icon: <IconScale size={18} /> },
  { value: 'ShoppingCart', label: 'Carrinho de Compras', icon: <IconShoppingCart size={18} /> },
  { value: 'BuildingStore', label: 'Loja / Fornecedor', icon: <IconBuildingStore size={18} /> },
  { value: 'Package', label: 'Pacote / Mercadoria', icon: <IconPackage size={18} /> },
  { value: 'TrendingUp', label: 'Gráfico / Estatística', icon: <IconTrendingUp size={18} /> },
  { value: 'Coins', label: 'Moedas / Economia', icon: <IconCoins size={18} /> },
  { value: 'Briefcase', label: 'Maleta Comercial', icon: <IconBriefcase size={18} /> },
  { value: 'Receipt', label: 'Recibo / Cotação', icon: <IconReceipt size={18} /> },
]

export const OPCOES_CORES = [
  { value: 'blue', label: 'Azul Clássico (Padrão)', color: '#228be6' },
  { value: 'teal', label: 'Verde Petróleo', color: '#12b886' },
  { value: 'indigo', label: 'Índigo Moderno', color: '#4c6ef5' },
  { value: 'cyan', label: 'Ciano Vibrante', color: '#15aabf' },
  { value: 'green', label: 'Verde Floresta', color: '#40c057' },
  { value: 'violet', label: 'Violeta / Roxo', color: '#7950f2' },
  { value: 'orange', label: 'Laranja Comercial', color: '#fd7e14' },
]

export const OPCOES_ESQUEMA_COR = [
  { value: 'light', label: 'Modo Claro (Light)', icon: <IconSun size={18} /> },
  { value: 'dark', label: 'Modo Escuro (Dark)', icon: <IconMoon size={18} /> },
  { value: 'auto', label: 'Automático do Sistema (Auto)', icon: <IconDeviceDesktop size={18} /> },
]

interface ConfiguracoesViewProps {
  configuracoes?: ConfiguracoesApp
  onConfiguracoesAlteradas?: (novasConfigs: ConfiguracoesApp) => void
}

export function ConfiguracoesView({ configuracoes, onConfiguracoesAlteradas }: ConfiguracoesViewProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [loadingAcaoBanco, setLoadingAcaoBanco] = useState(false)

  // Modais
  const [modalExportarOpened, { open: openModalExportar, close: closeModalExportar }] =
    useDisclosure(false)
  const [modalImportarOpened, { open: openModalImportar, close: closeModalImportar }] =
    useDisclosure(false)
  const [modalFormatar1Opened, { open: openModalFormatar1, close: closeModalFormatar1 }] =
    useDisclosure(false)
  const [modalFormatar2Opened, { open: openModalFormatar2, close: closeModalFormatar2 }] =
    useDisclosure(false)

  // Timers de 5 segundos
  const [timerExportar, setTimerExportar] = useState<number>(5)
  const [timerImportar, setTimerImportar] = useState<number>(5)
  const [timerFormatar, setTimerFormatar] = useState<number>(5)

  // Estados de confirmação
  const [nomeArquivoBackup, setNomeArquivoBackup] = useState('')
  const [arquivoImportar, setArquivoImportar] = useState<File | null>(null)
  const [palavraConfirmacaoFormatar, setPalavraConfirmacaoFormatar] = useState('')

  const timerRef = useRef<number | null>(null)

  const form = useForm({
    initialValues: {
      app_nome: configuracoes?.app_nome || 'Mapa de Cotações',
      app_subtitulo: configuracoes?.app_subtitulo || 'Comparativo e Alocação Inteligente',
      app_icone: configuracoes?.app_icone || 'Scale',
      app_theme_color: configuracoes?.app_theme_color || 'blue',
      app_color_scheme: (configuracoes?.app_color_scheme || colorScheme || 'light') as 'light' | 'dark' | 'auto',
      app_densidade: (configuracoes?.app_densidade || 'compacto') as 'compacto' | 'confortavel',
      app_tamanho_fonte: configuracoes?.app_tamanho_fonte || '13.5',
      app_modo_execucao: (configuracoes?.app_modo_execucao || 'janela') as 'janela' | 'navegador',
    },
  })

  // Sincroniza form quando configuracoes globais carregarem
  useEffect(() => {
    if (configuracoes) {
      const scheme = (configuracoes.app_color_scheme || colorScheme || 'light') as 'light' | 'dark' | 'auto'
      
      form.setValues({
        app_nome: configuracoes.app_nome || 'Mapa de Cotações',
        app_subtitulo: configuracoes.app_subtitulo || 'Comparativo e Alocação Inteligente',
        app_icone: configuracoes.app_icone || 'Scale',
        app_theme_color: configuracoes.app_theme_color || 'blue',
        app_color_scheme: scheme,
        app_densidade: (configuracoes.app_densidade || 'compacto') as 'compacto' | 'confortavel',
        app_tamanho_fonte: configuracoes.app_tamanho_fonte || '13.5',
        app_modo_execucao: (configuracoes.app_modo_execucao || 'janela') as 'janela' | 'navegador',
      })
    }
  }, [configuracoes, colorScheme])

  // Gerenciador de timers regressivos de segurança (5 segundos)
  const iniciarTimer = (setter: (val: number | ((prev: number) => number)) => void) => {
    setter(5)
    if (timerRef.current) clearInterval(timerRef.current)
    let contador = 5
    timerRef.current = window.setInterval(() => {
      contador -= 1
      setter(contador)
      if (contador <= 0 && timerRef.current) {
        clearInterval(timerRef.current)
      }
    }, 1000)
  }

  const handleOpenExportar = () => {
    const dataHora = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 15)
    setNomeArquivoBackup(`backup_cotacao_${dataHora}.db`)
    iniciarTimer(setTimerExportar)
    openModalExportar()
  }

  const handleOpenImportar = () => {
    setArquivoImportar(null)
    iniciarTimer(setTimerImportar)
    openModalImportar()
  }

  const handleOpenFormatar = () => {
    setPalavraConfirmacaoFormatar('')
    iniciarTimer(setTimerFormatar)
    openModalFormatar1()
  }

  const handleAvancarFormatar2 = () => {
    closeModalFormatar1()
    setPalavraConfirmacaoFormatar('')
    openModalFormatar2()
  }

  // Alteração imediata de tema no seletor com aplicação instantânea
  const handleMudarTema = async (val: string | null) => {
    if (val === 'light' || val === 'dark' || val === 'auto') {
      form.setFieldValue('app_color_scheme', val)
      setColorScheme(val)
      const atualizadas: ConfiguracoesApp = {
        ...form.values,
        app_color_scheme: val,
      }
      onConfiguracoesAlteradas?.(atualizadas)
      try {
        const api = await getApi()
        await api.save_settings(atualizadas)
      } catch (err) {
        console.error('Erro ao salvar preferência de tema:', err)
      }
    }
  }

  // Alteração imediata de densidade com aplicação instantânea
  const handleMudarDensidade = async (val: string) => {
    const densidade = (val === 'confortavel' ? 'confortavel' : 'compacto') as 'compacto' | 'confortavel'
    form.setFieldValue('app_densidade', densidade)
    document.documentElement.setAttribute('data-density', densidade)
    const atualizadas: ConfiguracoesApp = {
      ...form.values,
      app_densidade: densidade,
    }
    onConfiguracoesAlteradas?.(atualizadas)
    try {
      const api = await getApi()
      await api.save_settings(atualizadas)
    } catch (err) {
      console.error('Erro ao salvar preferência de densidade:', err)
    }
  }

  // Alteração imediata de tamanho de fonte com aplicação instantânea
  const handleMudarTamanhoFonte = async (numVal: number) => {
    const tamanhoStr = String(numVal)
    form.setFieldValue('app_tamanho_fonte', tamanhoStr)
    
    document.documentElement.style.setProperty('font-size', `${numVal}px`)
    document.documentElement.style.setProperty('--app-font-base', `${numVal}px`)
    document.documentElement.style.setProperty('--app-font-sm', `${Math.round(numVal * 0.88)}px`)
    document.documentElement.style.setProperty('--app-font-xs', `${Math.round(numVal * 0.81)}px`)
    document.documentElement.removeAttribute('data-font-size')
    const atualizadas: ConfiguracoesApp = {
      ...form.values,
      app_tamanho_fonte: tamanhoStr,
    }
    onConfiguracoesAlteradas?.(atualizadas)
    try {
      const api = await getApi()
      await api.save_settings(atualizadas)
    } catch (err) {
      console.error('Erro ao salvar preferência de tamanho de fonte:', err)
    }
  }

  // Alteração de modo de execução (Janela vs Navegador)
  const handleMudarModoExecucao = async (val: string) => {
    const modo = (val === 'navegador' ? 'navegador' : 'janela') as 'janela' | 'navegador'
    form.setFieldValue('app_modo_execucao', modo)
    const atualizadas: ConfiguracoesApp = {
      ...form.values,
      app_modo_execucao: modo,
    }
    onConfiguracoesAlteradas?.(atualizadas)
    try {
      const api = await getApi()
      await api.save_settings(atualizadas)
      notifications.show({
        title: 'Modo de Execução Atualizado',
        message: `O aplicativo será aberto no modo ${modo === 'navegador' ? 'Navegador Padrão' : 'Janela Nativa'} na próxima inicialização.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      })
    } catch (err) {
      console.error('Erro ao salvar modo de execução:', err)
    }
  }

  // Salvar Identidade Visual e Preferências
  const handleSubmitConfigs = async (values: typeof form.values) => {
    try {
      setSalvandoConfig(true)
      const api = await getApi()
      const atualizadas = await api.save_settings(values)
      setColorScheme(values.app_color_scheme)
      if (values.app_densidade) {
        document.documentElement.setAttribute('data-density', values.app_densidade)
      }
      if (values.app_tamanho_fonte) {
        document.documentElement.setAttribute('data-font-size', values.app_tamanho_fonte)
      }

      notifications.show({
        title: 'Configurações Salvas',
        message: 'A identidade visual, densidade e preferências foram salvas com sucesso no banco de dados.',
        color: 'green',
        icon: <IconCheck size={16} />,
      })

      onConfiguracoesAlteradas?.(atualizadas)
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error)
      notifications.show({
        title: 'Erro ao salvar',
        message: error?.message || 'Não foi possível salvar as configurações.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSalvandoConfig(false)
    }
  }

  // AÇÃO 1: Escolher Local do Backup via Diálogo Nativo do SO (Salvar Como...)
  const handleSalvarBackupDialogoNativo = async () => {
    try {
      setLoadingAcaoBanco(true)
      const api = await getApi()
      const res = await api.select_location_and_save_backup(nomeArquivoBackup)

      if (res.cancelado) {
        notifications.show({
          title: 'Operação Cancelada',
          message: 'Nenhum local foi selecionado para o backup.',
          color: 'gray',
          icon: <IconAlertCircle size={16} />,
        })
        return
      }

      if (res.conteudo_base64) {
        // Fallback em navegador
        const linkSource = `data:application/octet-stream;base64,${res.conteudo_base64}`
        const downloadLink = document.createElement('a')
        downloadLink.href = linkSource
        downloadLink.download = res.nome_arquivo || nomeArquivoBackup
        downloadLink.click()
      }

      notifications.show({
        title: 'Backup Gravado com Sucesso',
        message: res.caminho
          ? `Arquivo salvo em: ${res.caminho}`
          : `Arquivo ${res.nome_arquivo || nomeArquivoBackup} baixado com sucesso.`,
        color: 'teal',
        icon: <IconDatabaseExport size={16} />,
        autoClose: 6000,
      })

      closeModalExportar()
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao salvar backup',
        message: error?.message || 'Falha ao gravar arquivo de backup.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoadingAcaoBanco(false)
    }
  }

  // AÇÃO 2C: Baixar Diretamente pelo Navegador (Base64)
  const handleDownloadDiretoNavegador = async () => {
    try {
      setLoadingAcaoBanco(true)
      const api = await getApi()
      const res = await api.export_database()

      const linkSource = `data:application/octet-stream;base64,${res.conteudo_base64}`
      const downloadLink = document.createElement('a')
      downloadLink.href = linkSource
      downloadLink.download = nomeArquivoBackup || res.nome_arquivo
      downloadLink.click()

      notifications.show({
        title: 'Download de Backup Iniciado',
        message: `O arquivo ${nomeArquivoBackup || res.nome_arquivo} foi enviado ao navegador.`,
        color: 'teal',
        icon: <IconDatabaseExport size={16} />,
      })

      closeModalExportar()
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao exportar',
        message: error?.message || 'Falha ao gerar arquivo de backup.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoadingAcaoBanco(false)
    }
  }

  // AÇÃO 3: Importar Banco de Dados (.db em Base64)
  const handleConfirmarImportacao = async () => {
    if (!arquivoImportar) {
      notifications.show({
        title: 'Selecione um arquivo',
        message: 'Escolha um arquivo .db ou .sqlite para restaurar.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    try {
      setLoadingAcaoBanco(true)
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer
          const bytes = new Uint8Array(buffer)
          let binary = ''
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          const base64 = window.btoa(binary)

          const api = await getApi()
          await api.import_database(base64)

          notifications.show({
            title: 'Banco Restaurado com Sucesso',
            message: 'O arquivo SQLite foi importado e validado.',
            color: 'green',
            icon: <IconCheck size={16} />,
          })

          closeModalImportar()
          const dados = await api.get_settings()
          onConfiguracoesAlteradas?.(dados)
        } catch (err: any) {
          notifications.show({
            title: 'Erro na importação',
            message: err?.message || 'O arquivo fornecido não é um banco SQLite válido.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        } finally {
          setLoadingAcaoBanco(false)
        }
      }
      reader.readAsArrayBuffer(arquivoImportar)
    } catch (error: any) {
      setLoadingAcaoBanco(false)
      notifications.show({
        title: 'Erro de leitura',
        message: error?.message || 'Não foi possível ler o arquivo.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    }
  }

  // AÇÃO 4: Formatar Banco de Dados (Wipe Total - 2ª Etapa)
  const handleConfirmarFormatacaoFinal = async () => {
    if (palavraConfirmacaoFormatar.trim().toUpperCase() !== 'FORMATAR') {
      notifications.show({
        title: 'Palavra-chave incorreta',
        message: 'Digite exatamente a palavra FORMATAR para autorizar a limpeza.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    try {
      setLoadingAcaoBanco(true)
      const api = await getApi()
      await api.format_database(false)

      notifications.show({
        title: 'Banco de Dados Formatado',
        message: 'Todas as tabelas foram limpas e recriadas vazias com sucesso.',
        color: 'blue',
        icon: <IconCheck size={16} />,
      })

      closeModalFormatar2()
      const dados = await api.get_settings()
      onConfiguracoesAlteradas?.(dados)
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao formatar',
        message: error?.message || 'Falha ao formatar banco de dados.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoadingAcaoBanco(false)
    }
  }

  return (
    <Stack gap="sm" style={{ width: '100%' }}>
      {/* Cabeçalho */}
      <PageHeader
        icon={IconSettings}
        iconColor="gray"
        title="Configurações do Aplicativo"
        subtitle="Personalize densidade, tamanho de fonte, tema visual e gerencie o banco de dados SQLite local"
      />

      {/* SEÇÃO 1: Densidade da Interface & Tamanho do Texto (Acessibilidade & Compactação) */}
      <Card withBorder radius="sm" p="sm">
        <Title order={4} mb={2} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconDimensions size={18} />
          Densidade & Acessibilidade Tipográfica
        </Title>
        <Text size="xs" c="dimmed" mb="sm">
          Ajuste a densidade de linhas e o tamanho da fonte para o seu estilo de uso. A aplicação atualiza instantaneamente.
        </Text>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
          {/* Opção 1: Densidade */}
          <Paper withBorder p="xs" radius="sm">
            <Group gap={6} mb={4} align="center">
              <ThemeIcon size={22} radius="xs" variant="light" color="blue">
                <IconDimensions size={14} />
              </ThemeIcon>
              <Text fw={700} size="xs">
                Densidade da Interface
              </Text>
            </Group>
            <Text size="11px" c="dimmed" mb="xs">
              Reduz paddings de tabelas, cards e cabeçalhos para exibir mais dados na tela.
            </Text>
            <SegmentedControl
              fullWidth
              size="xs"
              value={form.values.app_densidade}
              onChange={handleMudarDensidade}
              data={[
                { label: 'Compacto (Padrão)', value: 'compacto' },
                { label: 'Confortável', value: 'confortavel' },
              ]}
            />
          </Paper>

          {/* Opção 2: Tamanho da Fonte */}
          <Paper withBorder p="xs" radius="sm">
            <Group gap={6} mb={4} align="center">
              <ThemeIcon size={22} radius="xs" variant="light" color="indigo">
                <IconTypography size={14} />
              </ThemeIcon>
              <Text fw={700} size="xs">
                Tamanho da Fonte
              </Text>
            </Group>
            <Text size="11px" c="dimmed" mb="xs">
              Altere o tamanho geral das fontes para facilitar a leitura sem distorcer o layout.
            </Text>
            <Slider
              mt="md"
              mb="xl"
              min={10}
              max={20}
              step={0.5}
              marks={[
                { value: 10, label: '10px' },
                { value: 13.5, label: '13.5px' },
                { value: 16, label: '16px' },
                { value: 20, label: '20px' },
              ]}
              value={parseFloat(form.values.app_tamanho_fonte) || 13.5}
              onChange={handleMudarTamanhoFonte}
            />
          </Paper>

          {/* Opção 3: Modo de Inicialização (Desktop vs Navegador) */}
          <Paper withBorder p="xs" radius="sm">
            <Group gap={6} mb={4} align="center">
              <ThemeIcon size={22} radius="xs" variant="light" color="teal">
                <IconBrowser size={14} />
              </ThemeIcon>
              <Text fw={700} size="xs">
                Modo de Inicialização
              </Text>
            </Group>
            <Text size="11px" c="dimmed" mb="xs">
              Janela própria ou Navegador padrão (recomendado p/ Windows 7 32-bit ou PCs leves).
            </Text>
            <SegmentedControl
              fullWidth
              size="xs"
              value={form.values.app_modo_execucao}
              onChange={handleMudarModoExecucao}
              data={[
                { label: 'Janela Nativa', value: 'janela' },
                { label: 'Navegador Padrão', value: 'navegador' },
              ]}
            />
          </Paper>
        </SimpleGrid>

        {/* Demonstração / Preview em Tempo Real */}
        <Paper withBorder p={8} radius="xs" mt="xs" bg={computedColorScheme === 'dark' ? 'dark.7' : 'gray.0'}>
          <Text size="10px" fw={700} c="dimmed" tt="uppercase" mb={4}>
            Demonstração ao Vivo da Densidade e Fonte:
          </Text>
          <Table withTableBorder withColumnBorders striped style={{ backgroundColor: computedColorScheme === 'dark' ? '#1a1b1e' : '#ffffff' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: '40%' }}>Produto Demonstrativo</Table.Th>
                <Table.Th style={{ width: '30%' }}>Fornecedor</Table.Th>
                <Table.Th style={{ width: '18%', textAlign: 'right' }}>Preço Unitário</Table.Th>
                <Table.Th style={{ width: '12%', textAlign: 'center' }}>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={600}>Café Torrado Superior 500g</Table.Td>
                <Table.Td>Distribuidora Aliança</Table.Td>
                <Table.Td style={{ textAlign: 'right' }} c="teal.7" fw={700}>R$ 18,90 / UN</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}><Badge size="xs" color="teal" variant="light">Menor Preço</Badge></Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={600}>Detergente Neutro 5L</Table.Td>
                <Table.Td>Comercial Limpeza Total</Table.Td>
                <Table.Td style={{ textAlign: 'right' }} fw={700}>R$ 4,50 / L</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}><Badge size="xs" color="blue" variant="light">Alocado</Badge></Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Paper>
      </Card>

      {/* SEÇÃO 2: Identidade Visual e Tema Claro/Escuro */}
      <Card withBorder radius="sm" p="sm">
        <Title order={4} mb={2} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconPalette size={18} />
          Identidade Visual & Tema
        </Title>
        <Text size="xs" c="dimmed" mb="sm">
          O modo de exibição (claro/escuro), nome, subtítulo, ícone e paleta de cores ficam salvos no banco SQLite
        </Text>

        <form onSubmit={form.onSubmit(handleSubmitConfigs)}>
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput
                label="Nome do Aplicativo"
                size="xs"
                placeholder="Ex: Mapa de Cotações"
                required
                {...form.getInputProps('app_nome')}
              />

              <TextInput
                label="Subtítulo do Cabeçalho"
                size="xs"
                placeholder="Ex: Comparativo e Alocação Inteligente"
                required
                {...form.getInputProps('app_subtitulo')}
              />

              <AppSelect
                label="Modo de Exibição"
                size="xs"
                data={OPCOES_ESQUEMA_COR.map((op) => ({
                  value: op.value,
                  label: op.label,
                }))}
                value={form.values.app_color_scheme}
                onChange={handleMudarTema}
                allowDeselect={false}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <AppSelect
                label="Ícone do Cabeçalho"
                size="xs"
                data={OPCOES_ICONES.map((op) => ({
                  value: op.value,
                  label: op.label,
                }))}
                {...form.getInputProps('app_icone')}
                allowDeselect={false}
              />

              <AppSelect
                label="Cor de Destaque do Tema"
                size="xs"
                data={OPCOES_CORES.map((op) => ({
                  value: op.value,
                  label: op.label,
                }))}
                {...form.getInputProps('app_theme_color')}
                allowDeselect={false}
              />
            </SimpleGrid>

            {/* Preview da Barra */}
            <Paper withBorder p={8} radius="xs" mt={4}>
              <Text size="10px" fw={700} c="dimmed" tt="uppercase" mb={2}>
                Pré-visualização do Cabeçalho:
              </Text>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <ThemeIcon
                    size={28}
                    radius="sm"
                    variant="filled"
                    color={form.values.app_theme_color || 'blue'}
                  >
                    {OPCOES_ICONES.find((i) => i.value === form.values.app_icone)?.icon || (
                      <IconScale size={18} />
                    )}
                  </ThemeIcon>
                  <div>
                    <Title order={5} style={{ lineHeight: 1.1, fontSize: '0.9rem' }}>
                      {form.values.app_nome || 'Mapa de Cotações'}
                    </Title>
                    <Text size="10px" c="dimmed">
                      {form.values.app_subtitulo || 'Comparativo e Alocação Inteligente'}
                    </Text>
                  </div>
                </Group>
                <Group gap={6}>
                  <Badge variant="light" size="xs" color={form.values.app_theme_color || 'blue'}>
                    {computedColorScheme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
                  </Badge>
                  <Badge variant="outline" size="xs" color={form.values.app_theme_color || 'blue'}>
                    Desktop
                  </Badge>
                </Group>
              </Group>
            </Paper>

            <Group justify="flex-end" mt="xs">
              <Button
                type="submit"
                size="xs"
                leftSection={<IconDeviceFloppy size={14} />}
                loading={salvandoConfig}
                color={form.values.app_theme_color || 'blue'}
              >
                Salvar Preferências
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* SEÇÃO 3: Gerenciamento Seguro do Banco de Dados SQLite */}
      <Card withBorder shadow="none" radius="sm" p="sm">
        <Title order={3} mb="xs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconDatabase size={22} />
          Gerenciamento do Banco de Dados (SQLite Local)
        </Title>
        <Text size="xs" c="dimmed" mb="lg">
          Arquivo local independente (<b>cotacao.db</b>). Todas as ações críticas contam com confirmação segura e timer de proteção.
        </Text>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {/* Card 1: Backup / Restaurar */}
          <Paper withBorder p="md" radius="md">
            <Stack justify="space-between" h="100%">
              <div>
                <Group gap="xs" mb="xs">
                  <ThemeIcon color="teal" variant="light" size="lg" radius="md">
                    <IconFileDatabase size={20} />
                  </ThemeIcon>
                  <Title order={4}>Backup & Restauração</Title>
                </Group>
                <Text size="xs" c="dimmed">
                  Gere cópias de segurança escolhendo a pasta de destino no computador ou restaure um backup existente.
                </Text>
              </div>

              <Group gap="xs" mt="md" grow>
                <Button
                  variant="outline"
                  color="teal"
                  size="xs"
                  leftSection={<IconDatabaseExport size={14} />}
                  onClick={handleOpenExportar}
                >
                  Fazer Backup...
                </Button>
                <Button
                  variant="light"
                  color="teal"
                  size="xs"
                  leftSection={<IconDatabaseImport size={14} />}
                  onClick={handleOpenImportar}
                >
                  Importar .db
                </Button>
              </Group>
            </Stack>
          </Paper>

          {/* Card 2: Formatar / Limpar Tudo */}
          <Paper withBorder p="md" radius="md" style={{ borderColor: '#ffa8a8' }}>
            <Stack justify="space-between" h="100%">
              <div>
                <Group gap="xs" mb="xs">
                  <ThemeIcon color="red" variant="light" size="lg" radius="md">
                    <IconTrash size={20} />
                  </ThemeIcon>
                  <Title order={4} c="red.8">
                    Formatar Banco
                  </Title>
                </Group>
                <Text size="xs" c="dimmed">
                  Exclui permanentemente todos os produtos, fornecedores, cotações e alocações. Requer <b>dupla confirmação</b>.
                </Text>
              </div>

              <Button
                variant="filled"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleOpenFormatar}
                mt="md"
              >
                Formatar Banco...
              </Button>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Card>

      {/* MODAL 2: Exportar Backup do Banco com Pergunta de Local (Timer 5s) */}
      <Modal
        opened={modalExportarOpened}
        onClose={closeModalExportar}
        title={
          <Group gap="xs">
            <IconDatabaseExport size={22} color="#12b886" />
            <Text fw={700}>Exportar Cópia de Segurança (Backup do Banco)</Text>
          </Group>
        }
        size="lg"
        centered
      >
        <Stack gap="md">
          <Alert color="teal" variant="light">
            <Text size="sm">
              Será gerado um arquivo com a cópia exata de todos os dados do banco local{' '}
              <b>cotacao.db</b> (produtos, fornecedores, necessidades, cotações e alocações).
            </Text>
          </Alert>

          <TextInput
            label="Nome do Arquivo de Backup"
            description="Você pode personalizar o nome do arquivo gerado"
            value={nomeArquivoBackup}
            onChange={(e) => setNomeArquivoBackup(e.currentTarget.value)}
            required
          />

          <Divider label="Onde você deseja salvar o backup?" labelPosition="center" my="xs" />

          {/* Opção Principal: Diálogo do Sistema Operacional */}
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="center">
              <div>
                <Group gap="xs">
                  <ThemeIcon color="teal" variant="light" size="md">
                    <IconFolder size={18} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Escolher Local pelo Sistema Operacional (Recomendado)
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  Abre a janela nativa do Windows para você escolher a pasta de destino desejada.
                </Text>
              </div>

              <Button
                color="teal"
                variant="filled"
                disabled={timerExportar > 0 || !nomeArquivoBackup.trim()}
                loading={loadingAcaoBanco}
                onClick={handleSalvarBackupDialogoNativo}
              >
                {timerExportar > 0
                  ? `Aguarde (${timerExportar}s)...`
                  : 'Escolher Pasta & Salvar'}
              </Button>
            </Group>
          </Paper>

          <Group justify="space-between" mt="md">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              disabled={timerExportar > 0}
              onClick={handleDownloadDiretoNavegador}
            >
              Baixar via Navegador
            </Button>

            <Button variant="default" onClick={closeModalExportar}>
              Fechar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL 3: Importar Banco de Dados (Timer 5s) */}
      <Modal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        title={
          <Group gap="xs">
            <IconDatabaseImport size={20} color="#12b886" />
            <Text fw={700}>Importar Banco de Dados (.db)</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Alert color="teal" variant="light">
            <Text size="sm">
              Você está prestes a carregar um arquivo <b>.db</b> ou <b>.sqlite</b>. Os dados
              atuais serão substituídos integralmente pelo arquivo selecionado.
            </Text>
          </Alert>

          <FileInput
            label="Selecione o arquivo SQLite (.db)"
            placeholder="Clique para escolher o arquivo .db"
            accept=".db,.sqlite"
            value={arquivoImportar}
            onChange={setArquivoImportar}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeModalImportar}>
              Cancelar
            </Button>
            <Button
              color="teal"
              disabled={timerImportar > 0 || !arquivoImportar}
              loading={loadingAcaoBanco}
              onClick={handleConfirmarImportacao}
            >
              {timerImportar > 0
                ? `Liberando (${timerImportar}s)...`
                : 'Restaurar Banco de Dados'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL 4 - ETAPA 1: Formatar Banco (Aviso Crítico + Timer 5s) */}
      <Modal
        opened={modalFormatar1Opened}
        onClose={closeModalFormatar1}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={22} color="#fa5252" />
            <Text fw={700} c="red.8">
              Etapa 1/2: Alerta de Formatação Total
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Alert color="red" variant="filled">
            <Text size="sm" fw={700}>
              ATENÇÃO: AÇÃO IRREVERSÍVEL!
            </Text>
            <Text size="xs" mt={4}>
              A formatação irá apagar <b>TODOS</b> os produtos, fornecedores, histórico de
              cotações, rodadas e decisões de alocação. O banco ficará totalmente vazio.
            </Text>
          </Alert>

          <Text size="sm">
            Recomendamos exportar um backup antes de prosseguir. Para sua segurança, aguarde a
            contagem regressiva para avançar para a tela de confirmação final.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeModalFormatar1}>
              Cancelar
            </Button>
            <Button
              color="red"
              disabled={timerFormatar > 0}
              onClick={handleAvancarFormatar2}
            >
              {timerFormatar > 0
                ? `Aguarde (${timerFormatar}s)...`
                : 'Avançar para Confirmação Final'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL 4 - ETAPA 2: Formatar Banco (Confirmação com Palavra-Chave 'FORMATAR') */}
      <Modal
        opened={modalFormatar2Opened}
        onClose={closeModalFormatar2}
        title={
          <Group gap="xs">
            <IconTrash size={22} color="#fa5252" />
            <Text fw={700} c="red.8">
              Etapa 2/2: Confirmação Definitiva
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Para autorizar a formatação imediata de todo o banco de dados, digite exatamente{' '}
            <Text span fw={700} c="red">
              FORMATAR
            </Text>{' '}
            no campo abaixo:
          </Text>

          <TextInput
            placeholder="Digite FORMATAR..."
            value={palavraConfirmacaoFormatar}
            onChange={(e) => setPalavraConfirmacaoFormatar(e.currentTarget.value)}
            required
            autoFocus
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeModalFormatar2}>
              Cancelar
            </Button>
            <Button
              color="red"
              variant="filled"
              disabled={palavraConfirmacaoFormatar.trim().toUpperCase() !== 'FORMATAR'}
              loading={loadingAcaoBanco}
              onClick={handleConfirmarFormatacaoFinal}
            >
              Apagar Tudo Definitivamente
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default ConfiguracoesView
