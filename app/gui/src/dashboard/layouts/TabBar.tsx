/** @file Switcher to choose the currently visible full-screen page. */
import { useEffect, useMemo, useRef, type PropsWithChildren, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'

import { ProjectState } from '@common/services/Backend'
import type { TextId } from '../../../../common/src/text'

import { AnimatedBackground } from '#/components/AnimatedBackground'
import { Tab as AriaTab, TabList, type TabListProps } from '#/components/aria'
import { CloseButton, Text } from '#/components/AriaComponents'
import { StatelessSpinner } from '#/components/StatelessSpinner'
import SvgMask from '#/components/SvgMask'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { createGetProjectDetailsQuery } from '#/hooks/projectHooks'
import { useBackendForProjectType } from '#/providers/BackendProvider'
import { useInputBindings } from '#/providers/InputBindingsProvider'
import type { LaunchedProject } from '#/providers/ProjectsProvider'
import { useText } from '#/providers/TextProvider'
import { document } from '#/utilities/sanitizedEventTargets'
import { twJoin } from '#/utilities/tailwindMerge'

/** Props for a {@link TabBar}. */
export interface TabBarProps<T extends object> extends TabListProps<T> {
  readonly className?: string
}

/** Switcher to choose the currently visible full-screen page. */
export default function TabBar<T extends object>(props: TabBarProps<T>) {
  const { className, ...rest } = props

  const classes = useMemo(() => twJoin('flex grow', className), [className])

  return (
    <AnimatedBackground>
      <div className={classes}>
        <TabList<T> className="flex h-12 shrink-0 grow" {...rest} />
      </div>
    </AnimatedBackground>
  )
}

/** Props for a {@link Tab}. */
export interface TabProps extends Readonly<PropsWithChildren> {
  readonly 'data-testid'?: string
  readonly id: string
  readonly isActive: boolean
  readonly isHidden?: boolean
  readonly icon: ReactNode | string | null
  readonly labelId: TextId
  readonly onClose?: () => void
}

const UNDERLAY_ELEMENT = (
  <>
    <div className="h-full w-full rounded-t-4xl bg-dashboard" />
    <div className="absolute -left-5 bottom-0 aspect-square w-5 -rotate-90 [background:radial-gradient(circle_at_100%_0%,_transparent_70%,_var(--color-dashboard-background)_70%)]" />
    <div className="absolute -right-5 bottom-0 aspect-square w-5 -rotate-90 [background:radial-gradient(circle_at_100%_100%,_transparent_70%,_var(--color-dashboard-background)_70%)]" />
  </>
)

/** A tab in a {@link TabBar}. */
export function Tab(props: TabProps) {
  const { id, isActive, isHidden = false, icon, labelId, children, onClose } = props
  const { getText } = useText()
  const inputBindings = useInputBindings()

  const stableOnClose = useEventCallback(() => {
    onClose?.()
  })

  useEffect(() => {
    if (isActive) {
      return inputBindings.attach(document.body, 'keydown', {
        closeTab: stableOnClose,
      })
    }
  }, [inputBindings, isActive, stableOnClose])

  return (
    <AriaTab
      data-testid={props['data-testid']}
      id={id}
      aria-label={getText(labelId)}
      className={twJoin(
        'disabled:cursor-not-allowed disabled:opacity-30 [&.disabled]:cursor-not-allowed [&.disabled]:opacity-30',
        !isActive && 'cursor-pointer',
        isHidden && 'hidden',
      )}
    >
      {({ isSelected, isHovered }) => (
        <AnimatedBackground.Item
          isSelected={isSelected}
          className="h-full w-full rounded-t-3xl pl-4 pr-4"
          underlayElement={UNDERLAY_ELEMENT}
        >
          <div className="relative z-1 flex h-full w-full items-center justify-center gap-3">
            <motion.div
              variants={{ active: { opacity: 1 }, inactive: { opacity: 0 } }}
              initial="inactive"
              animate={!isSelected && isHovered ? 'active' : 'inactive'}
              className="absolute -inset-x-2.5 inset-y-2 -z-1 rounded-3xl bg-dashboard transition-colors duration-300"
            />

            {typeof icon === 'string' ?
              <SvgMask
                src={icon}
                className={twJoin(onClose && 'group-hover:hidden focus-visible:hidden')}
              />
            : icon}

            <Text truncate="1" className="max-w-40">
              {children}
            </Text>

            {onClose && (
              <div className="relative">
                <CloseButton onPress={onClose} />
              </div>
            )}
          </div>
        </AnimatedBackground.Item>
      )}
    </AriaTab>
  )
}

/** Props for a {@link ProjectTab}. */
export interface ProjectTabProps extends Omit<TabProps, 'onClose'> {
  readonly project: LaunchedProject
  readonly onLoadEnd?: (project: LaunchedProject) => void
  readonly onClose?: (project: LaunchedProject) => void
}

const SPINNER = <StatelessSpinner state="loading-medium" size={16} />

/** Project Tab is a {@link Tab} that displays the name of the project. */
export function ProjectTab(props: ProjectTabProps) {
  const { project, onLoadEnd, onClose, icon: iconRaw, ...rest } = props

  const didNotifyOnLoadEnd = useRef(false)
  const backend = useBackendForProjectType(project.type)

  const stableOnLoadEnd = useEventCallback(() => {
    onLoadEnd?.(project)
  })

  const stableOnClose = useEventCallback(() => {
    onClose?.(project)
  })

  const { data: isOpened, isSuccess } = useQuery({
    ...createGetProjectDetailsQuery({
      assetId: project.id,
      parentId: project.parentId,
      backend,
    }),
    select: (data) => data.state.type === ProjectState.opened,
  })

  const isReady = isSuccess && isOpened

  useEffect(() => {
    if (isReady && !didNotifyOnLoadEnd.current) {
      didNotifyOnLoadEnd.current = true
      stableOnLoadEnd()
    }
  }, [isReady, stableOnLoadEnd])

  useEffect(() => {
    if (!isReady) {
      didNotifyOnLoadEnd.current = false
    }
  }, [isReady])

  const icon = isReady ? iconRaw : SPINNER

  return <Tab {...rest} icon={icon} onClose={stableOnClose} />
}

TabBar.ProjectTab = ProjectTab
TabBar.Tab = Tab
