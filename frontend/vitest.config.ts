import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/utils/**',
        'src/services/apiCache.ts',
        'src/services/syncService.ts',
        'src/hooks/**',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/test/**',
        'src/utils/index.ts',
        'src/hooks/index.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
})
