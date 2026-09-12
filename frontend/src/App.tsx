import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import {
  AppShell,
  Center,
  Container,
  Loader,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Notifications } from '@mantine/notifications'
import { BoasVindasView } from './components/BoasVindasView'
import {
  AppHeader,
  AppNavbar,
  HelpShortcutsModal,
  ShutdownModal,
  ShutdownCompleteScreen,
} from './components/layout'
import { useGlobalKeyboardShortcuts, type TabType, useDataCacheSubscription } from './hooks'
import { getApi } from './services/api'
import type { ConfiguracoesApp } from './types'

// Code-split cada tela: o bundle de uma view só é baixado/parseado na primeira vez
// que o usuário navega até ela, em vez de tudo de uma vez no carregamento inicial.
const ProdutosView = lazy(() => import('./components/ProdutosView'))
const FornecedoresView = lazy(() => import('./components/FornecedoresView'))
const RodadasView = lazy(() => import('./components/RodadasView'))
const NecessidadesView = lazy(() => import('./components/NecessidadesView'))
const CotacoesView = lazy(() => import('./components/CotacoesView'))
const ComparacaoView = lazy(() => import('./components/ComparacaoView'))
const AlocacaoView = lazy(() => import('./components/AlocacaoView'))
const ResumoView = lazy(() => import('./components/ResumoView'))
const PedidoView = lazy(() => import('./components/PedidoView'))
const EstatisticasView = lazy(() => import('./components/EstatisticasView'))
const ConfiguracoesView = lazy(() => import('./components/ConfiguracoesView'))

// Máximo de telas mantidas montadas (porém ocultas via `hidden`) além da ativa.
// Cobre o padrão de alternar entre 2-3 telas (ex: Comparação <-> Alocação) sem pagar
// o custo de desmontar/remontar tudo a cada troca, mas sem manter as 9 telas vivas
// ao mesmo tempo (o que voltaria a degradar a memória como antes da Fase 1).
const MAX_TELAS_MONTADAS = 3

function TabLoadingFallback() {
  return (
    <Center p="xl" style={{ height: '100%' }}>
      <Loader size="lg" />
    </Center>
  )
}

