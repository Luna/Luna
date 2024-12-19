/**
 * @file File containing the {@link App} React component, which is the entrypoint into our React
 * application.
 *
 * # Providers
 *
 * The {@link App} component is responsible for defining the global context used by child
 * components. For example, it defines a {@link ToastContainer}, which is used to display temporary
 * notifications to the user. These global components are defined at the top of the {@link App} so
 * that they are available to all of the child components.
 *
 * The {@link App} also defines various providers (e.g., {@link AuthProvider}).
 * Providers are a React-specific concept that allows components to access global state without
 * having to pass it down through the component tree. For example, the
 * {@link AuthProvider} wraps the entire application, and provides the context
 * necessary for child components to use the {@link useAuth} hook. The
 * {@link useAuth} hook lets child components access the user's authentication session
 * (i.e., email, username, etc.) and it also provides methods for signing the user in, etc.
 *
 * Providers consist of a provider component that wraps the application, a context object defined
 * by the provider component, and a hook that can be used by child components to access the context.
 * All of the providers are initialized here, at the {@link App} component to ensure that they are
 * available to all of the child components.
 *
 * # Routes and Authentication
 *
 * The {@link AppRouter} component defines the layout of the application, in terms of navigation. It
 * consists of a list of {@link Route}s, as well as the HTTP pathnames that the
 * {@link Route}s can be accessed by.
 *
 * The {@link Route}s are grouped by authorization level. Some routes are
 * accessed by unauthenticated (i.e., not signed in) users. Some routes are accessed by partially
 * authenticated users (c.f. {@link PartialUserSession}). That is, users who have
 * signed up but who have not completed email verification or set a username. The remaining
 * {@link Route}s require fully authenticated users (c.f.
 * {@link FullUserSession}).
 */
import { useEffect, useMemo, useState } from 'react'

import { useQuery, useSuspenseQuery, type QueryClient } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Slide, ToastContainer } from 'react-toastify'
import * as z from 'zod'

import { mapEntries, unsafeEntries } from '@common/utilities/data/object'
import { Path } from '@common/utilities/data/path'
import { IS_DEV_MODE } from '@common/utilities/detect'

import {
  ALL_PATHS_REGEX,
  CONFIRM_REGISTRATION_PATH,
  DASHBOARD_PATH,
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  REGISTRATION_PATH,
  RESET_PASSWORD_PATH,
  RESTORE_USER_PATH,
  SETUP_PATH,
  SUBSCRIBE_PATH,
  SUBSCRIBE_SUCCESS_PATH,
} from '#/appUtils'
import { useInitAuthService } from '#/authentication/service'
import { RouterProvider } from '#/components/aria'
import { EnsoDevtools } from '#/components/Devtools'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { Suspense } from '#/components/Suspense'
import { createBindings, type DashboardBindingKey } from '#/configurations/inputBindings'
import type { GraphEditorRunner } from '#/layouts/Editor'
import { OpenAppWatcher } from '#/layouts/OpenAppWatcher'
import VersionChecker from '#/layouts/VersionChecker'
import AboutModal from '#/modals/AboutModal'
import { AgreementsModal } from '#/modals/AgreementsModal'
import { InvitedToOrganizationModal } from '#/modals/InvitedToOrganizationModal'
import { SetupOrganizationAfterSubscribe } from '#/modals/SetupOrganizationAfterSubscribe'
import ConfirmRegistration from '#/pages/authentication/ConfirmRegistration'
import ForgotPassword from '#/pages/authentication/ForgotPassword'
import Login from '#/pages/authentication/Login'
import Registration from '#/pages/authentication/Registration'
import ResetPassword from '#/pages/authentication/ResetPassword'
import RestoreAccount from '#/pages/authentication/RestoreAccount'
import { Setup } from '#/pages/authentication/Setup'
import Dashboard from '#/pages/dashboard/Dashboard'
import { Subscribe } from '#/pages/subscribe/Subscribe'
import { SubscribeSuccess } from '#/pages/subscribe/SubscribeSuccess'
import AuthProvider, {
  FullUserSession,
  GuestLayout,
  NotDeletedUserLayout,
  PartialUserSession,
  ProtectedLayout,
  SoftDeletedUserLayout,
  useAuth,
} from '#/providers/AuthProvider'
import BackendProvider, { useLocalBackend } from '#/providers/BackendProvider'
import DriveProvider from '#/providers/DriveProvider'
import { FeatureFlagsProvider } from '#/providers/FeatureFlagsProvider'
import { useHttpClientStrict } from '#/providers/HttpClientProvider'
import InputBindingsProvider from '#/providers/InputBindingsProvider'
import LocalStorageProvider, {
  useLocalStorage,
  useLocalStorageState,
} from '#/providers/LocalStorageProvider'
import { useLogger } from '#/providers/LoggerProvider'
import ModalProvider, { useSetModal } from '#/providers/ModalProvider'
import { useNavigator2D } from '#/providers/Navigator2DProvider'
import SessionProvider from '#/providers/SessionProvider'
import { useText } from '#/providers/TextProvider'
import { APP_BASE_URL } from '#/utilities/appBaseUrl'
import { isElementPartOfMonaco, isElementTextInput } from '#/utilities/event'
import LocalStorage from '#/utilities/LocalStorage'
import { STATIC_QUERY_OPTIONS } from '#/utilities/reactQuery'
import { LocalBackend } from '@common/services/LocalBackend'
import ProjectManager, * as projectManager from '@common/services/ProjectManager'
import { RemoteBackend } from '@common/services/RemoteBackend'

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly inputBindings: Readonly<Record<string, readonly string[]>>
    readonly localRootDirectory: string
  }
}

