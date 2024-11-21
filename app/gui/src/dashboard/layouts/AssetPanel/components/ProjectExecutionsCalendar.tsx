/** @file A calendar showing executions of a project. */
import { useMemo } from 'react'

import {
  endOfMonth,
  getLocalTimeZone,
  parseDateTime,
  startOfMonth,
  toCalendarDate,
  today,
} from '@internationalized/date'
import { useSuspenseQuery } from '@tanstack/react-query'

import ArrowIcon from '#/assets/folder_arrow.svg'
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
} from '#/components/aria'
import { Button, ButtonGroup, DialogTrigger, Text } from '#/components/AriaComponents'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { Result } from '#/components/Result'
import { Suspense } from '#/components/Suspense'
import { NewProjectExecutionModal } from '#/layouts/NewProjectExecutionModal'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import {
  AssetType,
  BackendType,
  getProjectExecutionRepetitionsForDateRange,
  type AnyAsset,
  type ProjectAsset,
  type ProjectExecution,
} from '#/services/Backend'
import { tv } from '#/utilities/tailwindVariants'

const PROJECT_EXECUTIONS_CALENDAR_STYLES = tv({
  base: '',
  slots: {
    calendarContainer: 'w-full',
    calendarHeader: 'flex items-center mb-2',
    calendarHeading: 'text-base grow text-center',
    calendarGrid: 'w-full',
    calendarGridHeader: 'flex',
    calendarGridHeaderCell: '',
    calendarGridBody: '',
    calendarGridCell:
      'text-center px-1 rounded border border-transparent hover:bg-primary/10 outside-visible-range:text-primary/30 disabled:text-primary/30 selected:border-primary/40 min-h-16',
  },
})

/** Props for a {@link ProjectExecutionsCalendar}. */
export interface ProjectExecutionsCalendarProps {
  readonly backend: Backend
  readonly item: AnyAsset | null
}

/** A calendar showing executions of a project. */
export function ProjectExecutionsCalendar(props: ProjectExecutionsCalendarProps) {
  const { backend, item } = props

  const { getText } = useText()

  if (backend.type === BackendType.local) {
    return <Result status="info" centered title={getText('assetProjectExecutions.localBackend')} />
  }

  if (item == null) {
    return <Result status="info" centered title={getText('assetProjectExecutions.notSelected')} />
  }

  if (item.type !== AssetType.project) {
    return (
      <Result status="info" centered title={getText('assetProjectExecutions.notProjectAsset')} />
    )
  }

  return (
    <ErrorBoundary>
      <Suspense>
        <ProjectExecutionsCalendarInternal {...props} item={item} />
      </Suspense>
    </ErrorBoundary>
  )
}

/** Props for a {@link ProjectExecutionsCalendarInternal}. */
interface ProjectExecutionsCalendarInternalProps extends ProjectExecutionsCalendarProps {
  readonly item: ProjectAsset
}

/** A calendar showing executions of a project. */
function ProjectExecutionsCalendarInternal(props: ProjectExecutionsCalendarInternalProps) {
  const { backend, item } = props
  const { getText } = useText()

  const projectExecutionsQuery = useSuspenseQuery({
    queryKey: [backend.type, 'listProjectExecutions', item.id, item.title],
    queryFn: async () => {
      const executions = await backend.listProjectExecutions(item.id, item.title)
      return [...executions].reverse()
    },
  })
  const projectExecutions = projectExecutionsQuery.data
  const projectExecutionsByDate = useMemo<
    Readonly<
      Record<
        string,
        readonly { readonly date: Date; readonly projectExecution: ProjectExecution }[]
      >
    >
  >(() => {
    const timeZone = getLocalTimeZone()
    const todayDate = today(timeZone)
    const start = startOfMonth(todayDate)
    const startDate = start.toDate(timeZone)
    const end = endOfMonth(todayDate)
    const endDate = end.toDate(timeZone)
    const result: Record<
      string,
      { readonly date: Date; readonly projectExecution: ProjectExecution }[]
    > = {}
    for (const projectExecution of projectExecutions) {
      for (const date of getProjectExecutionRepetitionsForDateRange(
        projectExecution,
        startDate,
        endDate,
      )) {
        const dateString = toCalendarDate(
          parseDateTime(date.toISOString().replace(/Z$/, '')),
        ).toString()
        ;(result[dateString] ??= []).push({ date, projectExecution })
      }
    }
    return result
  }, [projectExecutions])

  const styles = PROJECT_EXECUTIONS_CALENDAR_STYLES({})

  return (
    <div className="pointer-events-auto flex w-full flex-col items-center gap-2 self-start overflow-y-auto overflow-x-hidden">
      <ButtonGroup>
        <DialogTrigger>
          <Button variant="outline">{getText('newProjectExecution')}</Button>
          <NewProjectExecutionModal backend={backend} item={item} />
        </DialogTrigger>
      </ButtonGroup>
      <Calendar className={styles.calendarContainer()}>
        <header className={styles.calendarHeader()}>
          <Button variant="icon" slot="previous" icon={ArrowIcon} className="rotate-180" />
          <Heading className={styles.calendarHeading()} />
          <Button variant="icon" slot="next" icon={ArrowIcon} />
        </header>
        <CalendarGrid className={styles.calendarGrid()}>
          <CalendarGridHeader className={styles.calendarGridHeader()}>
            {() => <CalendarHeaderCell className={styles.calendarGridHeaderCell()} />}
          </CalendarGridHeader>
          <CalendarGridBody className={styles.calendarGridBody()}>
            {(date) => (
              <CalendarCell date={date} className={styles.calendarGridCell()}>
                <div className="flex flex-col items-center">
                  <Text color="custom">{date.day}</Text>
                  {projectExecutionsByDate[date.toString()]?.map((data) => (
                    <Text color="disabled">{`${data.date.getHours().toString().padStart(2, '0')}:${data.date.getMinutes().toString().padStart(2, '0')}`}</Text>
                  ))}
                </div>
              </CalendarCell>
            )}
          </CalendarGridBody>
        </CalendarGrid>
      </Calendar>
      <Text>{getText('projectSessionsOnX', Intl.DateTimeFormat().format(new Date()))}</Text>
      {projectExecutions.length === 0 && (
        <Text color="disabled">{getText('noProjectExecutions')}</Text>
      )}
    </div>
  )
}
