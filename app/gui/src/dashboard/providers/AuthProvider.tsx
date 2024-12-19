/**
 * @file Module for authenticating users with AWS Cognito.
 *
 * Provides an `AuthProvider` component that wraps the entire application, and a `useAuth` hook that
 * can be used from any React component to access the currently logged-in user's session data. The
 * hook also provides methods for registering a user, logging in, logging out, etc.
 */
import { createContext, useCallback, useContext, useEffect, useId, type ReactNode } from 'react'

import { setUser as sentrySetUser } from '@sentry/react'
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type QueryKey,
  type QueryObserverResult,
  type RefetchOptions,
} from '@tanstack/react-query'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import invariant from 'tiny-invariant'

import {
  EmailAddress,
  NotAuthorizedError,
  OrganizationId,
  type CreateUserRequestBody,
  type UpdateUserRequestBody,
  type User,
} from '@common/services/Backend'
import { architecture, platform } from '@common/utilities/detect'
import { UnreachableCaseError } from '@common/utilities/error'
import { event, gtag } from '@common/utilities/gtag'

import { DASHBOARD_PATH, LOGIN_PATH, RESTORE_USER_PATH, SETUP_PATH } from '#/appUtils'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { gtagOpenCloseCallback } from '#/hooks/gtagHooks'

import { useRemoteBackend } from '#/providers/BackendProvider'
import { useLocalStorage } from '#/providers/LocalStorageProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { useSession } from '#/providers/SessionProvider'
import { useText } from '#/providers/TextProvider'

import { Dialog } from '#/components/AriaComponents'
import { Result } from '#/components/Result'

import type { RemoteBackend } from '@common/services/RemoteBackend'

import {
  CognitoErrorType,
  type Cognito,
  type CognitoUser,
  type UserSession as CognitoUserSession,
  type UserSessionChallenge,
} from '#/authentication/cognito'
import type { AuthService } from '#/authentication/service'
import { unsafeWriteValue } from '#/utilities/write'

/** Possible types of {@link BaseUserSession}. */
export enum UserSessionType {
  offline = 'offline',
  partial = 'partial',
  full = 'full',
}

/** Properties common to all {@link UserSession}s. */
interface BaseUserSession extends CognitoUserSession {
  /** A discriminator for TypeScript to be able to disambiguate between `UserSession` variants. */
  readonly type: UserSessionType
}

/**
 * Object containing the currently signed-in user's session data, if the user has not yet set their
 * username.
 *
 * If a user has not yet set their username, they do not yet have an organization associated with
 * their account. Otherwise, this type is identical to the `Session` type. This type should ONLY be
 * used by the `SetUsername` component.
 */
export interface PartialUserSession extends BaseUserSession {
  readonly type: UserSessionType.partial
}

/** Object containing the currently signed-in user's session data. */
export interface FullUserSession extends BaseUserSession {
  /** User's organization information. */
  readonly type: UserSessionType.full
  readonly user: User
}

/**
 * A user session for a user that may be either fully registered,
 * or in the process of registering.
 */
export type UserSession = FullUserSession | PartialUserSession

/**
 * Interface returned by the `useAuth` hook.
 *
 * Contains the currently authenticated user's session data, as well as methods for signing in,
 * signing out, etc. All interactions with the authentication API should be done through this
 * interface.
 *
 * See `Cognito` for details on each of the authentication functions.
 */
