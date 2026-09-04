
import {
  Card,
  Title,
  Text,
  Stack,
  SimpleGrid,
  TextInput,
  Paper,
  Group,
  ThemeIcon,
  Badge,
  Button,
} from '@mantine/core'
import { IconPalette, IconDeviceFloppy, IconScale } from '@tabler/icons-react'
import { AppSelect } from '../../components/form/AppSelect'
import { OPCOES_ESQUEMA_COR, OPCOES_ICONES, OPCOES_CORES } from './constants'

interface IdentidadeVisualSectionProps {
  form: any
  computedColorScheme: string
  salvandoConfig: boolean
  handleMudarTema: (val: string | null) => void
  handleSubmitConfigs: (values: any) => void
}

export function IdentidadeVisualSection({
  form,
  computedColorScheme,
  salvandoConfig,
  handleMudarTema,
  handleSubmitConfigs,
}: IdentidadeVisualSectionProps) {
  return (
    <Card withBorder radius="sm" p="sm">
      <Title order={4} mb={2} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconPalette size={18} />
        Identidade Visual & Tema
      </Title>
      <Text size="xs" c="dimmed" mb="sm">
        O modo de exibição (claro/escuro), nome, subtítulo, ícone e paleta de cores ficam salvos no banco SQLite
      </Text>

      <form onSubmit={form.onSubmit(handleSubmitConfigs)}>
        <Stack gap="xs">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <TextInput
              label="Nome do Aplicativo"
              size="xs"
              placeholder="Ex: Mapa de Cotações"
              required
              {...form.getInputProps('app_nome')}
            />

            <TextInput
              label="Subtítulo do Cabeçalho"
              size="xs"
              placeholder="Ex: Comparativo e Alocação Inteligente"
              required
              {...form.getInputProps('app_subtitulo')}
            />

            <AppSelect
              label="Modo de Exibição"
              size="xs"
              data={OPCOES_ESQUEMA_COR.map((op) => ({
                value: op.value,
                label: op.label,
              }))}
              value={form.values.app_color_scheme}
              onChange={handleMudarTema}
              allowDeselect={false}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <AppSelect
              label="Ícone do Cabeçalho"
              size="xs"
              data={OPCOES_ICONES.map((op) => ({
                value: op.value,
                label: op.label,
              }))}
              {...form.getInputProps('app_icone')}
              allowDeselect={false}
            />

            <AppSelect
              label="Cor de Destaque do Tema"
              size="xs"
              data={OPCOES_CORES.map((op) => ({
                value: op.value,
                label: op.label,
              }))}
              {...form.getInputProps('app_theme_color')}
              allowDeselect={false}
            />
          </SimpleGrid>

          {/* Preview da Barra */}
          <Paper withBorder p={8} radius="xs" mt={4}>
            <Text size="10px" fw={700} c="dimmed" tt="uppercase" mb={2}>
              Pré-visualização do Cabeçalho:
            </Text>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <ThemeIcon
                  size={28}
                  radius="sm"
                  variant="filled"
                  color={form.values.app_theme_color || 'blue'}
                >
                  {OPCOES_ICONES.find((i) => i.value === form.values.app_icone)?.icon || (
                    <IconScale size={18} />
                  )}
                </ThemeIcon>
                <div>
                  <Title order={5} style={{ lineHeight: 1.1, fontSize: '0.9rem' }}>
                    {form.values.app_nome || 'Mapa de Cotações'}
                  </Title>
                  <Text size="10px" c="dimmed">
                    {form.values.app_subtitulo || 'Comparativo e Alocação Inteligente'}
                  </Text>
                </div>
              </Group>
              <Group gap={6}>
                <Badge variant="light" size="xs" color={form.values.app_theme_color || 'blue'}>
                  {computedColorScheme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
                </Badge>
                <Badge variant="outline" size="xs" color={form.values.app_theme_color || 'blue'}>
                  Desktop
                </Badge>
              </Group>
            </Group>
          </Paper>

          <Group justify="flex-end" mt="xs">
            <Button
              type="submit"
              size="xs"
              leftSection={<IconDeviceFloppy size={14} />}
              loading={salvandoConfig}
              color={form.values.app_theme_color || 'blue'}
            >
              Salvar Preferências
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  )
}
