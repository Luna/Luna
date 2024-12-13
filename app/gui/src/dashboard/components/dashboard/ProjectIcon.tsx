/** @file An interactive button indicating the status of a project. */
import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'

import {
  BackendType,
  ProjectState,
  type Backend,
  type ProjectAsset,
} from '@common/services/Backend'

import ArrowUpIcon from '#/assets/arrow_up.svg'
import PlayIcon from '#/assets/play.svg'
import StopIcon from '#/assets/stop.svg'
import { Button } from '#/components/AriaComponents'
import { Spinner } from '#/components/Spinner'
import { StatelessSpinner, type SpinnerState } from '#/components/StatelessSpinner'
import { useBackendQuery } from '#/hooks/backendHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import {
  createGetProjectDetailsQuery,
  useCanOpenProjects,
  useCloseProject,
  useOpenEditor,
  useOpenProject,
} from '#/hooks/projectHooks'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useText } from '#/providers/TextProvider'
import { twJoin, twMerge } from '#/utilities/tailwindMerge'

export const CLOSED_PROJECT_STATE = { type: ProjectState.closed } as const

/**
 * The corresponding {@link SpinnerState} for each {@link ProjectState},
 * when using the remote backend.
 */
const REMOTE_SPINNER_STATE: Readonly<Record<ProjectState, SpinnerState>> = {
  [ProjectState.closed]: 'loading-slow',
  [ProjectState.closing]: 'loading-medium',
  [ProjectState.created]: 'loading-slow',
  [ProjectState.new]: 'loading-slow',
  [ProjectState.placeholder]: 'loading-slow',
  [ProjectState.openInProgress]: 'loading-slow',
  [ProjectState.provisioned]: 'loading-slow',
  [ProjectState.scheduled]: 'loading-slow',
  [ProjectState.opened]: 'done',
}
/**
 * The corresponding {@link SpinnerState} for each {@link ProjectState},
 * when using the local backend.
 */
const LOCAL_SPINNER_STATE: Readonly<Record<ProjectState, SpinnerState>> = {
  [ProjectState.closed]: 'loading-slow',
  [ProjectState.closing]: 'loading-medium',
  [ProjectState.created]: 'loading-slow',
  [ProjectState.new]: 'loading-slow',
  [ProjectState.placeholder]: 'loading-medium',
  [ProjectState.openInProgress]: 'loading-slow',
  [ProjectState.provisioned]: 'loading-medium',
  [ProjectState.scheduled]: 'loading-medium',
  [ProjectState.opened]: 'done',
}

/** Props for a {@link ProjectIcon}. */
export interface ProjectIconProps {
  readonly isPlaceholder: boolean
  readonly backend: Backend
  readonly isDisabled: boolean
  readonly isOpened: boolean
  readonly item: ProjectAsset
}

