import { useState, useEffect, useMemo } from 'react'
import {
  ActionIcon,
  AppShell,
  Badge,
  Center,
  Container,
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
  IconCoins,
  IconFileText,
  IconHistory,
  IconKeyboard,
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
  const [bancoInicializado, setBancoInicializado] = useState<boolean | null>(null)
  const [rodadaAtivaId, setRodadaAtivaId] = useState<number | undefined>(undefined)
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesApp>({
    app_nome: 'Mapa de Cotações',
    app_subtitulo: 'Comparativo e Alocação Inteligente',
    app_icone: 'Scale',
    app_theme_color: 'blue',
    app_color_scheme: 'light',
  })
  const [helpOpened, { open: openHelp, close: closeHelp }] = useDisclosure(false)

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
        return <IconShoppingCart size={22} />
      case 'BuildingStore':
        return <IconBuildingStore size={22} />
      case 'Package':
        return <IconPackage size={22} />
      case 'TrendingUp':
        return <IconTrendingUp size={22} />
      case 'Coins':
        return <IconCoins size={22} />
      case 'Briefcase':
        return <IconBriefcase size={22} />
      case 'Receipt':
        return <IconReceipt size={22} />
      case 'Scale':
      default:
        return <IconScale size={22} />
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
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <ThemeIcon size="lg" radius="md" variant="filled" color={themeColor}>
              {iconeCabecalho}
            </ThemeIcon>
            <div>
              <Title order={3} style={{ lineHeight: 1.1 }}>
                {configuracoes.app_nome || 'Mapa de Cotações'}
              </Title>
              <Text size="xs" c="dimmed">
                {configuracoes.app_subtitulo || 'Comparativo e Alocação Inteligente'}
              </Text>
            </div>
          </Group>

          <Group gap="xs">
            <Tooltip
              label={`Alternar Modo Claro/Escuro (Ativo: ${
                computedColorScheme === 'dark' ? 'Escuro' : 'Claro'
              })`}
            >
              <ActionIcon
                variant="light"
                color={themeColor}
                size="lg"
                onClick={handleToggleTheme}
              >
                {computedColorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Guia de Atalhos do Teclado (F1 ou Ctrl+K)">
              <ActionIcon variant="light" color={themeColor} size="lg" onClick={openHelp}>
                <IconKeyboard size={20} />
              </ActionIcon>
            </Tooltip>

            <Badge variant="outline" color={themeColor}>
              Versão Desktop
            </Badge>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Text size="xs" fw={700} c="dimmed" px="xs" py={4} tt="uppercase">
          Cadastros
        </Text>
        <NavLink
          label="Produtos"
          leftSection={<IconPackage size={18} />}
          rightSection={<Kbd size="xs">Ctrl+1</Kbd>}
          active={activeTab === 'produtos'}
          onClick={() => setActiveTab('produtos')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
        <NavLink
          label="Fornecedores"
          leftSection={<IconTruck size={18} />}
          rightSection={<Kbd size="xs">Ctrl+2</Kbd>}
          active={activeTab === 'fornecedores'}
          onClick={() => setActiveTab('fornecedores')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />

        <Text size="xs" fw={700} c="dimmed" px="xs" pt="md" pb={4} tt="uppercase">
          Rodada de Cotação
        </Text>
        <NavLink
          label="Rodadas"
          leftSection={<IconRotate size={18} />}
          active={activeTab === 'rodadas'}
          onClick={() => setActiveTab('rodadas')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
        <NavLink
          label="Necessidades"
          leftSection={<IconChecklist size={18} />}
          rightSection={<Kbd size="xs">Ctrl+3</Kbd>}
          active={activeTab === 'necessidades'}
          onClick={() => setActiveTab('necessidades')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
        <NavLink
          label="Cotações"
          leftSection={<IconReceipt size={18} />}
          rightSection={<Kbd size="xs">Ctrl+4</Kbd>}
          active={activeTab === 'cotacoes'}
          onClick={() => setActiveTab('cotacoes')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
        <NavLink
          label="Comparação"
          leftSection={<IconScale size={18} />}
          rightSection={<Kbd size="xs">Ctrl+5</Kbd>}
          active={activeTab === 'comparacao'}
          onClick={() => setActiveTab('comparacao')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
        <NavLink
          label="Alocação"
          leftSection={<IconListCheck size={18} />}
          rightSection={<Kbd size="xs">Ctrl+6</Kbd>}
          active={activeTab === 'alocacao'}
          onClick={() => setActiveTab('alocacao')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
        <NavLink
          label="Resumo Fornecedor"
          leftSection={<IconChartBar size={18} />}
          rightSection={<Kbd size="xs">Ctrl+7</Kbd>}
          active={activeTab === 'resumo'}
          onClick={() => setActiveTab('resumo')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
        <NavLink
          label="Gerar Pedido"
          leftSection={<IconFileText size={18} />}
          rightSection={<Kbd size="xs">Ctrl+8</Kbd>}
          active={activeTab === 'pedido'}
          onClick={() => setActiveTab('pedido')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />

        <Text size="xs" fw={700} c="dimmed" px="xs" pt="md" pb={4} tt="uppercase">
          Inteligência & Sistema
        </Text>
        <NavLink
          label="Estatísticas & Histórico"
          leftSection={<IconHistory size={18} />}
          rightSection={<Kbd size="xs">Ctrl+9</Kbd>}
          active={activeTab === 'estatisticas'}
          onClick={() => setActiveTab('estatisticas')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
        <NavLink
          label="Configurações"
          leftSection={<IconSettings size={18} />}
          rightSection={<Kbd size="xs">Ctrl+0</Kbd>}
          active={activeTab === 'configuracoes'}
          onClick={() => setActiveTab('configuracoes')}
          variant="light"
          style={{ borderRadius: 6 }}
          mb={2}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Container fluid px="md" style={{ width: '100%', maxWidth: '100%' }}>
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
              <Table.Td>Ir para tela de <b>Resumo da Rodada</b></Table.Td>
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