export default function App() {
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })

  const [activeTab, setActiveTab] = useState<TabType>('produtos')
  // LRU de telas mantidas montadas (a última é sempre a `activeTab` atual).
  // As demais ficam ocultas via `hidden` em vez de desmontadas, então voltar
  // para uma delas não paga o custo de remontar do zero.
  const [mountedTabs, setMountedTabs] = useState<TabType[]>(['produtos'])
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

  const configuracoesRef = useRef(configuracoes)
  configuracoesRef.current = configuracoes

  const [helpOpened, { open: openHelp, close: closeHelp }] = useDisclosure(false)
  const [modalEncerrarOpened, { open: openModalEncerrar, close: closeModalEncerrar }] = useDisclosure(false)
  const [sistemaEncerrado, setSistemaEncerrado] = useState(false)

  const isNavegador = typeof window !== 'undefined' && !window.pywebview?.api
  const themeColor = configuracoes.app_theme_color || 'blue'

  // Altera o tamanho da fonte via atalho (Ctrl+ / Ctrl-) com aplicação instantânea e persistência
  const handleAjustarTamanhoFonte = useCallback(
    async (delta: number) => {
      const currentConfigs = configuracoesRef.current
      const fontSize = currentConfigs.app_tamanho_fonte || '13.5'
      let current = parseFloat(fontSize)
      if (isNaN(current)) current = 13.5

      // Ajusta em passos de 0.5px respeitando os limites mínimo (10px) e máximo (20px) do slider
      const novo = Math.min(20, Math.max(10, Math.round((current + delta) * 2) / 2))
      if (novo === current) return

      const tamanhoStr = String(novo)
      const novasConfigs: ConfiguracoesApp = {
        ...currentConfigs,
        app_tamanho_fonte: tamanhoStr,
      }
      configuracoesRef.current = novasConfigs

      // Aplicação instantânea nas variáveis CSS do root (0ms)
      document.documentElement.style.setProperty('font-size', `${novo}px`)
      document.documentElement.style.setProperty('--app-font-base', `${novo}px`)
      document.documentElement.style.setProperty('--app-font-sm', `${Math.round(novo * 0.88)}px`)
      document.documentElement.style.setProperty('--app-font-xs', `${Math.round(novo * 0.81)}px`)
      document.documentElement.removeAttribute('data-font-size')

      setConfiguracoes(novasConfigs)

      try {
        const api = await getApi()
        await api.save_settings(novasConfigs)
      } catch (err) {
        console.error('Erro ao salvar tamanho da fonte via atalho:', err)
      }
    },
    [],
  )

  // Hook global de atalhos do teclado (Ctrl+1..0, F1, Ctrl+K, Ctrl+, Ctrl-)
  useGlobalKeyboardShortcuts({
    onSelectTab: setActiveTab,
    onOpenHelp: openHelp,
    onIncreaseFontSize: () => handleAjustarTamanhoFonte(0.5),
    onDecreaseFontSize: () => handleAjustarTamanhoFonte(-0.5),
  })

  // Atualiza o LRU de telas montadas sempre que a aba ativa mudar, não importa
  // a origem (atalho de teclado, clique na navbar ou navegação vinda de Rodadas).
  // Ajustado durante o render (em vez de um useEffect) seguindo o padrão do React
  // para "adjusting state when a prop changes": evita um re-render extra depois do
  // commit e o flash de um frame em que a nova aba ainda não estaria em mountedTabs.
  const ultimaAbaProcessadaRef = useRef(activeTab)
  if (ultimaAbaProcessadaRef.current !== activeTab) {
    ultimaAbaProcessadaRef.current = activeTab
    setMountedTabs((prev) => {
      const semAtual = prev.filter((t) => t !== activeTab)
      const proximo = [...semAtual, activeTab]
      if (proximo.length > MAX_TELAS_MONTADAS) {
        return proximo.slice(proximo.length - MAX_TELAS_MONTADAS)
      }
      return proximo
    })
  }

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

  // Sincroniza configurações e status do banco quando alterados por outro cliente
  useDataCacheSubscription(['settings', 'db_status'], () => {
    inicializarAplicativo()
  })

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

  const posicaoNotificacao = configuracoes.app_notificacao_posicao || 'bottom-right'

  // Se o banco ainda não foi inicializado, exibe a tela de Boas-Vindas
  if (!bancoInicializado) {
    return (
      <>
        <Notifications
          position={posicaoNotificacao as any}
          containerWidth={320}
          notificationMaxHeight={120}
          limit={3}
          autoClose={3000}
        />
        <BoasVindasView
          appNome={configuracoes.app_nome}
          appSubtitulo={configuracoes.app_subtitulo}
          themeColor={themeColor}
          onInicializado={async () => {
            setBancoInicializado(true)
            await inicializarAplicativo()
          }}
        />
      </>
    )
  }

  const isScrollableTab = activeTab === 'configuracoes' || activeTab === 'pedido'

  // Conteúdo de cada aba, isolado numa função para poder ser instanciado uma vez
  // por entrada do LRU (`mountedTabs`) em vez de só para a aba ativa.
  const renderTabContent = (tab: TabType) => {
    switch (tab) {
      case 'produtos':
        return <ProdutosView themeColor={themeColor} />
      case 'fornecedores':
        return <FornecedoresView themeColor={themeColor} />
      case 'rodadas':
        return (
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
        )
      case 'necessidades':
        return (
          <NecessidadesView
            rodadaAtivaId={rodadaAtivaId}
            themeColor={themeColor}
            onRodadaChange={setRodadaAtivaId}
          />
        )
      case 'cotacoes':
        return (
          <CotacoesView
            rodadaAtivaId={rodadaAtivaId}
            themeColor={themeColor}
            onRodadaChange={setRodadaAtivaId}
          />
        )
      case 'comparacao':
        return (
          <ComparacaoView
            rodadaAtivaId={rodadaAtivaId}
            themeColor={themeColor}
            onRodadaChange={setRodadaAtivaId}
          />
        )
      case 'alocacao':
        return (
          <AlocacaoView
            rodadaAtivaId={rodadaAtivaId}
            themeColor={themeColor}
            onRodadaChange={setRodadaAtivaId}
          />
        )
      case 'resumo':
        return (
          <ResumoView
            rodadaAtivaId={rodadaAtivaId}
            themeColor={themeColor}
            onRodadaChange={setRodadaAtivaId}
          />
        )
      case 'pedido':
        return (
          <PedidoView
            rodadaAtivaId={rodadaAtivaId}
            themeColor={themeColor}
            onRodadaChange={setRodadaAtivaId}
          />
        )
      case 'estatisticas':
        return <EstatisticasView themeColor={themeColor} />
      case 'configuracoes':
        return (
          <ConfiguracoesView
            configuracoes={configuracoes}
            themeColor={themeColor}
            onConfiguracoesAlteradas={(novas) => setConfiguracoes(novas)}
          />
        )
      default:
        return null
    }
  }

  return (
    <>
      <Notifications
        position={posicaoNotificacao as any}
        containerWidth={320}
        notificationMaxHeight={120}
        limit={3}
        autoClose={3000}
      />
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
          {mountedTabs.map((tab) => (
            <div
              key={tab}
              hidden={tab !== activeTab}
              style={{ height: '100%', minHeight: 0 }}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                {renderTabContent(tab)}
              </Suspense>
            </div>
          ))}
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
            await (api.shutdown_system || api.encerrar_sistema)?.()
          } catch {
            // Processo finalizado
          }
        }}
      />
    </AppShell>
  </>
)
}
