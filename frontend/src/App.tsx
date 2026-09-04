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
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => new Set<TabType>(['produtos']))

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])
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

      <AppShell.Main>
        <Container fluid px={4} style={{ width: '100%', maxWidth: '100%' }}>
          <div style={{ display: activeTab === 'produtos' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('produtos') && <ProdutosView themeColor={themeColor} />}
          </div>
          <div style={{ display: activeTab === 'fornecedores' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('fornecedores') && <FornecedoresView themeColor={themeColor} />}
          </div>
          <div style={{ display: activeTab === 'rodadas' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('rodadas') && (
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
          </div>
          <div style={{ display: activeTab === 'necessidades' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('necessidades') && (
              <NecessidadesView
                rodadaAtivaId={rodadaAtivaId}
                themeColor={themeColor}
                onRodadaChange={setRodadaAtivaId}
              />
            )}
          </div>
          <div style={{ display: activeTab === 'cotacoes' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('cotacoes') && (
              <CotacoesView
                rodadaAtivaId={rodadaAtivaId}
                themeColor={themeColor}
                onRodadaChange={setRodadaAtivaId}
              />
            )}
          </div>
          <div style={{ display: activeTab === 'comparacao' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('comparacao') && (
              <ComparacaoView
                rodadaAtivaId={rodadaAtivaId}
                themeColor={themeColor}
                onRodadaChange={setRodadaAtivaId}
              />
            )}
          </div>
          <div style={{ display: activeTab === 'alocacao' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('alocacao') && (
              <AlocacaoView
                rodadaAtivaId={rodadaAtivaId}
                themeColor={themeColor}
                onRodadaChange={setRodadaAtivaId}
              />
            )}
          </div>
          <div style={{ display: activeTab === 'resumo' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('resumo') && (
              <ResumoView
                rodadaAtivaId={rodadaAtivaId}
                themeColor={themeColor}
                onRodadaChange={setRodadaAtivaId}
              />
            )}
          </div>
          <div style={{ display: activeTab === 'pedido' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('pedido') && (
              <PedidoView
                rodadaAtivaId={rodadaAtivaId}
                themeColor={themeColor}
                onRodadaChange={setRodadaAtivaId}
              />
            )}
          </div>
          <div style={{ display: activeTab === 'estatisticas' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('estatisticas') && <EstatisticasView themeColor={themeColor} />}
          </div>
          <div style={{ display: activeTab === 'configuracoes' ? 'block' : 'none', height: '100%', width: '100%' }}>
            {visitedTabs.has('configuracoes') && (
              <ConfiguracoesView
                configuracoes={configuracoes}
                themeColor={themeColor}
                onConfiguracoesAlteradas={(novas) => setConfiguracoes(novas)}
              />
            )}
          </div>
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