interface AuthContextType {
  readonly signUp: (email: string, password: string, organizationId: string | null) => Promise<void>
  readonly authQueryKey: QueryKey
  readonly confirmSignUp: (email: string, code: string) => Promise<void>
  readonly setUsername: (username: string) => Promise<boolean>
  readonly signInWithGoogle: () => Promise<boolean>
  readonly signInWithGitHub: () => Promise<boolean>
  readonly signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{
    readonly challenge: UserSessionChallenge
    readonly user: CognitoUser
  }>
  readonly forgotPassword: (email: string) => Promise<void>
  readonly changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>
  readonly resetPassword: (email: string, code: string, password: string) => Promise<void>
  readonly signOut: () => Promise<void>
  /** @deprecated Never use this function. Prefer particular functions like `setUsername` or `deleteUser`. */
  readonly setUser: (user: Partial<User>) => void
  readonly deleteUser: () => Promise<boolean>
  readonly restoreUser: () => Promise<boolean>
  readonly refetchSession: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<UserSession | null>>
  /**
   * Session containing the currently authenticated user's authentication information.
   *
   * If the user has not signed in, the session will be `null`.
   */
  readonly session: UserSession | null
  /** Return `true` if the user is marked for deletion. */
  readonly isUserMarkedForDeletion: () => boolean
  /** Return `true` if the user is deleted completely. */
  readonly isUserDeleted: () => boolean
  /** Return `true` if the user is soft deleted. */
  readonly isUserSoftDeleted: () => boolean
  readonly cognito: Cognito
}

const AuthContext = createContext<AuthContextType | null>(null)

/** Query to fetch the user's session data from the backend. */
function createUsersMeQuery(
  session: CognitoUserSession | null,
  remoteBackend: RemoteBackend,
  performLogout: () => Promise<void>,
) {
  return queryOptions({
    queryKey: [remoteBackend.type, 'usersMe', session?.clientId] as const,
    queryFn: async () => {
      if (session == null) {
        return Promise.resolve(null)
      }

      return remoteBackend
        .usersMe()
        .then((user) => {
          return user == null ?
              ({ type: UserSessionType.partial, ...session } satisfies PartialUserSession)
            : ({ type: UserSessionType.full, user, ...session } satisfies FullUserSession)
        })
        .catch((error) => {
          if (error instanceof NotAuthorizedError) {
            return performLogout().then(() => null)
          }

          throw error
        })
    },
  })
}

/** Props for an {@link AuthProvider}. */
export interface AuthProviderProps {
  readonly shouldStartInOfflineMode: boolean
  readonly authService: AuthService
  /** Callback to execute once the user has authenticated successfully. */
  readonly onAuthenticated: (accessToken: string | null) => void
  readonly children: ReactNode
}

