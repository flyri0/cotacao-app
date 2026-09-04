import { useEffect, useState, useRef } from 'react'
import {
  Alert,
  Button,
  FileInput,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconDatabaseImport,
  IconFolderCheck,
  IconSettings,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { getApi } from '../../services/api'
import type { ConfiguracoesApp } from '../../types'

import { DensidadeSection } from './DensidadeSection'
import { IdentidadeVisualSection } from './IdentidadeVisualSection'
import { DatabaseSection } from './DatabaseSection'

interface ConfiguracoesViewProps {
  configuracoes?: ConfiguracoesApp
  onConfiguracoesAlteradas?: (novasConfigs: ConfiguracoesApp) => void
  themeColor?: string
}

export function ConfiguracoesView({
  configuracoes,
  onConfiguracoesAlteradas,
  themeColor = 'blue',
}: ConfiguracoesViewProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [loadingAcaoBanco, setLoadingAcaoBanco] = useState(false)

  // Modais
  const [modalImportarOpened, { open: openModalImportar, close: closeModalImportar }] =
    useDisclosure(false)
  const [modalFormatar1Opened, { open: openModalFormatar1, close: closeModalFormatar1 }] =
    useDisclosure(false)
  const [modalFormatar2Opened, { open: openModalFormatar2, close: closeModalFormatar2 }] =
    useDisclosure(false)

  // Timers de 5 segundos
  const [timerImportar, setTimerImportar] = useState<number>(5)
  const [timerFormatar, setTimerFormatar] = useState<number>(5)

  // Estados de confirmação
  const [arquivoImportar, setArquivoImportar] = useState<File | null>(null)
  const [palavraConfirmacaoFormatar, setPalavraConfirmacaoFormatar] = useState('')

  // Estados de backup automático
  const [executandoBackupAuto, setExecutandoBackupAuto] = useState(false)
  const [selecionandoPasta, setSelecionandoPasta] = useState(false)
  const [ultimoBackupSucesso, setUltimoBackupSucesso] = useState(configuracoes?.backup_auto_ultimo_sucesso || '')
  const [ultimoBackupStatus, setUltimoBackupStatus] = useState(configuracoes?.backup_auto_ultimo_status || '')

  const timerRef = useRef<number | null>(null)

  const form = useForm({
    initialValues: {
      app_nome: configuracoes?.app_nome || 'Mapa de Cotações',
      app_subtitulo: configuracoes?.app_subtitulo || 'Comparativo e Alocação Inteligente',
      app_icone: configuracoes?.app_icone || 'Scale',
      app_theme_color: configuracoes?.app_theme_color || 'blue',
      app_color_scheme: (configuracoes?.app_color_scheme || colorScheme || 'auto') as 'light' | 'dark' | 'auto',
      app_densidade: (configuracoes?.app_densidade || 'compacto') as 'compacto' | 'confortavel',
      app_tamanho_fonte: configuracoes?.app_tamanho_fonte || '13.5',
      app_modo_execucao: (configuracoes?.app_modo_execucao || 'janela') as 'janela' | 'navegador',
      backup_auto_ativo: configuracoes?.backup_auto_ativo === '1',
      backup_auto_diretorio: configuracoes?.backup_auto_diretorio || '',
      backup_auto_gatilho: (configuracoes?.backup_auto_gatilho || 'abertura') as string,
      backup_auto_intervalo_horas: String(configuracoes?.backup_auto_intervalo_horas || '4'),
      backup_auto_max_arquivos: parseInt(String(configuracoes?.backup_auto_max_arquivos || '10'), 10),
    },
  })

  // Sincroniza form quando configuracoes globais carregarem
  useEffect(() => {
    if (configuracoes) {
      const scheme = (configuracoes.app_color_scheme || colorScheme || 'auto') as 'light' | 'dark' | 'auto'
      
      form.setValues({
        app_nome: configuracoes.app_nome || 'Mapa de Cotações',
        app_subtitulo: configuracoes.app_subtitulo || 'Comparativo e Alocação Inteligente',
        app_icone: configuracoes.app_icone || 'Scale',
        app_theme_color: configuracoes.app_theme_color || 'blue',
        app_color_scheme: scheme,
        app_densidade: (configuracoes.app_densidade || 'compacto') as 'compacto' | 'confortavel',
        app_tamanho_fonte: configuracoes.app_tamanho_fonte || '13.5',
        app_modo_execucao: (configuracoes.app_modo_execucao || 'janela') as 'janela' | 'navegador',
        backup_auto_ativo: configuracoes.backup_auto_ativo === '1',
        backup_auto_diretorio: configuracoes.backup_auto_diretorio || '',
        backup_auto_gatilho: configuracoes.backup_auto_gatilho || 'abertura',
        backup_auto_intervalo_horas: String(configuracoes.backup_auto_intervalo_horas || '4'),
        backup_auto_max_arquivos: parseInt(String(configuracoes.backup_auto_max_arquivos || '10'), 10),
      })

      setUltimoBackupSucesso(configuracoes.backup_auto_ultimo_sucesso || '')
      setUltimoBackupStatus(configuracoes.backup_auto_ultimo_status || '')
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
      const payload: Record<string, any> = {
        ...values,
        backup_auto_ativo: values.backup_auto_ativo ? '1' : '0',
        backup_auto_intervalo_horas: String(values.backup_auto_intervalo_horas || '4'),
        backup_auto_max_arquivos: String(values.backup_auto_max_arquivos || 10),
      }
      const atualizadas = await api.save_settings(payload)
      setColorScheme(values.app_color_scheme)
      if (values.app_densidade) {
        document.documentElement.setAttribute('data-density', values.app_densidade)
      }
      if (values.app_tamanho_fonte) {
        document.documentElement.setAttribute('data-font-size', values.app_tamanho_fonte)
      }

      notifications.show({
        title: 'Configurações Salvas',
        message: 'A identidade visual, preferências e backup automático foram salvos com sucesso.',
        color: 'teal',
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

  // AÇÃO BACKUP AUTO 1: Selecionar pasta exclusivamente pelo diálogo nativo
  const handleSelecionarPastaBackup = async () => {
    try {
      setSelecionandoPasta(true)
      const api = await getApi()
      const res = await api.select_backup_directory()
      if (res.cancelado) {
        return
      }
      if (!res.sucesso) {
        notifications.show({
          title: 'Aviso de Permissão de Pasta',
          message: res.mensagem || 'Não foi possível selecionar ou gravar nesta pasta.',
          color: 'red',
          icon: <IconAlertTriangle size={16} />,
        })
        return
      }
      if (res.caminho) {
        form.setFieldValue('backup_auto_diretorio', res.caminho)
        notifications.show({
          title: 'Pasta de Backup Selecionada',
          message: `Diretório com permissão de escrita confirmado: ${res.caminho}`,
          color: 'teal',
          icon: <IconFolderCheck size={16} />,
        })
      }
    } catch (error: any) {
      notifications.show({
        title: 'Erro ao Selecionar Pasta',
        message: error?.message || 'Falha ao acionar diálogo de seleção.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setSelecionandoPasta(false)
    }
  }

  // AÇÃO BACKUP AUTO 2: Executar e testar backup automático imediatamente
  const handleTestarBackupAgora = async () => {
    if (!form.values.backup_auto_diretorio) {
      notifications.show({
        title: 'Diretório Obrigatório',
        message: 'Selecione primeiro a pasta de destino usando o botão "Selecionar Pasta...".',
        color: 'yellow',
        icon: <IconAlertTriangle size={16} />,
      })
      return
    }

    try {
      setExecutandoBackupAuto(true)
      const api = await getApi()
      // Garante que o backend salve as opções atuais antes da execução
      const payload: Record<string, any> = {
        ...form.values,
        backup_auto_ativo: form.values.backup_auto_ativo ? '1' : '0',
        backup_auto_intervalo_horas: String(form.values.backup_auto_intervalo_horas || '4'),
        backup_auto_max_arquivos: String(form.values.backup_auto_max_arquivos || 10),
      }
      await api.save_settings(payload)

      const res = await api.execute_auto_backup()
      if (res.sucesso) {
        const dataHora = (res as any).data_hora || new Date().toLocaleString('pt-BR')
        setUltimoBackupSucesso(dataHora)
        setUltimoBackupStatus('Sucesso')
        notifications.show({
          title: 'Backup Automático Concluído!',
          message: `Arquivo ${res.nome_arquivo} gravado com sucesso.`,
          color: 'teal',
          icon: <IconCheck size={16} />,
          autoClose: 5000,
        })
      }
    } catch (error: any) {
      setUltimoBackupStatus(`Falha: ${error?.message || 'Erro de gravação'}`)
      notifications.show({
        title: 'Falha no Backup Automático',
        message: error?.message || 'Não foi possível gravar o arquivo na pasta configurada.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setExecutandoBackupAuto(false)
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
        iconColor={themeColor}
        title="Configurações do Aplicativo"
        subtitle="Personalize densidade, tamanho de fonte, tema visual e gerencie o banco de dados SQLite local"
      />

      {/* SEÇÃO 1: Densidade da Interface & Tamanho do Texto (Acessibilidade & Compactação) */}
      <DensidadeSection
        form={form}
        computedColorScheme={computedColorScheme}
        handleMudarDensidade={handleMudarDensidade}
        handleMudarTamanhoFonte={handleMudarTamanhoFonte}
        handleMudarModoExecucao={handleMudarModoExecucao}
      />

      {/* SEÇÃO 2: Identidade Visual e Tema Claro/Escuro */}
      <IdentidadeVisualSection
        form={form}
        computedColorScheme={computedColorScheme}
        salvandoConfig={salvandoConfig}
        handleMudarTema={handleMudarTema}
        handleSubmitConfigs={handleSubmitConfigs}
      />

      {/* SEÇÃO 3: Gerenciamento Seguro do Banco de Dados SQLite */}
      <DatabaseSection
        form={form}
        themeColor={themeColor}
        selecionandoPasta={selecionandoPasta}
        ultimoBackupSucesso={ultimoBackupSucesso}
        ultimoBackupStatus={ultimoBackupStatus}
        executandoBackupAuto={executandoBackupAuto}
        salvandoConfig={salvandoConfig}
        handleSelecionarPastaBackup={handleSelecionarPastaBackup}
        handleOpenImportar={handleOpenImportar}
        handleTestarBackupAgora={handleTestarBackupAgora}
        handleSubmitConfigs={handleSubmitConfigs}
        handleOpenFormatar={handleOpenFormatar}
      />

      {/* MODAL 3: Importar Banco de Dados (Timer 5s) */}
      <Modal
        opened={modalImportarOpened}
        onClose={closeModalImportar}
        title={
          <Group gap="xs">
            <ThemeIcon color="teal" variant="light" size="md" radius="sm">
              <IconDatabaseImport size={18} />
            </ThemeIcon>
            <Text fw={700}>Importar Banco de Dados (.db)</Text>
          </Group>
        }
        radius="sm"
        centered
      >
        <Stack gap="sm">
          <Alert color="teal" variant="light">
            <Text size="xs">
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
            size="xs"
            required
          />

          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={closeModalImportar}>
              Cancelar
            </Button>
            <Button
              color="teal"
              size="xs"
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
