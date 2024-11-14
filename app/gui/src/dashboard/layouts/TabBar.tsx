/** @file Switcher to choose the currently visible full-screen page. */
import * as React from 'react'

import * as reactQuery from '@tanstack/react-query'

import type * as text from 'enso-common/src/text'

import * as projectHooks from '#/hooks/projectHooks'

import type { LaunchedProject } from '#/providers/ProjectsProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import { StatelessSpinner } from '#/components/StatelessSpinner'
import SvgMask from '#/components/SvgMask'

import { AnimatedBackground } from '#/components/AnimatedBackground'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useBackendForProjectType } from '#/providers/BackendProvider'
import { useInputBindings } from '#/providers/InputBindingsProvider'
import { ProjectState } from '#/services/Backend'
import * as sanitizedEventTargets from '#/utilities/sanitizedEventTargets'
import * as tailwindMerge from '#/utilities/tailwindMerge'
import { motion } from 'framer-motion'

/** Props for a {@link TabBar}. */
export interface TabBarProps<T extends object> extends aria.TabListProps<T> {
  readonly className?: string
}

/** Switcher to choose the currently visible full-screen page. */
export default function TabBar<T extends object>(props: TabBarProps<T>) {
  return <TabBarInner<T> {...props} />
}

/**
 * Props for {@link TabBarInner}.
 */
interface TabBarInnerProps<T extends object> extends TabBarProps<T> {}

/**
 * Inner component for {@link TabBar}.
 */
function TabBarInner<T extends object>(props: TabBarInnerProps<T>) {
  const { className, ...rest } = props

  return (
    <AnimatedBackground>
      <div className={tailwindMerge.twMerge('relative flex grow', className)}>
        <aria.TabList<T> className="flex h-12 shrink-0 grow" {...rest} />
      </div>
    </AnimatedBackground>
  )
}

// ===========
// === Tab ===
// ===========

/** Props for a {@link Tab}. */
export interface TabProps extends Readonly<React.PropsWithChildren> {
  readonly 'data-testid'?: string
  readonly id: string
  readonly isActive: boolean
  readonly isHidden?: boolean
  readonly icon: React.ReactNode | string | null
  readonly labelId: text.TextId
  readonly onClose?: () => void
}

const UNDERLAY_ELEMENT = (
  <>
    <div className="h-full w-full rounded-t-4xl bg-dashboard" />
    <div className="absolute -left-6 bottom-0 aspect-square w-6 -rotate-90 [background:radial-gradient(circle_at_100%_0%,_transparent_70%,_var(--color-dashboard-background)_70%)]" />
    <div className="absolute -right-6 bottom-0 aspect-square w-6 -rotate-90 [background:radial-gradient(circle_at_100%_100%,_transparent_70%,_var(--color-dashboard-background)_70%)]" />
  </>
)

/** A tab in a {@link TabBar}. */
export function Tab(props: TabProps) {
  const { id, isActive, isHidden = false, icon, labelId, children, onClose } = props
  const { getText } = textProvider.useText()
  const inputBindings = useInputBindings()

  const stableOnClose = useEventCallback(() => {
    onClose?.()
  })

  React.useEffect(() => {
    if (isActive) {
      return inputBindings.attach(sanitizedEventTargets.document.body, 'keydown', {
        closeTab: stableOnClose,
      })
    }
  }, [inputBindings, isActive, stableOnClose])

  return (
    <aria.Tab
      data-testid={props['data-testid']}
      id={id}
      aria-label={getText(labelId)}
      className={tailwindMerge.twJoin(
        'relative',
        !isActive &&
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 [&.disabled]:cursor-not-allowed [&.disabled]:opacity-30',
        isHidden && 'hidden',
      )}
    >
      {({ isSelected, isHovered }) => (
        <AnimatedBackground.Item
          isSelected={isSelected}
          className="flex h-full w-full items-center justify-center gap-3 rounded-t-3xl pl-3.5 pr-4"
          underlayElement={UNDERLAY_ELEMENT}
        >
          <motion.div
            variants={{ active: { opacity: 1 }, inactive: { opacity: 0 } }}
            initial="inactive"
            animate={!isSelected && isHovered ? 'active' : 'inactive'}
            className="absolute inset-x-1 inset-y-2 rounded-3xl bg-dashboard transition-colors duration-300"
          />

          {typeof icon === 'string' ?
            <SvgMask src={icon} className={onClose && 'group-hover:hidden focus-visible:hidden'} />
          : icon}

          <ariaComponents.Text truncate="1" className="max-w-40">
            {children}
          </ariaComponents.Text>

          {onClose && (
            <div className="flex">
              <ariaComponents.CloseButton onPress={onClose} />
            </div>
          )}
        </AnimatedBackground.Item>
      )}
    </aria.Tab>
  )
}

/**
 * Props for a {@link ProjectTab}.
 */
export interface ProjectTabProps extends Omit<TabProps, 'onClose'> {
  readonly project: LaunchedProject
  readonly onLoadEnd?: (project: LaunchedProject) => void
  readonly onClose?: (project: LaunchedProject) => void
}

const SPINNER = <StatelessSpinner state="loading-medium" size={16} />

/**
 * Project Tab is a {@link Tab} that displays the name of the project.
 */
export function ProjectTab(props: ProjectTabProps) {
  const { project, onLoadEnd, onClose, icon: iconRaw, ...rest } = props

  const didNotifyOnLoadEnd = React.useRef(false)
  const backend = useBackendForProjectType(project.type)

  const stableOnLoadEnd = useEventCallback(() => {
    if (didNotifyOnLoadEnd.current) {
      return
    }
    didNotifyOnLoadEnd.current = true
    onLoadEnd?.(project)
  })

  const stableOnClose = useEventCallback(() => {
    onClose?.(project)
  })

  const { data: isOpened, isSuccess } = reactQuery.useQuery({
    ...projectHooks.createGetProjectDetailsQuery({
      assetId: project.id,
      parentId: project.parentId,
      backend,
    }),
    select: (data) => data.state.type === ProjectState.opened,
    meta: {
      persist: false,
      onSuccess: (opened) => {
        if (opened === true) {
          stableOnLoadEnd()
        }
      },
    },
  })

  const isReady = isSuccess && isOpened

  const icon = isReady ? iconRaw : SPINNER

  return <Tab {...rest} icon={icon} onClose={stableOnClose} />
}

TabBar.ProjectTab = ProjectTab
TabBar.Tab = Tab