/** A React provider for the Cognito API. */
export default function AuthProvider(props: AuthProviderProps) {
  const { authService, onAuthenticated } = props
  const { children } = props
  const remoteBackend = useRemoteBackend()
  const { cognito } = authService
  const { session, sessionQueryKey } = useSession()
  const { localStorage } = useLocalStorage()
  const { getText } = useText()
  const { unsetModal } = useSetModal()
  const navigate = useNavigate()
  const toastId = useId()

  const queryClient = useQueryClient()

  // This component cannot use `useGtagEvent` because `useGtagEvent` depends on the React Context
  // defined by this component.
  const gtagEvent = useCallback((name: string, params?: object) => {
    event(name, params)
  }, [])

  const performLogout = useEventCallback(async () => {
    await cognito.signOut()

    const parentDomain = location.hostname.replace(/^[^.]*\./, '')
    unsafeWriteValue(document, 'cookie', `logged_in=no;max-age=0;domain=${parentDomain}`)
    gtagEvent('cloud_sign_out')
    cognito.saveAccessToken(null)
    localStorage.clearUserSpecificEntries()
    sentrySetUser(null)

    await queryClient.invalidateQueries({ queryKey: sessionQueryKey })
    await queryClient.clearWithPersister()

    return Promise.resolve()
  })

  const logoutMutation = useMutation({
    mutationKey: [remoteBackend.type, 'usersMe', 'logout', session?.clientId] as const,
    mutationFn: performLogout,
    // If the User Menu is still visible, it breaks when `userSession` is set to `null`.
    onMutate: unsetModal,
    onSuccess: () => toast.success(getText('signOutSuccess')),
    onError: () => toast.error(getText('signOutError')),
    meta: { invalidates: [sessionQueryKey], awaitInvalidates: true },
  })

  const usersMeQueryOptions = createUsersMeQuery(session, remoteBackend, async () => {
    await performLogout()
    toast.info(getText('userNotAuthorizedError'))
  })

  const usersMeQuery = useSuspenseQuery(usersMeQueryOptions)
  const userData = usersMeQuery.data

  const createUserMutation = useMutation({
    mutationFn: (user: CreateUserRequestBody) => remoteBackend.createUser(user),
    meta: { invalidates: [usersMeQueryOptions.queryKey], awaitInvalidates: true },
  })

  const deleteUserMutation = useMutation({
    mutationFn: () => remoteBackend.deleteUser(),
    meta: { invalidates: [usersMeQueryOptions.queryKey], awaitInvalidates: true },
  })

  const restoreUserMutation = useMutation({
    mutationFn: () => remoteBackend.restoreUser(),
    meta: { invalidates: [usersMeQueryOptions.queryKey], awaitInvalidates: true },
  })

  const updateUserMutation = useMutation({
    mutationFn: (user: UpdateUserRequestBody) => remoteBackend.updateUser(user),
    meta: { invalidates: [usersMeQueryOptions.queryKey], awaitInvalidates: true },
  })

  const toastSuccess = (message: string) => {
    toast.update(toastId, {
      isLoading: null,
      autoClose: null,
      closeOnClick: null,
      closeButton: null,
      draggable: null,
      type: toast.TYPE.SUCCESS,
      render: message,
    })
  }

  const signUp = useEventCallback(
    async (username: string, password: string, organizationId: string | null) => {
      gtagEvent('cloud_sign_up')
      const result = await cognito.signUp(username, password, organizationId)

      if (result.err) {
        throw new Error(result.val.message)
      } else {
        return
      }
    },
  )

  const confirmSignUp = useEventCallback(async (email: string, code: string) => {
    gtagEvent('cloud_confirm_sign_up')
    const result = await cognito.confirmSignUp(email, code)

    if (result.err) {
      switch (result.val.type) {
        case CognitoErrorType.userAlreadyConfirmed:
        case CognitoErrorType.userNotFound: {
          return
        }
        default: {
          throw new UnreachableCaseError(result.val.type)
        }
      }
    }
  })

  const signInWithPassword = useEventCallback(async (email: string, password: string) => {
    gtagEvent('cloud_sign_in', { provider: 'Email' })

    const result = await cognito.signInWithPassword(email, password)

    if (result.ok) {
      const user = result.unwrap()

      const challenge = user.challengeName ?? 'NO_CHALLENGE'

      if (['SMS_MFA', 'SOFTWARE_TOKEN_MFA'].includes(challenge)) {
        return { challenge, user } as const
      }

      return queryClient
        .invalidateQueries({ queryKey: sessionQueryKey })
        .then(() => ({ challenge, user }) as const)
    } else {
      throw new Error(result.val.message)
    }
  })

  const refetchSession = usersMeQuery.refetch

  const setUsername = useEventCallback(async (username: string) => {
    gtagEvent('cloud_user_created')

    if (userData?.type === UserSessionType.full) {
      await updateUserMutation.mutateAsync({ username })
    } else {
      const organizationId = await cognito.organizationId()
      const email = session?.email ?? ''

      await createUserMutation.mutateAsync({
        userName: username,
        userEmail: EmailAddress(email),
        organizationId: organizationId != null ? OrganizationId(organizationId) : null,
      })
    }
    // Wait until the backend returns a value from `users/me`,
    // otherwise the rest of the steps are skipped.
    // This only happens on specific devices, and (seemingly) only when using
    // the Vite development server, not with the built application bundle.
    // i.e. PROD=1
    await refetchSession()

    return true
  })

  const deleteUser = useEventCallback(async () => {
    await deleteUserMutation.mutateAsync()

    toastSuccess(getText('deleteUserSuccess'))

    return true
  })

  const restoreUser = useEventCallback(async () => {
    await restoreUserMutation.mutateAsync()

    toastSuccess(getText('restoreUserSuccess'))

    return true
  })

  /**
   * Update the user session data in the React Query cache.
   * This only works for full user sessions.
   * @deprecated Never use this function. Prefer particular functions like `setUsername` or `deleteUser`.
   */
  const setUser = useEventCallback((user: Partial<User>) => {
    const currentUser = queryClient.getQueryData(usersMeQueryOptions.queryKey)

    if (currentUser != null && currentUser.type === UserSessionType.full) {
      const currentUserData = currentUser.user
      const nextUserData: User = Object.assign(currentUserData, user)

      queryClient.setQueryData(usersMeQueryOptions.queryKey, { ...currentUser, user: nextUserData })
    }
  })

  const forgotPassword = useEventCallback(async (email: string) => {
    const result = await cognito.forgotPassword(email)
    if (result.ok) {
      navigate(LOGIN_PATH)
      return
    } else {
      throw new Error(result.val.message)
    }
  })

  const resetPassword = useEventCallback(async (email: string, code: string, password: string) => {
    const result = await cognito.forgotPasswordSubmit(email, code, password)

    if (result.ok) {
      navigate(LOGIN_PATH)
      return
    } else {
      throw new Error(result.val.message)
    }
  })

  const changePassword = useEventCallback(async (oldPassword: string, newPassword: string) => {
    const result = await cognito.changePassword(oldPassword, newPassword)

    if (result.err) {
      throw new Error(result.val.message)
    }

    return result.ok
  })

  const isUserMarkedForDeletion = useEventCallback(
    () => !!(userData && 'user' in userData && userData.user.removeAt),
  )

  const isUserDeleted = useEventCallback(() => {
    if (userData && 'user' in userData && userData.user.removeAt) {
      const removeAtDate = new Date(userData.user.removeAt)
      const now = new Date()

      return removeAtDate <= now
    } else {
      return false
    }
  })

  const isUserSoftDeleted = useEventCallback(() => {
    if (userData && 'user' in userData && userData.user.removeAt) {
      const removeAtDate = new Date(userData.user.removeAt)
      const now = new Date()

      return removeAtDate > now
    } else {
      return false
    }
  })

  useEffect(() => {
    if (userData?.type === UserSessionType.full) {
      sentrySetUser({
        id: userData.user.userId,
        email: userData.email,
        username: userData.user.name,
        // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
        ip_address: '{{auto}}',
      })
    }
  }, [userData])

  useEffect(() => {
    if (userData?.type === UserSessionType.partial) {
      sentrySetUser({ email: userData.email })
    }
  }, [userData])

  useEffect(() => {
    gtag('set', { platform: platform(), architecture: architecture() })
    return gtagOpenCloseCallback(gtagEvent, 'open_app', 'close_app')
  }, [gtagEvent])

  useEffect(() => {
    if (userData?.type === UserSessionType.full) {
      onAuthenticated(userData.accessToken)
    }
  }, [userData, onAuthenticated])

  const value: AuthContextType = {
    signUp,
    confirmSignUp,
    setUsername,
    isUserMarkedForDeletion,
    isUserDeleted,
    isUserSoftDeleted,
    restoreUser,
    deleteUser,
    cognito,
    signInWithGoogle: useEventCallback(() => {
      gtagEvent('cloud_sign_in', { provider: 'Google' })

      return cognito
        .signInWithGoogle()
        .then(() => queryClient.invalidateQueries({ queryKey: sessionQueryKey }))
        .then(
          () => true,
          () => false,
        )
    }),
    signInWithGitHub: useEventCallback(() => {
      gtagEvent('cloud_sign_in', { provider: 'GitHub' })

      return cognito
        .signInWithGitHub()
        .then(() => queryClient.invalidateQueries({ queryKey: sessionQueryKey }))
        .then(
          () => true,
          () => false,
        )
    }),
    signInWithPassword,
    forgotPassword,
    resetPassword,
    changePassword,
    refetchSession,
    session: userData,
    signOut: logoutMutation.mutateAsync,
    setUser,
    authQueryKey: usersMeQueryOptions.queryKey,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}

      <Dialog
        aria-label={getText('loggingOut')}
        isDismissable={false}
        isKeyboardDismissDisabled
        hideCloseButton
        modalProps={{ isOpen: logoutMutation.isPending }}
      >
        <Result status="loading" title={getText('loggingOut')} />
      </Dialog>
    </AuthContext.Provider>
  )
}

