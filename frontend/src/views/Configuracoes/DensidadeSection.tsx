
import {
  Card,
  Title,
  Text,
  SimpleGrid,
  Paper,
  Group,
  ThemeIcon,
  SegmentedControl,
  Slider,
  Table,
  Badge,
} from '@mantine/core'
import { IconDimensions, IconTypography, IconBrowser } from '@tabler/icons-react'

interface DensidadeSectionProps {
  form: any
  computedColorScheme: string
  handleMudarDensidade: (val: string) => void
  handleMudarTamanhoFonte: (val: number) => void
  handleMudarModoExecucao: (val: string) => void
}

export function DensidadeSection({
  form,
  computedColorScheme,
  handleMudarDensidade,
  handleMudarTamanhoFonte,
  handleMudarModoExecucao,
}: DensidadeSectionProps) {
  return (
    <Card withBorder radius="sm" p="sm">
      <Title order={4} mb={2} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconDimensions size={18} />
        Densidade & Acessibilidade Tipográfica
      </Title>
      <Text size="xs" c="dimmed" mb="sm">
        Ajuste a densidade de linhas e o tamanho da fonte para o seu estilo de uso. A aplicação atualiza instantaneamente.
      </Text>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
        {/* Opção 1: Densidade */}
        <Paper withBorder p="xs" radius="sm">
          <Group gap={6} mb={4} align="center">
            <ThemeIcon size={22} radius="xs" variant="light" color="blue">
              <IconDimensions size={14} />
            </ThemeIcon>
            <Text fw={700} size="xs">
              Densidade da Interface
            </Text>
          </Group>
          <Text size="11px" c="dimmed" mb="xs">
            Reduz paddings de tabelas, cards e cabeçalhos para exibir mais dados na tela.
          </Text>
          <SegmentedControl
            fullWidth
            size="xs"
            value={form.values.app_densidade}
            onChange={handleMudarDensidade}
            data={[
              { label: 'Compacto (Padrão)', value: 'compacto' },
              { label: 'Confortável', value: 'confortavel' },
            ]}
          />
        </Paper>

        {/* Opção 2: Tamanho da Fonte */}
        <Paper withBorder p="xs" radius="sm">
          <Group gap={6} mb={4} align="center">
            <ThemeIcon size={22} radius="xs" variant="light" color="indigo">
              <IconTypography size={14} />
            </ThemeIcon>
            <Text fw={700} size="xs">
              Tamanho da Fonte
            </Text>
          </Group>
          <Text size="11px" c="dimmed" mb="xs">
            Altere o tamanho geral das fontes para facilitar a leitura sem distorcer o layout.
          </Text>
          <Slider
            mt="md"
            mb="xl"
            min={10}
            max={20}
            step={0.5}
            marks={[
              { value: 10, label: '10px' },
              { value: 13.5, label: '13.5px' },
              { value: 16, label: '16px' },
              { value: 20, label: '20px' },
            ]}
            value={parseFloat(form.values.app_tamanho_fonte) || 13.5}
            onChange={handleMudarTamanhoFonte}
          />
        </Paper>

        {/* Opção 3: Modo de Inicialização */}
        <Paper withBorder p="xs" radius="sm">
          <Group gap={6} mb={4} align="center">
            <ThemeIcon size={22} radius="xs" variant="light" color="teal">
              <IconBrowser size={14} />
            </ThemeIcon>
            <Text fw={700} size="xs">
              Modo de Inicialização
            </Text>
          </Group>
          <Text size="11px" c="dimmed" mb="xs">
            Janela própria ou Navegador padrão (recomendado p/ Windows 7 32-bit ou PCs leves).
          </Text>
          <SegmentedControl
            fullWidth
            size="xs"
            value={form.values.app_modo_execucao}
            onChange={handleMudarModoExecucao}
            data={[
              { label: 'Janela Nativa', value: 'janela' },
              { label: 'Navegador Padrão', value: 'navegador' },
            ]}
          />
        </Paper>
      </SimpleGrid>

      {/* Demonstração / Preview em Tempo Real */}
      <Paper withBorder p={8} radius="xs" mt="xs" bg={computedColorScheme === 'dark' ? 'dark.7' : 'gray.0'}>
        <Text size="10px" fw={700} c="dimmed" tt="uppercase" mb={4}>
          Demonstração ao Vivo da Densidade e Fonte:
        </Text>
        <Table withTableBorder withColumnBorders striped style={{ backgroundColor: computedColorScheme === 'dark' ? '#1a1b1e' : '#ffffff' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '40%' }}>Produto Demonstrativo</Table.Th>
              <Table.Th style={{ width: '30%' }}>Fornecedor</Table.Th>
              <Table.Th style={{ width: '18%', textAlign: 'right' }}>Preço Unitário</Table.Th>
              <Table.Th style={{ width: '12%', textAlign: 'center' }}>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td fw={600}>Café Torrado Superior 500g</Table.Td>
              <Table.Td>Distribuidora Aliança</Table.Td>
              <Table.Td style={{ textAlign: 'right' }} c="teal.7" fw={700}>R$ 18,90 / UN</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}><Badge size="xs" color="teal" variant="light">Menor Preço</Badge></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600}>Detergente Neutro 5L</Table.Td>
              <Table.Td>Comercial Limpeza Total</Table.Td>
              <Table.Td style={{ textAlign: 'right' }} fw={700}>R$ 4,50 / L</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}><Badge size="xs" color="blue" variant="light">Alocado</Badge></Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>
    </Card>
  )
}
