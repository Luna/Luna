/** @file An interactive button indicating the status of a project. */
import * as React from 'react'

import * as reactQuery from '@tanstack/react-query'

import ArrowUpIcon from 'enso-assets/arrow_up.svg'
import PlayIcon from 'enso-assets/play.svg'
import StopIcon from 'enso-assets/stop.svg'

import * as authProvider from '#/providers/AuthProvider'
import * as textProvider from '#/providers/TextProvider'

import * as dashboard from '#/pages/dashboard/Dashboard'

import * as ariaComponents from '#/components/AriaComponents'
import Spinner from '#/components/Spinner'
import StatelessSpinner, * as spinner from '#/components/StatelessSpinner'

import * as backendModule from '#/services/Backend'
import type Backend from '#/services/Backend'

import * as tailwindMerge from '#/utilities/tailwindMerge'

// =================
// === Constants ===
// =================

/** The corresponding {@link spinner.SpinnerState} for each {@link backendModule.ProjectState},
 * when using the remote backend. */
const REMOTE_SPINNER_STATE: Readonly<Record<backendModule.ProjectState, spinner.SpinnerState>> = {
  [backendModule.ProjectState.closed]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.closing]: spinner.SpinnerState.loadingMedium,
  [backendModule.ProjectState.created]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.new]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.placeholder]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.openInProgress]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.provisioned]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.scheduled]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.opened]: spinner.SpinnerState.done,
}
/** The corresponding {@link spinner.SpinnerState} for each {@link backendModule.ProjectState},
 * when using the local backend. */
const LOCAL_SPINNER_STATE: Readonly<Record<backendModule.ProjectState, spinner.SpinnerState>> = {
  [backendModule.ProjectState.closed]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.closing]: spinner.SpinnerState.loadingMedium,
  [backendModule.ProjectState.created]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.new]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.placeholder]: spinner.SpinnerState.loadingMedium,
  [backendModule.ProjectState.openInProgress]: spinner.SpinnerState.loadingSlow,
  [backendModule.ProjectState.provisioned]: spinner.SpinnerState.loadingMedium,
  [backendModule.ProjectState.scheduled]: spinner.SpinnerState.loadingMedium,
  [backendModule.ProjectState.opened]: spinner.SpinnerState.done,
}

// ===================
// === ProjectIcon ===
// ===================

/** Props for a {@link ProjectIcon}. */
export interface ProjectIconProps {
  readonly backend: Backend
  readonly isOpened: boolean
  readonly item: backendModule.ProjectAsset
  readonly doOpenProject: (id: backendModule.ProjectId, runInBackground: boolean) => void
  readonly doCloseProject: (id: backendModule.ProjectId) => void
  readonly openProjectTab: (projectId: backendModule.ProjectId) => void
}

/** An interactive icon indicating the status of a project. */
export default function ProjectIcon(props: ProjectIconProps) {
  const { backend, item, isOpened } = props
  const { openProjectTab, doOpenProject, doCloseProject } = props

  const { user } = authProvider.useNonPartialUserSession()
  const { getText } = textProvider.useText()

  const isRunningInBackground = item.projectState.executeAsync ?? false
  const {
    data: status,
    isLoading,
    isError,
  } = reactQuery.useQuery({
    ...dashboard.createGetProjectDetailsQuery.createPassiveListener(item.id),
    select: data => data.state.type,
    enabled: isOpened,
  })

  const isCloud = backend.type === backendModule.BackendType.remote

  const isOtherUserUsingProject =
    isCloud && item.projectState.openedBy != null && item.projectState.openedBy !== user.email

  const state = (() => {
    // Project is closed, show open button
    if (!isOpened) {
      return backendModule.ProjectState.closed
    } else if (!isLoading && status == null) {
      // Project is opened, but not yet queried.
      return backendModule.ProjectState.openInProgress
    } else if (isLoading) {
      return backendModule.ProjectState.openInProgress
    } else if (status == null) {
      return backendModule.ProjectState.openInProgress
    } else if (status === backendModule.ProjectState.closed) {
      // Project is opened locally, but not on the backend yet.
      return backendModule.ProjectState.openInProgress
    } else {
      return status
    }
  })()

  const spinnerState = (() => {
    if (!isOpened) {
      return spinner.SpinnerState.initial
    } else if (isLoading) {
      return spinner.SpinnerState.loadingSlow
    } else if (isError) {
      return spinner.SpinnerState.initial
    } else if (status == null) {
      return spinner.SpinnerState.loadingSlow
    } else {
      return backend.type === backendModule.BackendType.remote
        ? REMOTE_SPINNER_STATE[status]
        : LOCAL_SPINNER_STATE[status]
    }
  })()

  switch (state) {
    case null:
    case backendModule.ProjectState.created:
    case backendModule.ProjectState.new:
    case backendModule.ProjectState.closing:
    case backendModule.ProjectState.closed:
      return (
        <ariaComponents.Button
          size="custom"
          variant="icon"
          icon={PlayIcon}
          aria-label={getText('openInEditor')}
          tooltipPlacement="left"
          extraClickZone="xsmall"
          onPress={() => {
            doOpenProject(item.id, false)
          }}
        />
      )
    case backendModule.ProjectState.openInProgress:
    case backendModule.ProjectState.scheduled:
    case backendModule.ProjectState.provisioned:
    case backendModule.ProjectState.placeholder:
      return (
        <div className="relative flex">
          <ariaComponents.Button
            size="large"
            variant="icon"
            extraClickZone="xsmall"
            isDisabled={isOtherUserUsingProject}
            icon={StopIcon}
            aria-label={getText('stopExecution')}
            tooltipPlacement="left"
            className={tailwindMerge.twJoin(isRunningInBackground && 'text-green')}
            {...(isOtherUserUsingProject ? { title: getText('otherUserIsUsingProjectError') } : {})}
            onPress={() => {
              doCloseProject(item.id)
            }}
          />
          <StatelessSpinner
            state={spinnerState}
            className={tailwindMerge.twMerge(
              'pointer-events-none absolute inset-0',
              isRunningInBackground && 'text-green'
            )}
          />
        </div>
      )
    case backendModule.ProjectState.opened:
      return (
        <div className="flex flex-row gap-0.5">
          <div className="relative flex">
            <ariaComponents.Button
              size="large"
              variant="icon"
              extraClickZone="xsmall"
              isDisabled={isOtherUserUsingProject}
              icon={StopIcon}
              aria-label={getText('stopExecution')}
              tooltipPlacement="left"
              tooltip={isOtherUserUsingProject ? getText('otherUserIsUsingProjectError') : null}
              className={tailwindMerge.twMerge(isRunningInBackground && 'text-green')}
              onPress={() => {
                doCloseProject(item.id)
              }}
            />
            <Spinner
              state={spinner.SpinnerState.done}
              className={tailwindMerge.twMerge(
                'pointer-events-none absolute inset-0',
                isRunningInBackground && 'text-green'
              )}
            />
          </div>

          {!isOtherUserUsingProject && !isRunningInBackground && (
            <ariaComponents.Button
              size="large"
              variant="icon"
              extraClickZone="xsmall"
              icon={ArrowUpIcon}
              aria-label={getText('openInEditor')}
              tooltipPlacement="right"
              onPress={() => {
                openProjectTab(item.id)
              }}
            />
          )}
        </div>
      )
  }
}