/**
 * A React hook that provides access to the authentication context.
 *
 * Only the hook is exported, and not the context, because we only want to use the hook directly and
 * never the context component.
 * @throws {Error} when used outside a {@link AuthProvider}.
 */
export function useAuth() {
  const context = useContext(AuthContext)

  invariant(context != null, '`useAuth` must be used within an `<AuthProvider />`.')

  return context
}

/** A React Router layout route containing routes only accessible by users that are logged in. */
export function ProtectedLayout() {
  const { session } = useAuth()

  if (session == null) {
    return <Navigate to={LOGIN_PATH} />
  } else if (session.type === UserSessionType.partial) {
    return <Navigate to={SETUP_PATH} />
  } else {
    return (
      <>
        {/* This div is used as a flag to indicate that the dashboard has been loaded and the user is authenticated. */}
        {/* also it guarantees that the top-level suspense boundary is already resolved */}
        <div data-testid="after-auth-layout" aria-hidden />
        <Outlet context={session} />
      </>
    )
  }
}

/**
 * A React Router layout route containing routes only accessible by users that are
 * in the process of registering.
 */
export function SemiProtectedLayout() {
  const { session } = useAuth()
  const { localStorage } = useLocalStorage()

  // The user is not logged in - redirect to the login page.
  if (session == null) {
    return <Navigate to={LOGIN_PATH} replace />
    // User is registered, redirect to dashboard or to the redirect path specified during the registration / login.
  } else if (session.type === UserSessionType.full) {
    const redirectTo = localStorage.delete('loginRedirect') ?? DASHBOARD_PATH
    return <Navigate to={redirectTo} replace />
    // User is in the process of registration, allow them to complete the registration.
  } else {
    return <Outlet context={session} />
  }
}

