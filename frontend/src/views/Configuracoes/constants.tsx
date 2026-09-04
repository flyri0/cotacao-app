
import {
  IconScale,
  IconShoppingCart,
  IconBuildingStore,
  IconPackage,
  IconTrendingUp,
  IconCoins,
  IconBriefcase,
  IconReceipt,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
} from '@tabler/icons-react'

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
