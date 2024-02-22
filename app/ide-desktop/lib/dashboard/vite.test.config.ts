/** @file Configuration for vite. */
import * as vite from 'vite'

import config from './vite.config'

// =====================
// === Configuration ===
// =====================

/* eslint-disable @typescript-eslint/naming-convention */

const SERVER_PORT = 8080

export default vite.defineConfig(env =>
  vite.mergeConfig(
    config(env),
    vite.defineConfig({
      resolve: {
        extensions: [
          '.mock.mjs',
          '.mock.js',
          '.mock.mts',
          '.mock.ts',
          '.mock.jsx',
          '.mock.tsx',
          '.mock.json',
          '.mjs',
          '.js',
          '.mts',
          '.ts',
          '.jsx',
          '.tsx',
          '.json',
        ],
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.ENSO_CLOUD_REDIRECT': JSON.stringify(`http://localhost:${SERVER_PORT}`),
        'process.env.ENSO_CLOUD_ENVIRONMENT': JSON.stringify('production'),
        'process.env.ENSO_CLOUD_API_URL': JSON.stringify(''),
        'process.env.ENSO_CLOUD_SENTRY_DSN': JSON.stringify(''),
        'process.env.ENSO_CLOUD_STRIPE_KEY': JSON.stringify(''),
        'process.env.ENSO_CLOUD_CHAT_URL': JSON.stringify(''),
        'process.env.ENSO_CLOUD_AMPLIFY_USER_POOL_ID': JSON.stringify(''),
        'process.env.ENSO_CLOUD_AMPLIFY_USER_POOL_WEB_CLIENT_ID': JSON.stringify(''),
        'process.env.ENSO_CLOUD_AMPLIFY_DOMAIN': JSON.stringify(''),
        'process.env.ENSO_CLOUD_AMPLIFY_REGION': JSON.stringify(''),
      },
    })
  )
)
