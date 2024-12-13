/** @file The container that launches the IDE. */
import { memo, useCallback, useEffect, useMemo, type ComponentType } from 'react'

import { useQuery } from '@tanstack/react-query'

import {
  BackendType,
  ProjectState,
  type Backend,
  type Project,
  type ProjectId,
} from '@common/services/Backend'

import { SEARCH_PARAMS_PREFIX } from '#/appUtils'
import { ErrorBoundary, ErrorDisplay } from '#/components/ErrorBoundary'
import { Loader, Suspense } from '#/components/Suspense'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { gtagOpenCloseCallback, useGtagEvent } from '#/hooks/gtagHooks'
import { createGetProjectDetailsQuery } from '#/hooks/projectHooks'
import {
  useBackendForProjectType,
  useLocalBackend,
  useRemoteBackend,
} from '#/providers/BackendProvider'
import type { LaunchedProject } from '#/providers/ProjectsProvider'
import { useText } from '#/providers/TextProvider'
import { twJoin } from '#/utilities/tailwindMerge'

/** A configuration in which values may be strings or nested configurations. */
interface StringConfig {
  readonly [key: string]: StringConfig | string
}

/** Props for the GUI editor root component. */
export interface GraphEditorProps {
  readonly config: StringConfig | null
  readonly projectId: string
  readonly hidden: boolean
  readonly ignoreParamsRegex?: RegExp
  readonly logEvent: (message: string, projectId?: string | null, metadata?: object | null) => void
  readonly renameProject: (newName: string) => void
  readonly projectBackend: Backend | null
  readonly remoteBackend: Backend | null
}

/**
 * The value passed from the entrypoint to the dashboard, which enables the dashboard to
 * open a new IDE instance.
 */
export type GraphEditorRunner = ComponentType<GraphEditorProps>

const IGNORE_PARAMS_REGEX = new RegExp(`^${SEARCH_PARAMS_PREFIX}(.+)$`)

/** Props for an {@link Editor}. */
export interface EditorProps {
  readonly isOpeningFailed: boolean
  readonly openingError: Error | null
  readonly startProject: (project: LaunchedProject) => void
  readonly project: LaunchedProject
  readonly hidden: boolean
  readonly ydocUrl: string | null
  readonly appRunner: GraphEditorRunner | null
  readonly renameProject: (newName: string, projectId: ProjectId) => void
  readonly projectId: ProjectId
}

/** The container that launches the IDE. */
function Editor(props: EditorProps) {
  const { project, hidden, startProject, isOpeningFailed, openingError } = props

  const backend = useBackendForProjectType(project.type)

  const projectStatusQuery = createGetProjectDetailsQuery({
    assetId: project.id,
    parentId: project.parentId,
    backend,
  })

  const projectQuery = useQuery(projectStatusQuery)

  const isProjectClosed = projectQuery.data?.state.type === ProjectState.closed

  useEffect(() => {
    if (isProjectClosed) {
      startProject(project)
    }
  }, [isProjectClosed, startProject, project])

  if (isOpeningFailed) {
    return (
      <ErrorDisplay
        error={openingError}
        resetErrorBoundary={() => {
          startProject(project)
        }}
      />
    )
  }

  return (
    <div
      className={twJoin('contents', hidden && 'hidden')}
      data-testvalue={project.id}
      data-testid="editor"
    >
      {(() => {
        switch (true) {
          case projectQuery.isError:
            return (
              <ErrorDisplay
                error={projectQuery.error}
                resetErrorBoundary={() => projectQuery.refetch()}
              />
            )

          case projectQuery.isLoading || projectQuery.data?.state.type !== ProjectState.opened:
            return <Loader minHeight="full" />

          default:
            return (
              <ErrorBoundary>
                <Suspense>
                  <EditorInternal
                    {...props}
                    openedProject={projectQuery.data}
                    backendType={project.type}
                  />
                </Suspense>
              </ErrorBoundary>
            )
        }
      })()}
    </div>
  )
}

/** Props for an {@link EditorInternal}. */
interface EditorInternalProps extends Omit<EditorProps, 'project'> {
  readonly openedProject: Project
  readonly backendType: BackendType
}

/** An internal editor. */
function EditorInternal(props: EditorInternalProps) {
  const { hidden, ydocUrl, appRunner: AppRunner, renameProject, openedProject, backendType } = props

  const { getText } = useText()
  const gtagEvent = useGtagEvent()

  const localBackend = useLocalBackend()
  const remoteBackend = useRemoteBackend()

  const logEvent = useCallback(
    (message: string, projectId?: string | null, metadata?: object | null) => {
      void remoteBackend.logEvent(message, projectId, metadata)
    },
    [remoteBackend],
  )

  useEffect(() => {
    if (hidden) {
      return
    } else {
      return gtagOpenCloseCallback(gtagEvent, 'open_workflow', 'close_workflow')
    }
  }, [hidden, gtagEvent])

  const onRenameProject = useEventCallback((newName: string) => {
    renameProject(newName, openedProject.projectId)
  })

  const appProps = useMemo<GraphEditorProps>(() => {
    const jsonAddress = openedProject.jsonAddress
    const binaryAddress = openedProject.binaryAddress
    const ydocAddress = openedProject.ydocAddress ?? ydocUrl ?? ''
    const projectBackend = backendType === BackendType.remote ? remoteBackend : localBackend

    if (jsonAddress == null) {
      throw new Error(getText('noJSONEndpointError'))
    } else if (binaryAddress == null) {
      throw new Error(getText('noBinaryEndpointError'))
    } else {
      return {
        config: {
          engine: { rpcUrl: jsonAddress, dataUrl: binaryAddress, ydocUrl: ydocAddress },
          startup: { project: openedProject.packageName, displayedProjectName: openedProject.name },
          window: { topBarOffset: '0' },
        },
        projectId: openedProject.projectId,
        hidden,
        ignoreParamsRegex: IGNORE_PARAMS_REGEX,
        logEvent,
        renameProject: onRenameProject,
        projectBackend,
        remoteBackend,
      }
    }
  }, [
    openedProject,
    ydocUrl,
    getText,
    hidden,
    logEvent,
    onRenameProject,
    backendType,
    localBackend,
    remoteBackend,
  ])

  // Currently the GUI component needs to be fully rerendered whenever the project is changed. Once
  // this is no longer necessary, the `key` could be removed.
  return AppRunner == null ? null : <AppRunner key={appProps.projectId} {...appProps} />
}

export default memo(Editor)