/**
 * A React Router layout route containing routes only accessible by users that are
 * not logged in.
 */
export function GuestLayout() {
  const { session } = useAuth()
  const { localStorage } = useLocalStorage()

  if (session?.type === UserSessionType.partial) {
    return <Navigate to={SETUP_PATH} />
  } else if (session?.type === UserSessionType.full) {
    const redirectTo = localStorage.get('loginRedirect')
    if (redirectTo != null) {
      localStorage.delete('loginRedirect')
      location.href = redirectTo
      return
    } else {
      return <Navigate to={DASHBOARD_PATH} />
    }
  } else {
    return (
      <>
        {/* This div is used as a flag to indicate that the user is not logged in. */}
        {/* also it guarantees that the top-level suspense boundary is already resolved */}
        <div data-testid="before-auth-layout" aria-hidden />
        <Outlet />
      </>
    )
  }
}

/** A React Router layout route containing routes only accessible by users that are not deleted. */
export function NotDeletedUserLayout() {
  const { session, isUserMarkedForDeletion } = useAuth()

  if (isUserMarkedForDeletion()) {
    return <Navigate to={RESTORE_USER_PATH} />
  } else {
    return <Outlet context={session} />
  }
}

/** A React Router layout route containing routes only accessible by users that are deleted softly. */
export function SoftDeletedUserLayout() {
  const { session, isUserMarkedForDeletion, isUserDeleted, isUserSoftDeleted } = useAuth()

  if (isUserMarkedForDeletion()) {
    const isSoftDeleted = isUserSoftDeleted()
    const isDeleted = isUserDeleted()
    if (isSoftDeleted) {
      return <Outlet context={session} />
    } else if (isDeleted) {
      return <Navigate to={LOGIN_PATH} />
    } else {
      return <Navigate to={DASHBOARD_PATH} />
    }
  }
}

/**
 * A React context hook returning the user session
 * for a user that has not yet completed registration.
 */
export function usePartialUserSession() {
  const { session } = useAuth()

  invariant(session?.type === UserSessionType.partial, 'Expected a partial user session.')

  return session
}

/** A React context hook returning the user session for a user that may or may not be logged in. */
export function useUserSession() {
  return useAuth().session
}

/** A React context hook returning the user session for a user that is fully logged in. */
export function useFullUserSession(): FullUserSession {
  const { session } = useAuth()

  invariant(session?.type === UserSessionType.full, 'Expected a full user session.')

  return session
}