LocalStorage.registerKey('inputBindings', {
  schema: z.record(z.string().array().readonly()).transform((value) =>
    Object.fromEntries(
      Object.entries<unknown>({ ...value }).flatMap((kv) => {
        const [k, v] = kv
        return Array.isArray(v) && v.every((item): item is string => typeof item === 'string') ?
            [[k, v]]
          : []
      }),
    ),
  ),
})

LocalStorage.registerKey('localRootDirectory', { schema: z.string() })

// ======================
// === getMainPageUrl ===
// ======================

/** Returns the URL to the main page. This is the current URL, with the current route removed. */
function getMainPageUrl() {
  const mainPageUrl = new URL(window.location.href)
  mainPageUrl.pathname = mainPageUrl.pathname.replace(ALL_PATHS_REGEX, '')
  return mainPageUrl
}

// ===========
// === App ===
// ===========

/** Global configuration for the `App` component. */
export interface AppProps {
  readonly vibrancy: boolean
  /** Whether the application may have the local backend running. */
  readonly supportsLocalBackend: boolean
  /** If true, the app can only be used in offline mode. */
  readonly isAuthenticationDisabled: boolean
  /**
   * Whether the application supports deep links. This is only true when using
   * the installed app on macOS and Windows.
   */
  readonly supportsDeepLinks: boolean
  /** Whether the dashboard should be rendered. */
  readonly shouldShowDashboard: boolean
  /** The name of the project to open on startup, if any. */
  readonly initialProjectName: string | null
  readonly onAuthenticated: (accessToken: string | null) => void
  readonly projectManagerUrl: string | null
  readonly ydocUrl: string | null
  readonly appRunner: GraphEditorRunner | null
  readonly queryClient: QueryClient
}

/**
 * Component called by the parent module, returning the root React component for this
 * package.
 *
 * This component handles all the initialization and rendering of the app, and manages the app's
 * routes. It also initializes an `AuthProvider` that will be used by the rest of the app.
 */
