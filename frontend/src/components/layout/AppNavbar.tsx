import {
  ActionIcon,
  AppShell,
  Divider,
  Kbd,
  NavLink,
  Text,
  Tooltip,
} from '@mantine/core'
import {
  IconChartBar,
  IconChecklist,
  IconChevronsLeft,
  IconChevronsRight,
  IconFileText,
  IconHistory,
  IconListCheck,
  IconPackage,
  IconPower,
  IconReceipt,
  IconRotate,
  IconScale,
  IconSettings,
  IconTruck,
} from '@tabler/icons-react'
import type { TabType } from '../../hooks/useGlobalKeyboardShortcuts'

interface AppNavbarProps {
  activeTab: TabType
  onSelectTab: (tab: TabType) => void
  navbarCollapsed: boolean
  onToggleNavbar: () => void
  themeColor?: string
  isNavegador: boolean
  onOpenModalEncerrar: () => void
}

export function AppNavbar({
  activeTab,
  onSelectTab,
  navbarCollapsed,
  onToggleNavbar,
  themeColor = 'blue',
  isNavegador,
  onOpenModalEncerrar,
}: AppNavbarProps) {
  const renderNavItem = (
    tab: TabType,
    label: string,
    icon: React.ReactNode,
    shortcut?: string,
  ) => {
    const isActive = activeTab === tab
    const content = navbarCollapsed ? (
      <ActionIcon
        variant={isActive ? 'light' : 'subtle'}
        color={isActive ? themeColor : 'gray'}
        size={42}
        radius="md"
        onClick={() => onSelectTab(tab)}
        mb={2}
        style={{ width: '100%' }}
      >
        {icon}
      </ActionIcon>
    ) : (
      <NavLink
        label={label}
        leftSection={icon}
        rightSection={shortcut ? <Kbd size="xs">{shortcut}</Kbd> : undefined}
        active={isActive}
        onClick={() => onSelectTab(tab)}
        variant="light"
        style={{ borderRadius: 6 }}
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

  return (
    <AppShell.Navbar p={6} style={{ display: 'flex', flexDirection: 'column' }}>
      <AppShell.Section grow>
        {navbarCollapsed ? (
          <Divider my={4} />
        ) : (
          <Text size="10px" fw={700} c="dimmed" px={8} py={2} tt="uppercase">
            Cadastros
          </Text>
        )}
        {renderNavItem('produtos', 'Produtos', <IconPackage size="1.2rem" />, 'Ctrl+1')}
        {renderNavItem('fornecedores', 'Fornecedores', <IconTruck size="1.2rem" />, 'Ctrl+2')}

        {navbarCollapsed ? (
          <Divider my={4} />
        ) : (
          <Text size="10px" fw={700} c="dimmed" px={8} pt={8} pb={2} tt="uppercase">
            Rodada de Cotação
          </Text>
        )}
        {renderNavItem('rodadas', 'Rodadas', <IconRotate size="1.2rem" />)}
        {renderNavItem('necessidades', 'Necessidades', <IconChecklist size="1.2rem" />, 'Ctrl+3')}
        {renderNavItem('cotacoes', 'Cotações', <IconReceipt size="1.2rem" />, 'Ctrl+4')}
        {renderNavItem('comparacao', 'Comparação', <IconScale size="1.2rem" />, 'Ctrl+5')}
        {renderNavItem('alocacao', 'Alocação', <IconListCheck size="1.2rem" />, 'Ctrl+6')}
        {renderNavItem('resumo', 'Resumo por Fornecedor', <IconChartBar size="1.2rem" />, 'Ctrl+7')}
        {renderNavItem('pedido', 'Gerar Pedido', <IconFileText size="1.2rem" />, 'Ctrl+8')}

        {navbarCollapsed ? (
          <Divider my={4} />
        ) : (
          <Text size="10px" fw={700} c="dimmed" px={8} pt={8} pb={2} tt="uppercase">
            Inteligência & Sistema
          </Text>
        )}
        {renderNavItem('estatisticas', 'Estatísticas & Histórico', <IconHistory size="1.2rem" />, 'Ctrl+9')}
        {renderNavItem('configuracoes', 'Configurações', <IconSettings size="1.2rem" />, 'Ctrl+0')}
      </AppShell.Section>

      <AppShell.Section pt={4}>
        <Divider mb={4} />
        <Tooltip
          label={navbarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          position="right"
          withArrow
          disabled={!navbarCollapsed}
        >
          {navbarCollapsed ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              size={42}
              radius="md"
              onClick={onToggleNavbar}
              style={{ width: '100%' }}
            >
              <IconChevronsRight size="1.2rem" />
            </ActionIcon>
          ) : (
            <NavLink
              label="Recolher menu"
              leftSection={<IconChevronsLeft size="1.2rem" />}
              onClick={onToggleNavbar}
              variant="subtle"
              style={{ borderRadius: 4 }}
            />
          )}
        </Tooltip>

        {isNavegador && (
          <Tooltip
            label={navbarCollapsed ? 'Encerrar aplicativo' : undefined}
            position="right"
            withArrow
            disabled={!navbarCollapsed}
          >
            {navbarCollapsed ? (
              <ActionIcon
                variant="subtle"
                color="red"
                size={42}
                radius="md"
                onClick={onOpenModalEncerrar}
                style={{ width: '100%', marginTop: 2 }}
              >
                <IconPower size="1.2rem" />
              </ActionIcon>
            ) : (
              <NavLink
                label="Encerrar App"
                leftSection={<IconPower size="1.2rem" />}
                onClick={onOpenModalEncerrar}
                variant="subtle"
                c="red"
                style={{ borderRadius: 4, marginTop: 2 }}
              />
            )}
          </Tooltip>
        )}
      </AppShell.Section>
    </AppShell.Navbar>
  )
}

export default AppNavbar
