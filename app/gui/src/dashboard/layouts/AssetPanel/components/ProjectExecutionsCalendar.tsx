/** @file A calendar showing executions of a project. */
import { useMemo, useState } from 'react'

import {
  CalendarDate,
  endOfMonth,
  getLocalTimeZone,
  parseDateTime,
  parseDuration,
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
import { Button, ButtonGroup, DialogTrigger, Form, Text } from '#/components/AriaComponents'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { Result } from '#/components/Result'
import { Suspense } from '#/components/Suspense'
import { ProjectExecution } from '#/layouts/AssetPanel/components/ProjectExecution'
import { NewProjectExecutionModal } from '#/layouts/NewProjectExecutionModal'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import {
  AssetType,
  BackendType,
  getProjectExecutionRepetitionsForDateRange,
  type AnyAsset,
  type ProjectExecution as BackendProjectExecution,
  type ProjectAsset,
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
      'text-center px-1 rounded border border-transparent hover:bg-primary/10 outside-visible-range:text-primary/30 disabled:text-primary/30 selected:border-primary/40 h-16 overflow-clip',
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

  const form = Form.useForm({ schema: (z) => z.object({ date: z.instanceof(CalendarDate) }) })
  const timeZone = getLocalTimeZone()
  const [focusedMonth, setFocusedMonth] = useState(() => startOfMonth(today(timeZone)))
  const todayDate = today(timeZone)
  const selectedDate = Form.useWatch({
    control: form.control,
    name: 'date',
    defaultValue: todayDate,
  })

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
        readonly { readonly date: Date; readonly projectExecution: BackendProjectExecution }[]
      >
    >
  >(() => {
    const start = startOfMonth(focusedMonth)
    const startDate = start.toDate(timeZone)
    const end = endOfMonth(focusedMonth)
    const endDate = end.toDate(timeZone)
    const result: Record<
      string,
      { readonly date: Date; readonly projectExecution: BackendProjectExecution }[]
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
  }, [focusedMonth, projectExecutions, timeZone])
  const projectExecutionsForToday = useMemo<
    readonly { readonly date: Date; readonly projectExecution: BackendProjectExecution }[]
  >(
    () =>
      projectExecutions.flatMap((projectExecution) =>
        getProjectExecutionRepetitionsForDateRange(
          projectExecution,
          selectedDate.toDate(timeZone),
          selectedDate.add(parseDuration('P1D')).toDate(timeZone),
        ).flatMap((date) => ({ date, projectExecution })),
      ),
    [projectExecutions, selectedDate, timeZone],
  )

  const styles = PROJECT_EXECUTIONS_CALENDAR_STYLES({})

  return (
    <Form
      form={form}
      className="pointer-events-auto flex w-full flex-col items-center gap-2 self-start overflow-y-auto overflow-x-hidden"
    >
      <ButtonGroup>
        <DialogTrigger>
          <Button variant="outline">{getText('newProjectExecution')}</Button>
          <NewProjectExecutionModal backend={backend} item={item} />
        </DialogTrigger>
      </ButtonGroup>
      <Form.Controller
        control={form.control}
        name="date"
        render={(renderProps) => (
          <Calendar
            focusedValue={focusedMonth}
            onFocusChange={setFocusedMonth}
            className={styles.calendarContainer()}
            {...renderProps.field}
          >
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
        )}
      />
      <Text>
        {getText('projectSessionsOnX', Intl.DateTimeFormat().format(selectedDate.toDate(timeZone)))}
      </Text>
      {projectExecutionsForToday.length === 0 ?
        <Text color="disabled">{getText('noProjectExecutions')}</Text>
      : projectExecutionsForToday.map(({ projectExecution }) => (
          <ProjectExecution
            hideDay
            backend={backend}
            item={item}
            projectExecution={projectExecution}
          />
        ))
      }
    </Form>
  )
}