export default function App(props: AppProps) {
  const {
    data: { projectManagerRootDirectory, projectManagerInstance },
  } = useSuspenseQuery<{
    projectManagerInstance: ProjectManager | null
    projectManagerRootDirectory: projectManager.Path | null
  }>({
    queryKey: [
      'root-directory',
      {
        projectManagerUrl: props.projectManagerUrl,
        supportsLocalBackend: props.supportsLocalBackend,
      },
    ] as const,
    networkMode: 'always',
    ...STATIC_QUERY_OPTIONS,
    behavior: {
      onFetch: ({ state }) => {
        const instance = state.data?.projectManagerInstance ?? null

        if (instance != null) {
          void instance.dispose()
        }
      },
    },
    queryFn: async () => {
      if (props.supportsLocalBackend && props.projectManagerUrl != null) {
        const response = await fetch(`${APP_BASE_URL}/api/root-directory`)
        const text = await response.text()
        const rootDirectory = projectManager.Path(text)

        return {
          projectManagerInstance: new ProjectManager(props.projectManagerUrl, rootDirectory),
          projectManagerRootDirectory: rootDirectory,
        }
      } else {
        return {
          projectManagerInstance: null,
          projectManagerRootDirectory: null,
        }
      }
    },
  })

  const queryClient = props.queryClient

  // Force all queries to be stale
  // We don't use the `staleTime` option because it's not performant
  // and triggers unnecessary setTimeouts.
  useQuery({
    queryKey: ['refresh'],
    queryFn: () => {
      queryClient
        .getQueryCache()
        .getAll()
        .forEach((query) => {
          query.isStale = () => true
        })

      return null
    },
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    refetchInterval: 2 * 60 * 1000,
  })

  // Both `BackendProvider` and `InputBindingsProvider` depend on `LocalStorageProvider`.
  // Note that the `Router` must be the parent of the `AuthProvider`, because the `AuthProvider`
  // will redirect the user between the login/register pages and the dashboard.
  return (
    <>
      <ToastContainer
        position="top-center"
        theme="light"
        closeOnClick={false}
        draggable={false}
        toastClassName="text-sm leading-cozy bg-selected-frame rounded-lg backdrop-blur-default"
        transition={Slide}
        limit={3}
      />
      <BrowserRouter basename={getMainPageUrl().pathname}>
        <LocalStorageProvider>
          <ModalProvider>
            <AppRouter
              {...props}
              projectManagerInstance={projectManagerInstance}
              projectManagerRootDirectory={projectManagerRootDirectory}
            />
          </ModalProvider>
        </LocalStorageProvider>
      </BrowserRouter>
    </>
  )
}

// =================
// === AppRouter ===
// =================

/** Props for an {@link AppRouter}. */
export interface AppRouterProps extends AppProps {
  readonly projectManagerRootDirectory: projectManager.Path | null
  readonly projectManagerInstance: ProjectManager | null
}

/**
 * Router definition for the app.
 *
 * The only reason the {@link AppRouter} component is separate from the {@link App} component is
 * because the {@link AppRouter} relies on React hooks, which can't be used in the same React
 * component as the component that defines the provider.
 */
