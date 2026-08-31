import { useState, useEffect, useMemo } from 'react'
import {
  ActionIcon,
  AppShell,
  Badge,
  Center,
  Container,
  Divider,
  Group,
  Kbd,
  Loader,
  Modal,
  NavLink,
  Table,
  Text,
  Title,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBriefcase,
  IconBuildingStore,
  IconChartBar,
  IconChecklist,
  IconChevronsLeft,
  IconChevronsRight,
  IconCoins,
  IconFileText,
  IconHistory,
  IconKeyboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconListCheck,
  IconMoon,
  IconPackage,
  IconReceipt,
  IconRotate,
  IconScale,
  IconSettings,
  IconShoppingCart,
  IconSun,
  IconTrendingUp,
  IconTruck,
} from '@tabler/icons-react'
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
import { getApi } from './services/api'
import type { ConfiguracoesApp } from './types'

type TabType =
  | 'produtos'
  | 'fornecedores'
  | 'rodadas'
  | 'necessidades'
  | 'cotacoes'
  | 'comparacao'
  | 'alocacao'
  | 'resumo'
  | 'pedido'
  | 'estatisticas'
  | 'configuracoes'

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
    app_color_scheme: 'light',
    app_densidade: 'compacto',
    app_tamanho_fonte: 'medio',
  })
  const [helpOpened, { open: openHelp, close: closeHelp }] = useDisclosure(false)

  // Sincroniza densidade e tamanho de fonte com o documento HTML
  useEffect(() => {
    const density = configuracoes.app_densidade || 'compacto'
    const fontSize = configuracoes.app_tamanho_fonte || 'medio'
    document.documentElement.setAttribute('data-density', density)
    document.documentElement.setAttribute('data-font-size', fontSize)
  }, [configuracoes.app_densidade, configuracoes.app_tamanho_fonte])

  // Verifica se o banco já passou pelo setup inicial e carrega preferências
  const inicializarAplicativo = async () => {
    try {
      const api = await getApi()
      const [status, dados] = await Promise.all([
        api.verificar_status_banco(),
        api.obter_configuracoes(),
      ])

      setBancoInicializado(status.inicializado)

      if (dados && Object.keys(dados).length > 0) {
        setConfiguracoes(dados)
        if (dados.app_color_scheme) {
          setColorScheme(dados.app_color_scheme as 'light' | 'dark' | 'auto')
        }
        const density = dados.app_densidade || 'compacto'
        const fontSize = dados.app_tamanho_fonte || 'medio'
        document.documentElement.setAttribute('data-density', density)
        document.documentElement.setAttribute('data-font-size', fontSize)
      }
    } catch (error) {
      console.error('Erro ao inicializar aplicativo:', error)
      setBancoInicializado(false)
    }
  }

  useEffect(() => {
    inicializarAplicativo()
  }, [])

  // Alternar rapidamente entre tema Claro e Escuro com aplicação instantânea
  const handleToggleTheme = async () => {
    const next: 'light' | 'dark' = computedColorScheme === 'dark' ? 'light' : 'dark'
    setColorScheme(next)
    const novasConfigs: ConfiguracoesApp = { ...configuracoes, app_color_scheme: next }
    setConfiguracoes(novasConfigs)
    try {
      const api = await getApi()
      await api.salvar_configuracoes(novasConfigs)
    } catch (err) {
      console.error('Erro ao salvar preferência de tema:', err)
    }
  }

  // Ícone dinâmico do cabeçalho
  const iconeCabecalho = useMemo(() => {
    const iconName = configuracoes.app_icone || 'Scale'
    switch (iconName) {
      case 'ShoppingCart':
        return <IconShoppingCart size={18} />
      case 'BuildingStore':
        return <IconBuildingStore size={18} />
      case 'Package':
        return <IconPackage size={18} />
      case 'TrendingUp':
        return <IconTrendingUp size={18} />
      case 'Coins':
        return <IconCoins size={18} />
      case 'Briefcase':
        return <IconBriefcase size={18} />
      case 'Receipt':
        return <IconReceipt size={18} />
      case 'Scale':
      default:
        return <IconScale size={18} />
    }
  }, [configuracoes.app_icone])

  const themeColor = configuracoes.app_theme_color || 'blue'

  // Listener nativo global de alta prioridade (captura mesmo dentro de inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Atalhos com Ctrl ou Alt (Ctrl+1 .. Ctrl+0)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const key = e.key
        const code = e.code

        if (key === '1' || code === 'Digit1' || code === 'Numpad1') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('produtos')
          return
        }
        if (key === '2' || code === 'Digit2' || code === 'Numpad2') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('fornecedores')
          return
        }
        if (key === '3' || code === 'Digit3' || code === 'Numpad3') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('necessidades')
          return
        }
        if (key === '4' || code === 'Digit4' || code === 'Numpad4') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('cotacoes')
          return
        }
        if (key === '5' || code === 'Digit5' || code === 'Numpad5') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('comparacao')
          return
        }
        if (key === '6' || code === 'Digit6' || code === 'Numpad6') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('alocacao')
          return
        }
        if (key === '7' || code === 'Digit7' || code === 'Numpad7') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('resumo')
          return
        }
        if (key === '8' || code === 'Digit8' || code === 'Numpad8') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('pedido')
          return
        }
        if (key === '9' || code === 'Digit9' || code === 'Numpad9') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('estatisticas')
          return
        }
        if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
          e.preventDefault()
          e.stopPropagation()
          setActiveTab('configuracoes')
          return
        }
        if ((e.ctrlKey || e.metaKey) && (key === 'k' || key === 'K')) {
          e.preventDefault()
          e.stopPropagation()
          openHelp()
          return
        }
      }

      if (e.key === 'F1') {
        e.preventDefault()
        e.stopPropagation()
        openHelp()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [openHelp])

  // Helper para renderizar itens de navegação com suporte a modo colapsado
  const renderNavItem = (
    tab: TabType,
    label: string,
    icon: React.ReactNode,
    shortcut?: string,
  ) => {
    const isActive = activeTab === tab
    const content = (
      <NavLink
        label={navbarCollapsed ? undefined : label}
        leftSection={icon}
        rightSection={!navbarCollapsed && shortcut ? <Kbd size="xs">{shortcut}</Kbd> : undefined}
        active={isActive}
        onClick={() => setActiveTab(tab)}
        variant="light"
        style={{
          borderRadius: 6,
          justifyContent: navbarCollapsed ? 'center' : 'flex-start',
          paddingLeft: navbarCollapsed ? 12 : undefined,
          paddingRight: navbarCollapsed ? 12 : undefined,
        }}
        mb={2}
      />
    )

    if (navbarCollapsed) {
      return (
        <Tooltip
          key={tab}
          label={`${label}${shortcut ? ` (${shortcut})` : ''}`}
          position="right"
          withArrow
          offset={12}
        >
          <div>{content}</div>
        </Tooltip>
      )
    }

    return <div key={tab}>{content}</div>
  }

  // Estado de carregamento inicial
  if (bancoInicializado === null) {
    return (
      <Center style={{ minHeight: '100vh' }}>
        <Loader size="xl" />
      </Center>
    )
  }

  // Se o banco ainda não foi inicializado, exibe a tela de Boas-Vindas / Onboarding
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
        <Group h="100%" px="sm" justify="space-between">
          <Group gap="xs">
            <Tooltip
              label={navbarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                onClick={() => setNavbarCollapsed(!navbarCollapsed)}
              >
                {navbarCollapsed ? (
                  <IconLayoutSidebarLeftExpand size={18} />
                ) : (
                  <IconLayoutSidebarLeftCollapse size={18} />
                )}
              </ActionIcon>
            </Tooltip>

            <ThemeIcon size={28} radius="sm" variant="filled" color={themeColor}>
              {iconeCabecalho}
            </ThemeIcon>

            <div>
              <Title order={4} style={{ lineHeight: 1.1, fontSize: '0.95rem' }}>
                {configuracoes.app_nome || 'Mapa de Cotações'}
              </Title>
              <Text size="11px" c="dimmed">
                {configuracoes.app_subtitulo || 'Comparativo e Alocação Inteligente'}
              </Text>
            </div>
          </Group>

          <Group gap={6}>
            <Tooltip
              label={`Alternar Modo Claro/Escuro (Ativo: ${
                computedColorScheme === 'dark' ? 'Escuro' : 'Claro'
              })`}
            >
              <ActionIcon
                variant="light"
                color={themeColor}
                size="md"
                onClick={handleToggleTheme}
              >
                {computedColorScheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Guia de Atalhos do Teclado (F1 ou Ctrl+K)">
              <ActionIcon variant="light" color={themeColor} size="md" onClick={openHelp}>
                <IconKeyboard size={16} />
              </ActionIcon>
            </Tooltip>

            <Badge variant="outline" color={themeColor} size="xs">
              Desktop
            </Badge>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={6} style={{ display: 'flex', flexDirection: 'column' }}>
        <AppShell.Section grow>
          {navbarCollapsed ? (
            <Divider my={4} />
          ) : (
            <Text size="10px" fw={700} c="dimmed" px={8} py={2} tt="uppercase">
              Cadastros
            </Text>
          )}
          {renderNavItem('produtos', 'Produtos', <IconPackage size={16} />, 'Ctrl+1')}
          {renderNavItem('fornecedores', 'Fornecedores', <IconTruck size={16} />, 'Ctrl+2')}

          {navbarCollapsed ? (
            <Divider my={4} />
          ) : (
            <Text size="10px" fw={700} c="dimmed" px={8} pt={8} pb={2} tt="uppercase">
              Rodada de Cotação
            </Text>
          )}
          {renderNavItem('rodadas', 'Rodadas', <IconRotate size={16} />)}
          {renderNavItem('necessidades', 'Necessidades', <IconChecklist size={16} />, 'Ctrl+3')}
          {renderNavItem('cotacoes', 'Cotações', <IconReceipt size={16} />, 'Ctrl+4')}
          {renderNavItem('comparacao', 'Comparação', <IconScale size={16} />, 'Ctrl+5')}
          {renderNavItem('alocacao', 'Alocação', <IconListCheck size={16} />, 'Ctrl+6')}
          {renderNavItem('resumo', 'Resumo por Fornecedor', <IconChartBar size={16} />, 'Ctrl+7')}
          {renderNavItem('pedido', 'Gerar Pedido', <IconFileText size={16} />, 'Ctrl+8')}

          {navbarCollapsed ? (
            <Divider my={4} />
          ) : (
            <Text size="10px" fw={700} c="dimmed" px={8} pt={8} pb={2} tt="uppercase">
              Inteligência & Sistema
            </Text>
          )}
          {renderNavItem('estatisticas', 'Estatísticas & Histórico', <IconHistory size={16} />, 'Ctrl+9')}
          {renderNavItem('configuracoes', 'Configurações', <IconSettings size={16} />, 'Ctrl+0')}
        </AppShell.Section>

        <AppShell.Section pt={4}>
          <Divider mb={4} />
          <Tooltip
            label={navbarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            position="right"
            withArrow
            disabled={!navbarCollapsed}
          >
            <NavLink
              label={navbarCollapsed ? undefined : 'Recolher menu'}
              leftSection={
                navbarCollapsed ? (
                  <IconChevronsRight size={16} />
                ) : (
                  <IconChevronsLeft size={16} />
                )
              }
              onClick={() => setNavbarCollapsed(!navbarCollapsed)}
              variant="subtle"
              style={{
                borderRadius: 4,
                justifyContent: navbarCollapsed ? 'center' : 'flex-start',
                paddingLeft: navbarCollapsed ? 8 : undefined,
                paddingRight: navbarCollapsed ? 8 : undefined,
              }}
            />
          </Tooltip>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container fluid px={4} style={{ width: '100%', maxWidth: '100%' }}>
          {activeTab === 'produtos' && <ProdutosView />}
          {activeTab === 'fornecedores' && <FornecedoresView />}
          {activeTab === 'rodadas' && (
            <RodadasView
              rodadaAtivaId={rodadaAtivaId}
              onSelecionarRodada={(id, aba) => {
                setRodadaAtivaId(id)
                if (aba === 'necessidades' || aba === 'cotacoes' || aba === 'comparacao' || aba === 'alocacao' || aba === 'resumo' || aba === 'pedido') {
                  setActiveTab(aba)
                }
              }}
            />
          )}
          {activeTab === 'necessidades' && (
            <NecessidadesView
              rodadaAtivaId={rodadaAtivaId}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'cotacoes' && (
            <CotacoesView
              rodadaAtivaId={rodadaAtivaId}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'comparacao' && (
            <ComparacaoView
              rodadaAtivaId={rodadaAtivaId}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'alocacao' && (
            <AlocacaoView
              rodadaAtivaId={rodadaAtivaId}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'resumo' && (
            <ResumoView
              rodadaAtivaId={rodadaAtivaId}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'pedido' && (
            <PedidoView
              rodadaAtivaId={rodadaAtivaId}
              onRodadaChange={setRodadaAtivaId}
            />
          )}
          {activeTab === 'estatisticas' && <EstatisticasView />}
          {activeTab === 'configuracoes' && (
            <ConfiguracoesView
              configuracoes={configuracoes}
              onConfiguracoesAlteradas={(novas) => setConfiguracoes(novas)}
            />
          )}
        </Container>
      </AppShell.Main>

      {/* Modal de Atalhos de Teclado */}
      <Modal
        opened={helpOpened}
        onClose={closeHelp}
        title={
          <Group gap="xs">
            <IconKeyboard size={20} />
            <Text fw={700}>Atalhos de Teclado do Sistema</Text>
          </Group>
        }
        size="md"
        centered
      >
        <Table withTableBorder striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Atalho</Table.Th>
              <Table.Th>Ação</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>1</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Produtos</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>2</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Fornecedores</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>3</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Necessidades</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>4</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Cotações</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>5</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Comparação (Matriz Excel)</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>6</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Alocação</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>7</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Resumo por Fornecedor</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>8</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Gerar Pedido</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>9</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Estatísticas & Histórico</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>0</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Ir para tela de <b>Configurações & Banco</b></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Salvar alocações de compras no banco</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap={4}>
                  <Kbd>F1</Kbd> ou <Kbd>Ctrl+K</Kbd>
                </Group>
              </Table.Td>
              <Table.Td>Abrir este guia de atalhos rápidos</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Kbd>Esc</Kbd>
              </Table.Td>
              <Table.Td>Fechar modal ou limpar seleção</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Modal>
    </AppShell>
  )
}