/** An interactive icon indicating the status of a project. */
export default function ProjectIcon(props: ProjectIconProps) {
  const { backend, item, isOpened, isDisabled: isDisabledRaw, isPlaceholder } = props
  const isUnconditionallyDisabled = !useCanOpenProjects()
  const isDisabled = isDisabledRaw || isUnconditionallyDisabled

  const openProject = useOpenProject()
  const closeProject = useCloseProject()
  const openProjectTab = useOpenEditor()

  const { user } = useFullUserSession()
  const { getText } = useText()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const itemProjectState = item.projectState ?? CLOSED_PROJECT_STATE
  const { data: projectState, isError } = useQuery({
    ...createGetProjectDetailsQuery({
      assetId: item.id,
      parentId: item.parentId,
      backend,
    }),
    select: (data) => data.state,
    enabled: !isPlaceholder && isOpened && !isUnconditionallyDisabled,
  })

  const status = projectState?.type
  const isRunningInBackground = projectState?.executeAsync ?? false

  const isCloud = backend.type === BackendType.remote

  const isOtherUserUsingProject =
    isCloud && itemProjectState.openedBy != null && itemProjectState.openedBy !== user.email

  const { data: users } = useBackendQuery(backend, 'listUsers', [], {
    enabled: isOtherUserUsingProject,
  })

  const userOpeningProject = useMemo(
    () =>
      !isOtherUserUsingProject ? null : (
        users?.find((otherUser) => otherUser.email === itemProjectState.openedBy)
      ),
    [isOtherUserUsingProject, itemProjectState.openedBy, users],
  )

  const userOpeningProjectTooltip =
    userOpeningProject == null ? null : getText('xIsUsingTheProject', userOpeningProject.name)
  const disabledTooltip = isUnconditionallyDisabled ? getText('downloadToOpenWorkflow') : null

  const state = (() => {
    if (!isOpened && !isPlaceholder) {
      return ProjectState.closed
    }
    // Project is closed, show open button
    if (!isOpened) {
      return (projectState ?? itemProjectState).type
    }

    if (status == null) {
      // Project is opened, but not yet queried.
      return ProjectState.openInProgress
    }
    if (status === ProjectState.closed) {
      // Project is opened locally, but not on the backend yet.
      return ProjectState.openInProgress
    }
    return status
  })()

  const spinnerState = ((): SpinnerState => {
    if (!isOpened) {
      return 'loading-slow'
    } else if (isError) {
      return 'initial'
    } else if (status == null) {
      return 'loading-slow'
    } else {
      return backend.type === BackendType.remote ?
          REMOTE_SPINNER_STATE[status]
        : LOCAL_SPINNER_STATE[status]
    }
  })()

  const doOpenProject = useEventCallback(() => {
    openProject({ ...item, type: backend.type })
  })
  const doCloseProject = useEventCallback(() => {
    closeProject({ ...item, type: backend.type })
  })
  const doOpenProjectTab = useEventCallback(() => {
    openProjectTab(item.id)
  })

  switch (state) {
    case ProjectState.new:
    case ProjectState.closing:
    case ProjectState.closed:
    case ProjectState.created:
      return (
        <Button
          size="custom"
          variant="icon"
          icon={PlayIcon}
          aria-label={disabledTooltip ?? getText('openInEditor')}
          tooltipPlacement="left"
          extraClickZone="xsmall"
          isDisabled={isDisabled || projectState?.type === ProjectState.closing}
          onPress={doOpenProject}
        />
      )
    case ProjectState.openInProgress:
    case ProjectState.scheduled:
    case ProjectState.provisioned:
    case ProjectState.placeholder:
      return (
        <div className="relative flex">
          <Button
            size="large"
            variant="icon"
            extraClickZone="xsmall"
            isDisabled={isDisabled || isOtherUserUsingProject}
            icon={StopIcon}
            aria-label={userOpeningProjectTooltip ?? getText('stopExecution')}
            tooltipPlacement="left"
            className={twJoin(isRunningInBackground && 'text-green')}
            {...(isOtherUserUsingProject ? { title: getText('otherUserIsUsingProjectError') } : {})}
            onPress={doCloseProject}
          />
          <StatelessSpinner
            state={spinnerState}
            className={twJoin(
              'pointer-events-none absolute inset-0',
              isRunningInBackground && 'text-green',
            )}
          />
        </div>
      )
    case ProjectState.opened:
      return (
        <div className="flex flex-row gap-0.5">
          <div className="relative flex">
            <Button
              size="large"
              variant="icon"
              extraClickZone="xsmall"
              isDisabled={isDisabled || isOtherUserUsingProject}
              icon={StopIcon}
              aria-label={userOpeningProjectTooltip ?? getText('stopExecution')}
              tooltipPlacement="left"
              className={twJoin(isRunningInBackground && 'text-green')}
              onPress={doCloseProject}
            />
            <Spinner
              state="done"
              className={twMerge(
                'pointer-events-none absolute inset-0',
                isRunningInBackground && 'text-green',
              )}
            />
          </div>

          {!isOtherUserUsingProject && !isRunningInBackground && (
            <Button
              size="large"
              variant="icon"
              extraClickZone="xsmall"
              icon={ArrowUpIcon}
              aria-label={userOpeningProjectTooltip ?? getText('openInEditor')}
              isDisabled={isDisabled}
              tooltipPlacement="right"
              onPress={doOpenProjectTab}
            />
          )}
        </div>
      )
  }
}