function AppRouter(props: AppRouterProps) {
  const { isAuthenticationDisabled, shouldShowDashboard } = props
  const { onAuthenticated, projectManagerInstance } = props
  const httpClient = useHttpClientStrict()
  const logger = useLogger()
  const navigate = useNavigate()

  const { getText } = useText()
  const { localStorage } = useLocalStorage()
  const { setModal } = useSetModal()

  const navigator2D = useNavigator2D()

  const localBackend = useMemo(
    () => (projectManagerInstance != null ? new LocalBackend(projectManagerInstance) : null),
    [projectManagerInstance],
  )

  const remoteBackend = useMemo(
    () => new RemoteBackend(httpClient, logger, getText),
    [httpClient, logger, getText],
  )

  if (IS_DEV_MODE) {
    // @ts-expect-error This is used exclusively for debugging.
    window.navigate = navigate
  }

  const [inputBindingsRaw] = useState(() => createBindings())

  useEffect(() => {
    const savedInputBindings = localStorage.get('inputBindings')
    if (savedInputBindings != null) {
      const filteredInputBindings = mapEntries(
        inputBindingsRaw.metadata,
        (k) => savedInputBindings[k],
      )
      for (const [bindingKey, newBindings] of unsafeEntries(filteredInputBindings)) {
        for (const oldBinding of inputBindingsRaw.metadata[bindingKey].bindings) {
          inputBindingsRaw.delete(bindingKey, oldBinding)
        }
        for (const newBinding of newBindings ?? []) {
          inputBindingsRaw.add(bindingKey, newBinding)
        }
      }
    }
  }, [localStorage, inputBindingsRaw])

  const inputBindings = useMemo(() => {
    const updateLocalStorage = () => {
      localStorage.set(
        'inputBindings',
        Object.fromEntries(
          Object.entries(inputBindingsRaw.metadata).map((kv) => {
            const [k, v] = kv
            return [k, v.bindings]
          }),
        ),
      )
    }
    return {
      /** Transparently pass through `handler()`. */
      get handler() {
        return inputBindingsRaw.handler.bind(inputBindingsRaw)
      },
      /** Transparently pass through `attach()`. */
      get attach() {
        return inputBindingsRaw.attach.bind(inputBindingsRaw)
      },
      reset: (bindingKey: DashboardBindingKey) => {
        inputBindingsRaw.reset(bindingKey)
        updateLocalStorage()
      },
      add: (bindingKey: DashboardBindingKey, binding: string) => {
        inputBindingsRaw.add(bindingKey, binding)
        updateLocalStorage()
      },
      delete: (bindingKey: DashboardBindingKey, binding: string) => {
        inputBindingsRaw.delete(bindingKey, binding)
        updateLocalStorage()
      },
      /** Transparently pass through `metadata`. */
      get metadata() {
        return inputBindingsRaw.metadata
      },
      /** Transparently pass through `register()`. */
      get register() {
        return inputBindingsRaw.unregister.bind(inputBindingsRaw)
      },
      /** Transparently pass through `unregister()`. */
      get unregister() {
        return inputBindingsRaw.unregister.bind(inputBindingsRaw)
      },
    }
  }, [localStorage, inputBindingsRaw])

  const mainPageUrl = getMainPageUrl()

  // Subscribe to `localStorage` updates to trigger a rerender when the terms of service
  // or privacy policy have been accepted.
  useLocalStorageState('termsOfService')
  useLocalStorageState('privacyPolicy')

  const authService = useInitAuthService(props)

  const userSession = authService.cognito.userSession.bind(authService.cognito)
  const refreshUserSession = authService.cognito.refreshUserSession.bind(authService.cognito)
  const registerAuthEventListener = authService.registerAuthEventListener

  useEffect(() => {
    if ('menuApi' in window) {
      window.menuApi.setShowAboutModalHandler(() => {
        setModal(<AboutModal />)
      })
    }
  }, [setModal])

  useEffect(() => {
    const onKeyDown = navigator2D.onKeyDown.bind(navigator2D)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [navigator2D])

  useEffect(() => {
    let isClick = false
    const onMouseDown = () => {
      isClick = true
    }
    const onMouseUp = (event: MouseEvent) => {
      if (
        isClick &&
        !isElementTextInput(event.target) &&
        !isElementPartOfMonaco(event.target) &&
        !isElementTextInput(document.activeElement)
      ) {
        const selection = document.getSelection()
        const app = document.getElementById('app')
        const appContainsSelection =
          app != null &&
          selection != null &&
          selection.anchorNode != null &&
          app.contains(selection.anchorNode) &&
          selection.focusNode != null &&
          app.contains(selection.focusNode)
        if (!appContainsSelection) {
          selection?.removeAllRanges()
        }
      }
    }
    const onSelectStart = () => {
      isClick = false
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('selectstart', onSelectStart)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('selectstart', onSelectStart)
    }
  }, [])

  const routes = (
    <Routes>
      {/* Login & registration pages are visible to unauthenticated users. */}
      <Route element={<GuestLayout />}>
        <Route path={REGISTRATION_PATH} element={<Registration />} />
        <Route path={LOGIN_PATH} element={<Login />} />
      </Route>

      {/* Protected pages are visible to authenticated users. */}
      <Route element={<NotDeletedUserLayout />}>
        <Route element={<ProtectedLayout />}>
          <Route element={<AgreementsModal />}>
            <Route element={<SetupOrganizationAfterSubscribe />}>
              <Route element={<InvitedToOrganizationModal />}>
                <Route element={<OpenAppWatcher />}>
                  <Route
                    path={DASHBOARD_PATH}
                    element={shouldShowDashboard && <Dashboard {...props} />}
                  />

                  <Route
                    path={SUBSCRIBE_PATH}
                    element={
                      <ErrorBoundary>
                        <Suspense>
                          <Subscribe />
                        </Suspense>
                      </ErrorBoundary>
                    }
                  />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route
            path={SUBSCRIBE_SUCCESS_PATH}
            element={
              <ErrorBoundary>
                <Suspense>
                  <SubscribeSuccess />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>
      </Route>

      <Route element={<AgreementsModal />}>
        <Route element={<NotDeletedUserLayout />}>
          <Route path={SETUP_PATH} element={<Setup />} />
        </Route>
      </Route>

      {/* Other pages are visible to unauthenticated and authenticated users. */}
      <Route path={CONFIRM_REGISTRATION_PATH} element={<ConfirmRegistration />} />
      <Route path={FORGOT_PASSWORD_PATH} element={<ForgotPassword />} />
      <Route path={RESET_PASSWORD_PATH} element={<ResetPassword />} />

      {/* Soft-deleted user pages are visible to users who have been soft-deleted. */}
      <Route element={<ProtectedLayout />}>
        <Route element={<SoftDeletedUserLayout />}>
          <Route path={RESTORE_USER_PATH} element={<RestoreAccount />} />
        </Route>
      </Route>

      {/* 404 page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  return (
    <FeatureFlagsProvider>
      <RouterProvider navigate={navigate}>
        <SessionProvider
          saveAccessToken={authService.cognito.saveAccessToken.bind(authService.cognito)}
          mainPageUrl={mainPageUrl}
          userSession={userSession}
          registerAuthEventListener={registerAuthEventListener}
          refreshUserSession={refreshUserSession}
        >
          <BackendProvider remoteBackend={remoteBackend} localBackend={localBackend}>
            <AuthProvider
              shouldStartInOfflineMode={isAuthenticationDisabled}
              authService={authService}
              onAuthenticated={onAuthenticated}
            >
              <InputBindingsProvider inputBindings={inputBindings}>
                {/* Ideally this would be in `Drive.tsx`, but it currently must be all the way out here
                 * due to modals being in `TheModal`. */}
                <DriveProvider>
                  <LocalBackendPathSynchronizer />
                  <VersionChecker />
                  {routes}
                  <Suspense>
                    <ErrorBoundary>
                      <EnsoDevtools />
                    </ErrorBoundary>
                  </Suspense>
                </DriveProvider>
              </InputBindingsProvider>
            </AuthProvider>
          </BackendProvider>
        </SessionProvider>
      </RouterProvider>
    </FeatureFlagsProvider>
  )
}

// ====================================
// === LocalBackendPathSynchronizer ===
// ====================================

/** Keep `localBackend.rootPath` in sync with the saved root path state. */
function LocalBackendPathSynchronizer() {
  const [localRootDirectory] = useLocalStorageState('localRootDirectory')
  const localBackend = useLocalBackend()
  if (localBackend) {
    if (localRootDirectory != null) {
      localBackend.setRootPath(Path(localRootDirectory))
    } else {
      localBackend.resetRootPath()
    }
  }
  return null
}
