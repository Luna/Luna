import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import postcssNesting from 'postcss-nesting'
import tailwindcss from 'tailwindcss'
import tailwindcssNesting from 'tailwindcss/nesting'
import { defineConfig, Plugin } from 'vite'
import topLevelAwait from 'vite-plugin-top-level-await'
import * as tailwindConfig from '../ide-desktop/lib/dashboard/tailwind.config'
import { createGatewayServer } from './ydoc-server'

const projectManagerUrl = 'ws://127.0.0.1:30535'

// https://vitejs.dev/config/
export default defineConfig({
  cacheDir: '../../node_modules/.cache/vite',
  plugins: [vue(), gatewayServer(), topLevelAwait()],
  optimizeDeps: {
    entries: 'index.html',
  },
  resolve: {
    alias: {
      shared: fileURLToPath(new URL('./shared', import.meta.url)),
      // These are required to be defined before `@` as they will be overridden by Histoire.
      '@/stores/project': fileURLToPath(new URL('./src/stores/project.ts', import.meta.url)),
      '@/stores/suggestionDatabase/entry': fileURLToPath(
        new URL('./src/stores/suggestionDatabase/entry.ts', import.meta.url),
      ),
      '@/stores/suggestionDatabase': fileURLToPath(
        new URL('./src/stores/mockSuggestionDatabaseStore.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    REDIRECT_OVERRIDE: JSON.stringify('http://localhost:8080'),
    PROJECT_MANAGER_URL: JSON.stringify(projectManagerUrl),
    IS_DEV_MODE: JSON.stringify(process.env.NODE_ENV !== 'production'),
    HISTOIRE: 'false',
    CLOUD_ENV:
      process.env.ENSO_CLOUD_ENV != null ? JSON.stringify(process.env.ENSO_CLOUD_ENV) : 'undefined',
    RUNNING_VTEST: false,
  },
  assetsInclude: ['**/*.yaml', '**/*.svg'],
  css: {
    postcss: {
      plugins: [tailwindcssNesting(postcssNesting()), tailwindcss({ config: tailwindConfig })],
    },
  },
  build: {
    // dashboard chunk size is larger than the default warning limit
    chunkSizeWarningLimit: 700,
  },
})

function gatewayServer(): Plugin {
  return {
    name: 'gateway-server',
    configureServer(server) {
      if (server.httpServer == null) return

      createGatewayServer(server.httpServer)
    },
  }
}
