import { useState } from 'react'
import {
  Badge,
  Center,
  Container,
  Divider,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconScale, IconX, IconSparkles } from '@tabler/icons-react'
import { getApi } from '../../services/api'
import { BlankDatabaseCard } from './BlankDatabaseCard'
import { RestoreBackupCard } from './RestoreBackupCard'
import { DemoDatabaseCard } from './DemoDatabaseCard'

interface BoasVindasProps {
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
}: BoasVindasProps) {
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
            <BlankDatabaseCard onCreateBlank={handleCriarEmBranco} loading={loading} />
            <RestoreBackupCard 
              arquivoImportar={arquivoImportar}
              setArquivoImportar={setArquivoImportar}
              onImportBackup={handleImportarBackup}
              loading={loading}
            />
          </SimpleGrid>

          <Divider label="Ou use dados fictícios para explorar" labelPosition="center" style={{ width: '100%' }} />

          <DemoDatabaseCard onLoadDemo={handleCarregarDemo} loading={loading} />
        </Stack>
      </Container>
    </Center>
  )
}

export default BoasVindasView
