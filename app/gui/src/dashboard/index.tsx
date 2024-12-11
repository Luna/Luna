/**
 * @file Authentication module used by Enso IDE & Cloud.
 *
 * This module declares the main DOM structure for the authentication/dashboard app.
 */
import * as React from 'react'

import * as sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import * as reactDOM from 'react-dom/client'
import * as reactRouter from 'react-router-dom'
import invariant from 'tiny-invariant'

import * as detect from 'enso-common/src/detect'

import type * as app from '#/App'
import App from '#/App'

import { HttpClientProvider } from '#/providers/HttpClientProvider'
import LoggerProvider, { type Logger } from '#/providers/LoggerProvider'

import LoadingScreen from '#/pages/authentication/LoadingScreen'

import { ReactQueryDevtools } from '#/components/Devtools'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { OfflineNotificationManager } from '#/components/OfflineNotificationManager'
import { Suspense } from '#/components/Suspense'
import UIProviders from '#/components/UIProviders'

import HttpClient from '#/utilities/HttpClient'
import { MotionGlobalConfig } from 'framer-motion'

export type { GraphEditorRunner } from '#/layouts/Editor'

const ARE_ANIMATIONS_DISABLED =
  window.DISABLE_ANIMATIONS === true ||
  localStorage.getItem('disableAnimations') === 'true' ||
  false

MotionGlobalConfig.skipAnimations = ARE_ANIMATIONS_DISABLED

if (ARE_ANIMATIONS_DISABLED) {
  document.documentElement.classList.add('disable-animations')
} else {
  document.documentElement.classList.remove('disable-animations')
}

// =================
// === Constants ===
// =================

/** The `id` attribute of the root element that the app will be rendered into. */
const ROOT_ELEMENT_ID = 'enso-dashboard'
/** The fraction of non-erroring interactions that should be sampled by Sentry. */
const SENTRY_SAMPLE_RATE = 0.005

// ======================
// === DashboardProps ===
// ======================

/** Props for the dashboard. */
export interface DashboardProps extends app.AppProps {
  readonly logger: Logger
}

// ===========
// === run ===
// ===========

/**
 * Entrypoint for the authentication/dashboard app.
 *
 * Running this function finds a `div` element with the ID `dashboard`, and renders the
 * authentication/dashboard UI using React. It also handles routing and other interactions (e.g.,
 * for redirecting the user to/from the login page).
 */
export function run(props: DashboardProps) {
  const { vibrancy, supportsDeepLinks, queryClient, logger } = props
  if (
    !detect.IS_DEV_MODE &&
    process.env.ENSO_CLOUD_SENTRY_DSN != null &&
    process.env.ENSO_CLOUD_API_URL != null
  ) {
    sentry.init({
      dsn: process.env.ENSO_CLOUD_SENTRY_DSN,
      environment: process.env.ENSO_CLOUD_ENVIRONMENT,
      integrations: [
        new sentry.BrowserTracing({
          routingInstrumentation: sentry.reactRouterV6Instrumentation(
            React.useEffect,
            reactRouter.useLocation,
            reactRouter.useNavigationType,
            reactRouter.createRoutesFromChildren,
            reactRouter.matchRoutes,
          ),
        }),
        sentry.extraErrorDataIntegration({ captureErrorCause: true }),
        sentry.replayIntegration(),
        new sentry.BrowserProfilingIntegration(),
      ],
      profilesSampleRate: SENTRY_SAMPLE_RATE,
      tracesSampleRate: SENTRY_SAMPLE_RATE,
      tracePropagationTargets: [process.env.ENSO_CLOUD_API_URL.split('//')[1] ?? ''],
      replaysSessionSampleRate: SENTRY_SAMPLE_RATE,
      replaysOnErrorSampleRate: 1.0,
    })
  }

  if (vibrancy) {
    document.body.classList.add('vibrancy')
  }

  const root = document.getElementById(ROOT_ELEMENT_ID)
  const portalRoot = document.querySelector('#enso-portal-root')

  invariant(root, 'Root element not found')
  invariant(portalRoot, 'PortalRoot element not found')

  // `supportsDeepLinks` will be incorrect when accessing the installed Electron app's pages
  // via the browser.
  const actuallySupportsDeepLinks =
    detect.IS_DEV_MODE ? supportsDeepLinks : supportsDeepLinks && detect.isOnElectron()

  const httpClient = new HttpClient()

  React.startTransition(() => {
    reactDOM.createRoot(root).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <UIProviders locale="en-US" portalRoot={portalRoot}>
              <Suspense fallback={<LoadingScreen />}>
                <OfflineNotificationManager>
                  <LoggerProvider logger={logger}>
                    <HttpClientProvider httpClient={httpClient}>
                      <App {...props} supportsDeepLinks={actuallySupportsDeepLinks} />
                    </HttpClientProvider>
                  </LoggerProvider>
                </OfflineNotificationManager>
              </Suspense>

              <ReactQueryDevtools />
            </UIProviders>
          </ErrorBoundary>
        </QueryClientProvider>
      </React.StrictMode>,
    )
  })
}

/** Global configuration for the {@link App} component. */
export type AppProps = app.AppProps
