/** @file The container that launches the IDE. */
import * as React from 'react'

import * as reactQuery from '@tanstack/react-query'

import * as gtagHooks from '#/hooks/gtagHooks'
import * as projectHooks from '#/hooks/projectHooks'

import * as backendProvider from '#/providers/BackendProvider'
import type { LaunchedProject } from '#/providers/ProjectsProvider'
import * as textProvider from '#/providers/TextProvider'

import * as errorBoundary from '#/components/ErrorBoundary'
import * as suspense from '#/components/Suspense'

import * as backendModule from '#/services/Backend'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import * as twMerge from '#/utilities/tailwindMerge'
import { useTimeoutCallback } from '../hooks/timeoutHooks'

// eslint-disable-next-line no-restricted-syntax
import ProjectViewVue from '@/views/ProjectView.vue'
import { applyPureVueInReact } from 'veaury'
import type { AllowedComponentProps, VNodeProps } from 'vue'

// eslint-disable-next-line no-restricted-syntax
const ProjectView = applyPureVueInReact(ProjectViewVue) as (props: ProjectViewProps) => JSX.Element

// ========================
// === GraphEditorProps ===
// ========================

/** Props for the GUI editor root component. */
export type ProjectViewProps = Omit<
  InstanceType<typeof ProjectViewVue>['$props'],
  keyof AllowedComponentProps | keyof VNodeProps
>

// ==============
// === Editor ===
// ==============

/** Props for an {@link Editor}. */
export interface EditorProps {
  readonly isOpeningFailed: boolean
  readonly openingError: Error | null
  readonly startProject: (project: LaunchedProject) => void
  readonly project: LaunchedProject
  readonly hidden: boolean
  readonly ydocUrl: string | null
  readonly renameProject: (newName: string, projectId: backendModule.ProjectId) => void
  readonly projectId: backendModule.ProjectId
}

/** The container that launches the IDE. */
function Editor(props: EditorProps) {
  const { project, hidden, startProject, isOpeningFailed, openingError } = props

  const backend = backendProvider.useBackendForProjectType(project.type)

  const projectStatusQuery = projectHooks.createGetProjectDetailsQuery({
    assetId: project.id,
    parentId: project.parentId,
    backend,
  })

  const queryClient = reactQuery.useQueryClient()

  const projectQuery = reactQuery.useSuspenseQuery({
    ...projectStatusQuery,
    select: (data) => {
      const isOpeningProject = projectHooks.OPENING_PROJECT_STATES.has(data.state.type)
      const isProjectClosed = projectHooks.CLOSED_PROJECT_STATES.has(data.state.type)

      return { ...data, isOpeningProject, isProjectClosed }
    },
  })

  const isProjectClosed = projectQuery.data.isProjectClosed
  const isOpeningProject = projectQuery.data.isOpeningProject

  React.useEffect(() => {
    if (isProjectClosed) {
      startProject(project)
    }
  }, [isProjectClosed, startProject, project])

  useTimeoutCallback({
    callback: () => {
      const queryState = queryClient.getQueryCache().find({ queryKey: projectStatusQuery.queryKey })

      queryState?.setState({
        error: new Error('Timeout opening the project'),
        status: 'error',
      })
    },
    ms: projectHooks.getTimeoutBasedOnTheBackendType(backend.type),
    deps: [],
    isDisabled: !isOpeningProject || projectQuery.isError,
  })

  if (isOpeningFailed) {
    return (
      <errorBoundary.ErrorDisplay
        error={openingError}
        resetErrorBoundary={() => {
          if (isProjectClosed) {
            startProject(project)
          }
        }}
      />
    )
  }

  return (
    <div
      className={twMerge.twJoin('contents', hidden && 'hidden')}
      data-testvalue={project.id}
      data-testid="editor"
    >
      {(() => {
        switch (true) {
          case projectQuery.isError:
            return (
              <errorBoundary.ErrorDisplay
                error={projectQuery.error}
                resetErrorBoundary={() => projectQuery.refetch()}
              />
            )

          case isOpeningProject:
            return <suspense.Loader minHeight="full" />

          default:
            return (
              <errorBoundary.ErrorBoundary>
                <EditorInternal
                  {...props}
                  openedProject={projectQuery.data}
                  backendType={project.type}
                />
              </errorBoundary.ErrorBoundary>
            )
        }
      })()}
    </div>
  )
}

// ======================
// === EditorInternal ===
// ======================

/** Props for an {@link EditorInternal}. */
interface EditorInternalProps extends Omit<EditorProps, 'project'> {
  readonly openedProject: backendModule.Project
  readonly backendType: backendModule.BackendType
}

/** An internal editor. */
function EditorInternal(props: EditorInternalProps) {
  const { hidden, ydocUrl, renameProject, openedProject, backendType } = props

  const { getText } = textProvider.useText()
  const gtagEvent = gtagHooks.useGtagEvent()

  const localBackend = backendProvider.useLocalBackend()
  const remoteBackend = backendProvider.useRemoteBackend()

  React.useEffect(() => {
    if (!hidden) {
      return gtagHooks.gtagOpenCloseCallback(gtagEvent, 'open_workflow', 'close_workflow')
    }
  }, [hidden, gtagEvent])

  const onRenameProject = useEventCallback((newName: string) => {
    renameProject(newName, openedProject.projectId)
  })

  const appProps: ProjectViewProps = React.useMemo<ProjectViewProps>(() => {
    const jsonAddress = openedProject.jsonAddress
    const binaryAddress = openedProject.binaryAddress
    const ydocAddress = openedProject.ydocAddress ?? ydocUrl ?? ''
    const projectBackend =
      backendType === backendModule.BackendType.remote ? remoteBackend : localBackend

    if (jsonAddress == null) {
      throw new Error(getText('noJSONEndpointError'))
    } else if (binaryAddress == null) {
      throw new Error(getText('noBinaryEndpointError'))
    } else {
      return {
        projectId: openedProject.projectId,
        projectName: openedProject.packageName,
        projectDisplayedName: openedProject.name,
        engine: { rpcUrl: jsonAddress, dataUrl: binaryAddress, ydocUrl: ydocAddress },
        hidden,
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
    onRenameProject,
    backendType,
    localBackend,
    remoteBackend,
  ])

  // Currently the GUI component needs to be fully rerendered whenever the project is changed. Once
  // this is no longer necessary, the `key` could be removed.
  return <ProjectView key={appProps.projectId} {...appProps} />
}

export default React.memo(Editor)
