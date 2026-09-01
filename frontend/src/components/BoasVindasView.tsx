import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Center,
  Container,
  Divider,
  FileInput,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconDatabaseImport,
  IconFlask,
  IconPlus,
  IconScale,
  IconSparkles,
  IconX,
} from '@tabler/icons-react'
import { getApi } from '../services/api'

interface BoasVindasViewProps {
  onInicializado: () => void
  appNome?: string
  appSubtitulo?: string
  themeColor?: string
}

export function BoasVindasView({
  onInicializado,
  appNome = 'Mapa de Cotações',
  appSubtitulo = 'Comparativo e Alocação Inteligente',
  themeColor = 'blue',
}: BoasVindasViewProps) {
  const [loading, setLoading] = useState(false)
  const [arquivoImportar, setArquivoImportar] = useState<File | null>(null)

  // Opção 1: Criar Banco em Branco (100% limpo para produção)
  const handleCriarEmBranco = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      await api.initialize_empty_db()
      notifications.show({
        title: 'Banco Criado',
        message: 'Banco de dados em branco inicializado com sucesso.',
        color: 'green',
        icon: <IconCheck size={16} />,
      })
      onInicializado()
    } catch (error: any) {
      console.error('Erro ao inicializar banco em branco:', error)
      notifications.show({
        title: 'Erro ao inicializar',
        message: error?.message || 'Falha ao criar banco de dados.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  // Opção 2: Importar Backup .db
  const handleImportarBackup = async () => {
    if (!arquivoImportar) {
      notifications.show({
        title: 'Selecione um arquivo',
        message: 'Escolha um arquivo .db ou .sqlite para restaurar.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />,
      })
      return
    }

    try {
      setLoading(true)
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer
          const bytes = new Uint8Array(buffer)
          let binary = ''
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          const base64 = window.btoa(binary)

          const api = await getApi()
          await api.import_database(base64)
          await api.initialize_empty_db() // Marca como inicializado

          notifications.show({
            title: 'Backup Restaurado com Sucesso',
            message: 'O arquivo SQLite foi importado e validado.',
            color: 'teal',
            icon: <IconCheck size={16} />,
          })
          onInicializado()
        } catch (err: any) {
          notifications.show({
            title: 'Erro na importação',
            message: err?.message || 'O arquivo fornecido não é um banco SQLite válido.',
            color: 'red',
            icon: <IconX size={16} />,
          })
        } finally {
          setLoading(false)
        }
      }
      reader.readAsArrayBuffer(arquivoImportar)
    } catch (error: any) {
      setLoading(false)
      notifications.show({
        title: 'Erro de leitura',
        message: error?.message || 'Não foi possível ler o arquivo.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    }
  }

  // Opção 3: Carregar Dados de Demonstração e Testes (Rico com múltiplas rodadas)
  const handleCarregarDemo = async () => {
    try {
      setLoading(true)
      const api = await getApi()
      await api.populate_demo_db()
      notifications.show({
        title: 'Banco Populado para Testes',
        message: '12 produtos, 5 fornecedores, 3 rodadas fechadas e 1 aberta carregadas.',
        color: 'teal',
        icon: <IconSparkles size={16} />,
      })
      onInicializado()
    } catch (error: any) {
      console.error('Erro ao popular dados de demonstração:', error)
      notifications.show({
        title: 'Erro ao carregar demonstração',
        message: error?.message || 'Falha ao popular banco de dados.',
        color: 'red',
        icon: <IconX size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Center style={{ minHeight: '90vh', padding: '24px 16px' }}>
      <Container size="md" style={{ width: '100%' }}>
        <Stack gap="xl" align="center">
          {/* Cabeçalho de Boas-Vindas */}
          <Stack align="center" gap="xs" style={{ textAlign: 'center' }}>
            <ThemeIcon size={64} radius="xl" variant="filled" color={themeColor}>
              <IconScale size={36} />
            </ThemeIcon>
            <Title order={1}>{appNome}</Title>
            <Text size="md" c="dimmed" style={{ maxWidth: 540 }}>
              {appSubtitulo}
            </Text>
            <Badge variant="light" color={themeColor} size="lg" mt="xs">
              Primeiro Acesso • Configuração Inicial
            </Badge>
          </Stack>

          <Text size="sm" c="dimmed" ta="center">
            Para começar a utilizar o sistema, escolha como deseja inicializar o seu banco de dados local SQLite:
          </Text>

          {/* Cards de Escolha Principal */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" style={{ width: '100%' }}>
            {/* Opção 1: Criar Banco em Branco */}
            <Card withBorder shadow="sm" radius="md" p="xl">
              <Stack justify="space-between" h="100%">
                <div>
                  <Group gap="xs" mb="sm">
                    <ThemeIcon color="blue" variant="light" size="xl" radius="md">
                      <IconPlus size={24} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>Banco em Branco</Title>
                      <Text size="xs" c="dimmed">
                        Recomendado para produção
                      </Text>
                    </div>
                  </Group>
                  <Text size="sm" c="dimmed" mt="xs">
                    Inicie com um catálogo 100% limpo para cadastrar seus próprios produtos, fornecedores e criar suas primeiras rodadas de cotação.
                  </Text>
                </div>

                <Button
                  size="md"
                  color="blue"
                  variant="filled"
                  leftSection={<IconPlus size={18} />}
                  onClick={handleCriarEmBranco}
                  loading={loading}
                  mt="xl"
                  fullWidth
                >
                  Iniciar com Banco Vazio
                </Button>
              </Stack>
            </Card>

            {/* Opção 2: Importar Backup Existente */}
            <Card withBorder shadow="sm" radius="md" p="xl">
              <Stack justify="space-between" h="100%">
                <div>
                  <Group gap="xs" mb="sm">
                    <ThemeIcon color="teal" variant="light" size="xl" radius="md">
                      <IconDatabaseImport size={24} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>Restaurar Backup</Title>
                      <Text size="xs" c="dimmed">
                        Importar arquivo .db existente
                      </Text>
                    </div>
                  </Group>
                  <Text size="sm" c="dimmed" mt="xs" mb="sm">
                    Carregue um arquivo de cópia de segurança salvo anteriormente no seu computador com todo o histórico e cadastros.
                  </Text>

                  <FileInput
                    placeholder="Selecione o arquivo .db"
                    accept=".db,.sqlite"
                    value={arquivoImportar}
                    onChange={setArquivoImportar}
                    size="xs"
                  />
                </div>

                <Button
                  size="md"
                  color="teal"
                  variant="filled"
                  leftSection={<IconDatabaseImport size={18} />}
                  onClick={handleImportarBackup}
                  disabled={!arquivoImportar}
                  loading={loading}
                  mt="xl"
                  fullWidth
                >
                  Restaurar e Abrir
                </Button>
              </Stack>
            </Card>
          </SimpleGrid>

          <Divider label="Ou use dados fictícios para explorar" labelPosition="center" style={{ width: '100%' }} />

          {/* Opção 3: Dados de Teste & Demonstração (Discreto / Menos Chamativo) */}
          <Paper withBorder p="md" radius="md" style={{ width: '100%' }}>
            <Group justify="space-between" align="center">
              <div>
                <Group gap="xs">
                  <ThemeIcon color="gray" variant="light" size="md" radius="sm">
                    <IconFlask size={16} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Carregar Banco de Dados de Demonstração & Testes
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Popula o sistema com 12 produtos, 5 fornecedores, 3 rodadas fechadas (histórico de preços) e 1 rodada aberta em andamento com cotações.
                </Text>
              </div>

              <Button
                variant="subtle"
                color="gray"
                size="sm"
                leftSection={<IconSparkles size={14} />}
                onClick={handleCarregarDemo}
                loading={loading}
              >
                Carregar Dados de Teste
              </Button>
            </Group>
          </Paper>
        </Stack>
      </Container>
    </Center>
  )
}

export default BoasVindasView
