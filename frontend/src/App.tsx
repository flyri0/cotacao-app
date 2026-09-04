import { useState, useEffect } from 'react'
import {
  AppShell,
  Center,
  Container,
  Loader,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { BoasVindasView } from './components/BoasVindasView'
import { ProdutosView } from './components/ProdutosView'
import { FornecedoresView } from './components/FornecedoresView'
import { RodadasView } from './components/RodadasView'
import { NecessidadesView } from './components/NecessidadesView'
import { CotacoesView } from './components/CotacoesView'
import { ComparacaoView } from './components/ComparacaoView'
import { AlocacaoView } from './components/AlocacaoView'
import { ResumoView } from './components/ResumoView'
import { PedidoView } from './components/PedidoView'
import { EstatisticasView } from './components/EstatisticasView'
import { ConfiguracoesView } from './components/ConfiguracoesView'
import {
  AppHeader,
  AppNavbar,
  HelpShortcutsModal,
  ShutdownModal,
  ShutdownCompleteScreen,
} from './components/layout'
import { useGlobalKeyboardShortcuts, type TabType } from './hooks/useGlobalKeyboardShortcuts'
import { getApi } from './services/api'
import type { ConfiguracoesApp } from './types'

export default function App() {
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })

  const [activeTab, setActiveTab] = useState<TabType>('produtos')
  const [navbarCollapsed, setNavbarCollapsed] = useState<boolean>(false)
  const [bancoInicializado, setBancoInicializado] = useState<boolean | null>(null)
  const [rodadaAtivaId, setRodadaAtivaId] = useState<number | undefined>(undefined)
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesApp>({
    app_nome: 'Mapa de Cotações',
    app_subtitulo: 'Comparativo e Alocação Inteligente',
    app_icone: 'Scale',
    app_theme_color: 'blue',
    app_color_scheme: 'auto',
    app_densidade: 'compacto',
    app_tamanho_fonte: '13.5',
  })

  const [helpOpened, { open: openHelp, close: closeHelp }] = useDisclosure(false)
  const [modalEncerrarOpened, { open: openModalEncerrar, close: closeModalEncerrar }] = useDisclosure(false)
  const [sistemaEncerrado, setSistemaEncerrado] = useState(false)

  const isNavegador = typeof window !== 'undefined' && !window.pywebview?.api
  const themeColor = configuracoes.app_theme_color || 'blue'

  // Hook global de atalhos do teclado (Ctrl+1..0, F1, Ctrl+K)
  useGlobalKeyboardShortcuts({
    onSelectTab: setActiveTab,
    onOpenHelp: openHelp,
  })

  // Sincroniza densidade e escala tipográfica dinâmica com o documento raiz
  useEffect(() => {
    const density = configuracoes.app_densidade || 'compacto'
    document.documentElement.setAttribute('data-density', density)

    const fontSize = configuracoes.app_tamanho_fonte || '13.5'
    let fontSizeNum = parseFloat(fontSize)
    if (isNaN(fontSizeNum)) fontSizeNum = 13.5

    document.documentElement.style.setProperty('font-size', `${fontSizeNum}px`)
    document.documentElement.style.setProperty('--app-font-base', `${fontSizeNum}px`)
    document.documentElement.style.setProperty('--app-font-sm', `${Math.round(fontSizeNum * 0.88)}px`)
    document.documentElement.style.setProperty('--app-font-xs', `${Math.round(fontSizeNum * 0.81)}px`)
    document.documentElement.removeAttribute('data-font-size')
  }, [configuracoes.app_densidade, configuracoes.app_tamanho_fonte])

  // Inicializa o aplicativo e carrega status do banco e preferências visuais
  const inicializarAplicativo = async () => {
    try {
      const api = await getApi()
      const [status, dados] = await Promise.all([
        api.check_db_status(),
        api.get_settings(),
      ])

      setBancoInicializado(status.inicializado)

      if (dados && Object.keys(dados).length > 0) {
        setConfiguracoes(dados)
        if (dados.app_color_scheme) {
          setColorScheme(dados.app_color_scheme as 'light' | 'dark' | 'auto')
        }
      }
    } catch (error) {
      console.error('Erro ao inicializar aplicativo:', error)
      setBancoInicializado(false)
    }
  }

  useEffect(() => {
    inicializarAplicativo()
  }, [])

  // Alternar rapidamente entre tema Claro e Escuro com persistência
  const handleToggleTheme = async () => {
    const next: 'light' | 'dark' = computedColorScheme === 'dark' ? 'light' : 'dark'
    setColorScheme(next)
    const novasConfigs: ConfiguracoesApp = { ...configuracoes, app_color_scheme: next }
    setConfiguracoes(novasConfigs)
    try {
      const api = await getApi()
      await api.save_settings(novasConfigs)
    } catch (err) {
      console.error('Erro ao salvar preferência de tema:', err)
    }
  }

  // Estado de carregamento inicial
  if (bancoInicializado === null) {
    return (
      <Center style={{ minHeight: '100vh' }}>
        <Loader size="xl" />
      </Center>
    )
  }

  // Se o usuário encerrou o aplicativo no modo navegador
  if (sistemaEncerrado) {
    return <ShutdownCompleteScreen />
  }

  // Se o banco ainda não foi inicializado, exibe a tela de Boas-Vindas
  if (!bancoInicializado) {
    return (
      <BoasVindasView
        appNome={configuracoes.app_nome}
        appSubtitulo={configuracoes.app_subtitulo}
        themeColor={themeColor}
        onInicializado={async () => {
          setBancoInicializado(true)
          await inicializarAplicativo()
        }}
      />
    )
  }

  const isScrollableTab = activeTab === 'configuracoes' || activeTab === 'pedido'

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{ width: navbarCollapsed ? 54 : 215, breakpoint: 'sm' }}
      padding="xs"
    >
      <AppShell.Header>
        <AppHeader
          appNome={configuracoes.app_nome}
          appSubtitulo={configuracoes.app_subtitulo}
          appIcone={configuracoes.app_icone}
          themeColor={themeColor}
          navbarCollapsed={navbarCollapsed}
          onToggleNavbar={() => setNavbarCollapsed(!navbarCollapsed)}
          onToggleTheme={handleToggleTheme}
          onOpenHelp={openHelp}
          isNavegador={isNavegador}
        />
      </AppShell.Header>

      <AppNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        navbarCollapsed={navbarCollapsed}
        onToggleNavbar={() => setNavbarCollapsed(!navbarCollapsed)}
        themeColor={themeColor}
        isNavegador={isNavegador}
        onOpenModalEncerrar={openModalEncerrar}
      />

      <AppShell.Main
        style={{
          height: '100vh',
          maxHeight: '100vh',
          overflowY: isScrollableTab ? 'auto' : 'hidden',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <Container
          fluid
          px={4}
          style={{
            width: '100%',
            maxWidth: '100%',
            flex: isScrollableTab ? 'initial' : 1,
            minHeight: 0,
          }}
        >
          {activeTab === 'produtos' && <ProdutosView themeColor={themeColor} />}
          {activeTab === 'fornecedores' && <FornecedoresView themeColor={themeColor} />}
          {activeTab === 'rodadas' && (
            <RodadasView
              rodadaAtivaId={rodadaAtivaId}
              themeColor={themeColor}
              onSelecionarRodada={(id, aba) => {
                setRodadaAtivaId(id)
                if (
                  aba === 'necessidades' ||
                  aba === 'cotacoes' ||
                  aba === 'comparacao' ||
                  aba === 'alocacao' ||
                  aba === 'resumo' ||
                  aba === 'pedido'
                ) {
                  setActiveTab(aba)
                }
              }}
            />
          )}
          {activeTab === 'necessidades' && (
            <NecessidadesView
              rodadaAtivaId={rodadaAtivaId}
              themeColor={themeColor}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'cotacoes' && (
            <CotacoesView
              rodadaAtivaId={rodadaAtivaId}
              themeColor={themeColor}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'comparacao' && (
            <ComparacaoView
              rodadaAtivaId={rodadaAtivaId}
              themeColor={themeColor}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'alocacao' && (
            <AlocacaoView
              rodadaAtivaId={rodadaAtivaId}
              themeColor={themeColor}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'resumo' && (
            <ResumoView
              rodadaAtivaId={rodadaAtivaId}
              themeColor={themeColor}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'pedido' && (
            <PedidoView
              rodadaAtivaId={rodadaAtivaId}
              themeColor={themeColor}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'estatisticas' && <EstatisticasView themeColor={themeColor} />}
          {activeTab === 'configuracoes' && (
            <ConfiguracoesView
              configuracoes={configuracoes}
              themeColor={themeColor}
              onConfiguracoesAlteradas={(novas) => setConfiguracoes(novas)}
            />
          )}
        </Container>
      </AppShell.Main>

      <HelpShortcutsModal opened={helpOpened} onClose={closeHelp} />

      <ShutdownModal
        opened={modalEncerrarOpened}
        onClose={closeModalEncerrar}
        onConfirmShutdown={async () => {
          closeModalEncerrar()
          setSistemaEncerrado(true)
          try {
            const api = await getApi()
            await api.encerrar_sistema?.()
          } catch {
            // Processo finalizado
          }
        }}
      />
    </AppShell>
  )
}
