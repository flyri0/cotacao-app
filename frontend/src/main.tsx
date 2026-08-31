import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createTheme, MantineProvider, Autocomplete, Select, Modal } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/charts/styles.css'
import 'mantine-react-table/styles.css'
import './index.css'
import App from './App.tsx'

const theme = createTheme({
  components: {
    Modal: Modal.extend({
      defaultProps: {
        lockScroll: false,
      },
    }),
    Autocomplete: Autocomplete.extend({
      defaultProps: {
        selectFirstOptionOnChange: true,
      },
    }),
    Select: Select.extend({
      defaultProps: {
        selectFirstOptionOnChange: true,
      },
    }),
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <ModalsProvider>
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
)
