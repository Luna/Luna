/**
 * @file The React provider for the project manager `Backend`, along with hooks to use the
 * provider via the shared React context.
 */
import * as React from 'react'

import invariant from 'tiny-invariant'

import { BackendType } from '@common/services/Backend'
import * as common from 'enso-common'

import { type Category, isCloudCategory } from '#/layouts/CategorySwitcher/Category'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import type LocalBackend from '@common/services/LocalBackend'
import { ProjectManagerEvents } from '@common/services/ProjectManager'
import type RemoteBackend from '@common/services/RemoteBackend'

/** State contained in a `BackendContext`. */
export interface BackendContextType {
  readonly remoteBackend: RemoteBackend | null
  readonly localBackend: LocalBackend | null
}

const BackendContext = React.createContext<BackendContextType>({
  remoteBackend: null,
  localBackend: null,
})

/** State contained in a `ProjectManagerContext`. */
export interface ProjectManagerContextType {
  readonly didLoadingProjectManagerFail: boolean
  readonly reconnectToProjectManager: () => void
}

const ProjectManagerContext = React.createContext<ProjectManagerContextType>({
  didLoadingProjectManagerFail: false,
  reconnectToProjectManager: () => {},
})

/** Props for a {@link BackendProvider}. */
export interface BackendProviderProps extends Readonly<React.PropsWithChildren> {
  readonly remoteBackend: RemoteBackend | null
  readonly localBackend: LocalBackend | null
}

/** A React Provider that lets components get and set the current backend. */
export default function BackendProvider(props: BackendProviderProps) {
  const { remoteBackend, localBackend, children } = props
  const [didLoadingProjectManagerFail, setDidLoadingProjectManagerFail] = React.useState(false)

  React.useEffect(() => {
    const onProjectManagerLoadingFailed = () => {
      setDidLoadingProjectManagerFail(true)
    }

    document.addEventListener(ProjectManagerEvents.loadingFailed, onProjectManagerLoadingFailed)
    return () => {
      document.removeEventListener(
        ProjectManagerEvents.loadingFailed,
        onProjectManagerLoadingFailed,
      )
    }
  }, [])

  const reconnectToProjectManager = useEventCallback(() => {
    setDidLoadingProjectManagerFail(false)
    void localBackend?.reconnectProjectManager()
  })

  return (
    <BackendContext.Provider value={{ remoteBackend, localBackend }}>
      <ProjectManagerContext.Provider
        value={{ didLoadingProjectManagerFail, reconnectToProjectManager }}
      >
        {children}
      </ProjectManagerContext.Provider>
    </BackendContext.Provider>
  )
}

/**
 * Get the Remote Backend.
 * @throws {Error} when no Remote Backend exists. This should never happen.
 */
export function useRemoteBackend() {
  const remoteBackend = React.useContext(BackendContext).remoteBackend
  if (remoteBackend == null) {
    throw new Error('This component requires a Cloud Backend to function.')
  }
  return remoteBackend
}

/** Get the Local Backend. */
export function useLocalBackend() {
  return React.useContext(BackendContext).localBackend
}

/**
 * Get the corresponding backend for the given property.
 * @throws {Error} when neither the Remote Backend nor the Local Backend are supported.
 * This should never happen unless the build is misconfigured.
 */
export function useBackend(category: Category) {
  const remoteBackend = useRemoteBackend()
  const localBackend = useLocalBackend()

  if (isCloudCategory(category)) {
    return remoteBackend
  } else {
    invariant(
      localBackend != null,
      `This distribution of ${common.PRODUCT_NAME} does not support the Local Backend.`,
    )
    return localBackend
  }
}

/**
 * Get the backend for the given project type.
 * @throws {Error} when a Local Backend is requested for a non-local project.
 */
export function useBackendForProjectType(projectType: BackendType) {
  const remoteBackend = useRemoteBackend()
  const localBackend = useLocalBackend()

  switch (projectType) {
    case BackendType.remote:
      return remoteBackend
    case BackendType.local:
      invariant(
        localBackend,
        'Attempted to get a local backend for local project, but no local backend was provided.',
      )
      return localBackend
  }
}

/** Whether connecting to the Project Manager failed. */
export function useDidLoadingProjectManagerFail() {
  return React.useContext(ProjectManagerContext).didLoadingProjectManagerFail
}

/** Reconnect to the Project Manager. */
export function useReconnectToProjectManager() {
  return React.useContext(ProjectManagerContext).reconnectToProjectManager
}
