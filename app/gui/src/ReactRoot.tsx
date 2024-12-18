/** @file A file containing setup for React part of application. */

import App from '#/App.tsx'
import { ReactQueryDevtools } from '#/components/Devtools'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { OfflineNotificationManager } from '#/components/OfflineNotificationManager'
import { Suspense } from '#/components/Suspense'
import UIProviders from '#/components/UIProviders'
import LoadingScreen from '#/pages/authentication/LoadingScreen'
import { HttpClientProvider } from '#/providers/HttpClientProvider'
import LoggerProvider from '#/providers/LoggerProvider'
import HttpClient from '#/utilities/HttpClient'
import { ApplicationConfigValue } from '@/util/config'
import * as sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/vue-query'
import * as detect from 'enso-common/src/detect'
import { IS_DEV_MODE, isOnElectron, isOnLinux } from 'enso-common/src/detect'
import { startTransition, StrictMode, useEffect } from 'react'
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom'

import invariant from 'tiny-invariant'

const HTTP_STATUS_BAD_REQUEST = 400
const API_HOST =
  process.env.ENSO_CLOUD_API_URL != null ? new URL(process.env.ENSO_CLOUD_API_URL).host : null
const INITIAL_URL_KEY = `Enso-initial-url`
/** The fraction of non-erroring interactions that should be sampled by Sentry. */
const SENTRY_SAMPLE_RATE = 0.005

interface ReactRootProps {
  config: ApplicationConfigValue
  queryClient: QueryClient
  classSet: Map<string, number>
}

function resolveEnvUrl(url: string | undefined) {
  return url?.replace('__HOSTNAME__', window.location.hostname)
}

/**
 * A component gathering all views written currently in React with necessary contexts.
 */
export default function ReactRoot(props: ReactRootProps) {
  const { config, queryClient } = props

  if (
    !detect.IS_DEV_MODE &&
    process.env.ENSO_CLOUD_SENTRY_DSN != null &&
    process.env.ENSO_CLOUD_API_URL != null
  ) {
    const version: unknown = import.meta.env.ENSO_IDE_VERSION
    sentry.init({
      dsn: process.env.ENSO_CLOUD_SENTRY_DSN,
      environment: process.env.ENSO_CLOUD_ENVIRONMENT,
      release: version?.toString() ?? 'dev',
      integrations: [
        sentry.reactRouterV6BrowserTracingIntegration({
          useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
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
      beforeSend: (event) => {
        if (
          (event.breadcrumbs ?? []).some(
            (breadcrumb) =>
              breadcrumb.type === 'http' &&
              breadcrumb.category === 'fetch' &&
              breadcrumb.data &&
              breadcrumb.data.status_code === HTTP_STATUS_BAD_REQUEST &&
              typeof breadcrumb.data.url === 'string' &&
              new URL(breadcrumb.data.url).host === API_HOST,
          )
        ) {
          return null
        }
        return event
      },
    })
  }

  const httpClient = new HttpClient()
  const supportsDeepLinks = !IS_DEV_MODE && !isOnLinux() && isOnElectron()
  const portalRoot = document.querySelector('#enso-portal-root')
  const shouldUseAuthentication = config.authentication.enabled
  const projectManagerUrl =
    (config.engine.projectManagerUrl || resolveEnvUrl(PROJECT_MANAGER_URL)) ?? null
  const ydocUrl = (config.engine.ydocUrl || resolveEnvUrl(YDOC_SERVER_URL)) ?? null
  const initialProjectName = config.startup.project || null
  invariant(portalRoot, 'PortalRoot element not found')

  /**
   * Note: Signing out always redirects to `/`. It is impossible to make this work,
   * as it is not possible to distinguish between having just logged out, and explicitly
   * opening a page with no URL parameters set.
   *
   * Client-side routing endpoints are explicitly not supported for live-reload, as they are
   * transitional pages that should not need live-reload when running `gui watch`.
   */
  const url = new URL(location.href)
  const isInAuthenticationFlow = url.searchParams.has('code') && url.searchParams.has('state')
  const authenticationUrl = location.href

  if (isInAuthenticationFlow) {
    history.replaceState(null, '', localStorage.getItem(INITIAL_URL_KEY))
  }
  if (isInAuthenticationFlow) {
    history.replaceState(null, '', authenticationUrl)
  } else {
    localStorage.setItem(INITIAL_URL_KEY, location.href)
  }

  const onAuthenticated = () => {
    if (isInAuthenticationFlow) {
      const initialUrl = localStorage.getItem(INITIAL_URL_KEY)
      if (initialUrl != null) {
        // This is not used past this point, however it is set to the initial URL
        // to make refreshing work as expected.
        history.replaceState(null, '', initialUrl)
      }
    }
  }
  return (
    // TODO [ao]: This wrapping element should be in App.vue, but veaury's wrapper for react sets
    //  `style="all: unset"` breaking our layout.
    //  See https://github.com/gloriasoft/veaury/issues/158
    <div id="enso-dashboard" className={`App ${[...props.classSet.keys()].join(' ')}`}>
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <UIProviders locale="en-US" portalRoot={portalRoot}>
              <Suspense fallback={<LoadingScreen />}>
                <OfflineNotificationManager>
                  <LoggerProvider logger={console}>
                    <HttpClientProvider httpClient={httpClient}>
                      <App
                        supportsDeepLinks={supportsDeepLinks}
                        supportsLocalBackend={!IS_CLOUD_BUILD}
                        isAuthenticationDisabled={!shouldUseAuthentication}
                        projectManagerUrl={projectManagerUrl}
                        ydocUrl={ydocUrl}
                        initialProjectName={initialProjectName}
                        onAuthenticated={onAuthenticated}
                      />
                    </HttpClientProvider>
                  </LoggerProvider>
                </OfflineNotificationManager>
              </Suspense>

              <ReactQueryDevtools />
            </UIProviders>
          </ErrorBoundary>
        </QueryClientProvider>
      </StrictMode>
    </div>
  )
}
