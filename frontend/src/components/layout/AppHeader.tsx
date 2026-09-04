import { useMemo } from 'react'
import {
  ActionIcon,
  Badge,
  Group,
  Text,
  Title,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconBriefcase,
  IconBrowser,
  IconBuildingStore,
  IconCoins,
  IconKeyboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMoon,
  IconPackage,
  IconReceipt,
  IconScale,
  IconShoppingCart,
  IconSun,
  IconTrendingUp,
} from '@tabler/icons-react'

interface AppHeaderProps {
  appNome?: string
  appSubtitulo?: string
  appIcone?: string
  themeColor?: string
  navbarCollapsed: boolean
  onToggleNavbar: () => void
  onToggleTheme: () => void
  onOpenHelp: () => void
  isNavegador: boolean
}

export function AppHeader({
  appNome = 'Mapa de Cotações',
  appSubtitulo = 'Comparativo e Alocação Inteligente',
  appIcone = 'Scale',
  themeColor = 'blue',
  navbarCollapsed,
  onToggleNavbar,
  onToggleTheme,
  onOpenHelp,
  isNavegador,
}: AppHeaderProps) {
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })

  const iconeCabecalho = useMemo(() => {
    switch (appIcone) {
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
  }, [appIcone])

  return (
    <Group h="100%" px="sm" justify="space-between">
      <Group gap="xs">
        <Tooltip label={navbarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            onClick={onToggleNavbar}
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
            {appNome}
          </Title>
          <Text size="11px" c="dimmed">
            {appSubtitulo}
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
            onClick={onToggleTheme}
          >
            {computedColorScheme === 'dark' ? <IconSun size="1.2rem" /> : <IconMoon size="1.2rem" />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Guia de Atalhos do Teclado (F1 ou Ctrl+K)">
          <ActionIcon variant="light" color={themeColor} size="md" onClick={onOpenHelp}>
            <IconKeyboard size="1.2rem" />
          </ActionIcon>
        </Tooltip>

        <Badge variant="outline" color={themeColor} size="xs" leftSection={isNavegador ? <IconBrowser size={12} /> : undefined}>
          {isNavegador ? 'Navegador' : 'Desktop'}
        </Badge>
      </Group>
    </Group>
  )
}

export default AppHeader
