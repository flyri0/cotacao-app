import { useEffect, useState } from 'react'
import { Stack, Tabs } from '@mantine/core'
import { IconHistory, IconPackage, IconTrendingUp, IconTruck } from '@tabler/icons-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { getApi } from '../../services/api'
import type { Produto, Fornecedor, Rodada } from '../../types'
import { EstatisticasProdutoAba } from './EstatisticasProdutoAba'
import { EstatisticasFornecedorAba } from './EstatisticasFornecedorAba'
import { EstatisticasGlobalAba } from './EstatisticasGlobalAba'

export function EstatisticasView({ themeColor = 'blue' }: { themeColor?: string }) {
  const [activeTab, setActiveTab] = useState<string | null>('produto')

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [rodadas, setRodadas] = useState<Rodada[]>([])

  const carregarDadosIniciais = async () => {
    try {
      const api = await getApi()
      const [prods, forns, rods] = await Promise.all([
        api.list_products(),
        api.list_suppliers(),
        api.list_rounds(),
      ])
      setProdutos(prods)
      setFornecedores(forns)
      setRodadas(rods)
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error)
    }
  }

  useEffect(() => {
    carregarDadosIniciais()
  }, [])

  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      <PageHeader
        icon={IconHistory}
        iconColor={themeColor}
        title="Estatísticas & Histórico Comercial"
        subtitle="Inteligência de compras, evolução temporal e comparativos"
      />

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="sm">
        <Tabs.List>
          <Tabs.Tab value="produto" leftSection={<IconPackage size={15} />}>
            Por Produto
          </Tabs.Tab>
          <Tabs.Tab value="fornecedor" leftSection={<IconTruck size={15} />}>
            Por Fornecedor
          </Tabs.Tab>
          <Tabs.Tab value="global" leftSection={<IconTrendingUp size={15} />}>
            Visão Geral
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="produto" pt="xs">
          <EstatisticasProdutoAba produtos={produtos} themeColor={themeColor} />
        </Tabs.Panel>

        <Tabs.Panel value="fornecedor" pt="xs">
          <EstatisticasFornecedorAba fornecedores={fornecedores} rodadas={rodadas} />
        </Tabs.Panel>

        <Tabs.Panel value="global" pt="lg">
          <EstatisticasGlobalAba
            fornecedores={fornecedores}
            produtos={produtos}
            rodadas={rodadas}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

export default EstatisticasView
