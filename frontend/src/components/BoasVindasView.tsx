import { useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
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
        message: '50 produtos em 6 categorias, 8 fornecedores, 3 rodadas fechadas e 1 aberta carregadas.',
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
    <Box
      style={{
        width: '100%',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <Box
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'clamp(16px, 3vh, 36px) clamp(12px, 3vw, 24px)',
        }}
      >
        <Container size="md" p={0} style={{ width: '100%', maxWidth: 740 }}>
          <Stack gap="md" align="center">
            {/* Cabeçalho de Boas-Vindas */}
            <Stack align="center" gap={6} style={{ textAlign: 'center' }}>
              <ThemeIcon
                size={52}
                radius="xl"
                variant="filled"
                color={themeColor}
                style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)' }}
              >
                <IconScale size={28} />
              </ThemeIcon>
              <Title order={1} fz={{ base: 20, sm: 26 }} fw={700}>
                {appNome}
              </Title>
              <Text size="sm" c="dimmed" style={{ maxWidth: 480 }}>
                {appSubtitulo}
              </Text>
              <Badge variant="light" color={themeColor} size="sm" mt={2}>
                Primeiro Acesso • Configuração Inicial
              </Badge>
            </Stack>

            <Text size="xs" c="dimmed" ta="center" style={{ maxWidth: 520 }}>
              Para começar a utilizar o sistema, escolha como deseja inicializar o seu banco de dados local SQLite:
            </Text>

            {/* Cards de Escolha Principal */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: 'xs', sm: 'md' }} style={{ width: '100%' }}>
              {/* Opção 1: Criar Banco em Branco */}
              <Card withBorder shadow="sm" radius="md" p={{ base: 'sm', sm: 'md' }}>
                <Stack justify="space-between" h="100%" gap="md">
                  <div>
                    <Group gap="xs" mb="xs">
                      <ThemeIcon color="blue" variant="light" size="lg" radius="md">
                        <IconPlus size={20} />
                      </ThemeIcon>
                      <div>
                        <Title order={3} fz="sm" fw={700}>
                          Banco em Branco
                        </Title>
                        <Text size="11px" c="dimmed">
                          Recomendado para produção
                        </Text>
                      </div>
                    </Group>
                    <Text size="xs" c="dimmed" style={{ lineHeight: 1.4 }}>
                      Inicie com um catálogo 100% limpo para cadastrar seus próprios produtos, fornecedores e criar suas primeiras rodadas de cotação.
                    </Text>
                  </div>

                  <Button
                    size="xs"
                    color="blue"
                    variant="filled"
                    leftSection={<IconPlus size={16} />}
                    onClick={handleCriarEmBranco}
                    loading={loading}
                    fullWidth
                  >
                    Iniciar com Banco Vazio
                  </Button>
                </Stack>
              </Card>

              {/* Opção 2: Importar Backup Existente */}
              <Card withBorder shadow="sm" radius="md" p={{ base: 'sm', sm: 'md' }}>
                <Stack justify="space-between" h="100%" gap="md">
                  <div>
                    <Group gap="xs" mb="xs">
                      <ThemeIcon color="teal" variant="light" size="lg" radius="md">
                        <IconDatabaseImport size={20} />
                      </ThemeIcon>
                      <div>
                        <Title order={3} fz="sm" fw={700}>
                          Restaurar Backup
                        </Title>
                        <Text size="11px" c="dimmed">
                          Importar arquivo .db existente
                        </Text>
                      </div>
                    </Group>
                    <Text size="xs" c="dimmed" mb="xs" style={{ lineHeight: 1.4 }}>
                      Carregue uma cópia de segurança salva anteriormente (.db ou .sqlite) com todo o histórico e cadastros.
                    </Text>

                    <FileInput
                      placeholder="Selecione o arquivo .db"
                      accept=".db,.sqlite"
                      value={arquivoImportar}
                      onChange={setArquivoImportar}
                      size="xs"
                      clearable
                    />
                  </div>

                  <Button
                    size="xs"
                    color="teal"
                    variant="filled"
                    leftSection={<IconDatabaseImport size={16} />}
                    onClick={handleImportarBackup}
                    disabled={!arquivoImportar}
                    loading={loading}
                    fullWidth
                  >
                    Restaurar e Abrir
                  </Button>
                </Stack>
              </Card>
            </SimpleGrid>

            <Divider label="Ou use dados fictícios para explorar" labelPosition="center" style={{ width: '100%' }} />

            {/* Opção 3: Dados de Teste & Demonstração (Discreto / Menos Chamativo) */}
            <Paper withBorder p={{ base: 'xs', sm: 'sm' }} radius="md" style={{ width: '100%' }}>
              <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                <div style={{ flex: 1, minWidth: 260 }}>
                  <Group gap={6}>
                    <ThemeIcon color="gray" variant="light" size="sm" radius="xs">
                      <IconFlask size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="xs">
                      Carregar Banco de Demonstração & Testes
                    </Text>
                  </Group>
                  <Text size="11px" c="dimmed" mt={2} style={{ lineHeight: 1.35 }}>
                    Popula o sistema com 50 produtos em 6 categorias, 8 fornecedores, 3 rodadas fechadas e 1 rodada aberta com cotações e alocações.
                  </Text>
                </div>

                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  leftSection={<IconSparkles size={14} />}
                  onClick={handleCarregarDemo}
                  loading={loading}
                  style={{ flexShrink: 0 }}
                >
                  Carregar Dados de Teste
                </Button>
              </Group>
            </Paper>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

export default BoasVindasView
