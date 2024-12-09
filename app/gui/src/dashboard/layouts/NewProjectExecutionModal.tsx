/** @file Modal for confirming delete of any type of asset. */
import * as z from 'zod'

import { ZonedDateTime, getLocalTimeZone, now } from '@internationalized/date'
import { useMutation } from '@tanstack/react-query'

import type Backend from '#/services/Backend'
import type {
  ProjectExecutionInfo,
  ProjectExecutionRepeatInfo,
  ProjectId,
} from '#/services/Backend'
import {
  PARALLEL_MODE_TO_DESCRIPTION_ID,
  PARALLEL_MODE_TO_TEXT_ID,
  PROJECT_PARALLEL_MODES,
  PROJECT_REPEAT_INTERVALS,
  REPEAT_INTERVAL_TO_TEXT_ID,
  type ProjectAsset,
} from 'enso-common/src/services/Backend'

import {
  ButtonGroup,
  DatePicker,
  Dialog,
  DialogDismiss,
  Form,
  Input,
  MultiSelector,
  Selector,
  Text,
} from '#/components/AriaComponents'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useLocalStorageState } from '#/providers/LocalStorageProvider'
import { useText } from '#/providers/TextProvider'
import {
  firstProjectExecutionOnOrAfter,
  nextProjectExecutionDate,
} from 'enso-common/src/services/Backend/projectExecution'
import type { TextId } from 'enso-common/src/text'
import {
  DAY_3_LETTER_TEXT_IDS,
  MONTH_3_LETTER_TEXT_IDS,
  toRfc3339,
} from 'enso-common/src/utilities/data/dateTime'

const MAX_DURATION_DEFAULT_MINUTES = 60
const MAX_DURATION_MINIMUM_MINUTES = 1
const MAX_DURATION_MAXIMUM_MINUTES = 180
const REPEAT_TIMES_COUNT = 5
const MAX_DAYS_PER_MONTH = 31
const DAYS_PER_WEEK = 7
const HOURS_PER_DAY = 24
const MAX_WEEKS_PER_MONTH = 5
const MONTHS_PER_YEAR = 12
const MONTHLY_REPEAT_TYPES = ['date', 'weekday'] as const

const MONTHLY_REPEAT_TYPE_TO_TEXT_ID = {
  date: 'dateMonthlyRepeatType',
  weekday: 'weekdayMonthlyRepeatType',
} satisfies {
  readonly [K in (typeof MONTHLY_REPEAT_TYPES)[number]]: TextId & `${K}MonthlyRepeatType`
}

const DATES = [...Array(MAX_DAYS_PER_MONTH).keys()] as const
const DAYS = [...Array(DAYS_PER_WEEK).keys()] as const
const HOURS = [...Array(HOURS_PER_DAY).keys()] as const
const MONTHS = [...Array(MONTHS_PER_YEAR).keys()] as const

/** Create the form schema for this page. */
function createUpsertExecutionSchema(timeZone: string | undefined) {
  return z
    .object({
      projectId: z.string().refine((x: unknown): x is ProjectId => true),
      repeatInterval: z.enum(PROJECT_REPEAT_INTERVALS),
      monthlyRepeatType: z.enum(MONTHLY_REPEAT_TYPES),
      date: z
        .number()
        .int()
        .min(0)
        .max(MAX_DAYS_PER_MONTH - 1),
      dayOfWeek: z
        .number()
        .int()
        .min(0)
        .max(DAYS_PER_WEEK - 1),
      weekNumber: z.number().int().min(1).max(MAX_WEEKS_PER_MONTH),
      days: z
        .number()
        .int()
        .min(0)
        .max(DAYS_PER_WEEK - 1)
        .array()
        .transform((arr) => arr.sort((a, b) => a - b))
        .readonly(),
      months: z
        .number()
        .int()
        .min(0)
        .max(MONTHS_PER_YEAR - 1)
        .array()
        .transform((arr) => arr.sort((a, b) => a - b))
        .readonly(),
      startHour: z
        .number()
        .int()
        .min(0)
        .max(HOURS_PER_DAY - 1),
      endHour: z
        .number()
        .int()
        .min(0)
        .max(HOURS_PER_DAY - 1),
      startDate: z.instanceof(ZonedDateTime).or(z.null()).optional(),
      endDate: z.instanceof(ZonedDateTime).or(z.null()).optional(),
      maxDurationMinutes: z
        .number()
        .int()
        .min(MAX_DURATION_MINIMUM_MINUTES)
        .max(MAX_DURATION_MAXIMUM_MINUTES),
      parallelMode: z.enum(PROJECT_PARALLEL_MODES),
    })
    .transform(
      ({
        projectId,
        startDate = null,
        endDate = null,
        repeatInterval,
        monthlyRepeatType,
        maxDurationMinutes,
        parallelMode,
        date,
        dayOfWeek,
        weekNumber,
        days,
        months,
        startHour,
        endHour,
      }): ProjectExecutionInfo => {
        timeZone ??= getLocalTimeZone()
        startDate ??= now(timeZone)
        const startDateTime = toRfc3339(startDate.toDate())
        const endDateTime = endDate != null ? toRfc3339(endDate.toDate()) : endDate
        const repeat = ((): ProjectExecutionRepeatInfo => {
          switch (repeatInterval) {
            case 'hourly': {
              return {
                type: 'hourly',
                startHour: startHour,
                endHour: endHour,
              }
            }
            case 'daily': {
              return {
                type: 'daily',
                daysOfWeek: days,
              }
            }
            case 'monthly': {
              switch (monthlyRepeatType) {
                case 'date': {
                  return {
                    type: 'monthly-date',
                    date,
                    months,
                  }
                }
                case 'weekday': {
                  return {
                    type: 'monthly-weekday',
                    dayOfWeek,
                    weekNumber,
                    months,
                  }
                }
              }
              break
            }
          }
        })()
        return {
          projectId,
          timeZone: timeZone,
          repeat,
          maxDurationMinutes,
          parallelMode,
          startDate: startDateTime,
          endDate: endDateTime,
        }
      },
    )
}

/** Props for a {@link NewProjectExecutionModal}. */
export interface NewProjectExecutionModalProps {
  readonly backend: Backend
  readonly item: ProjectAsset
  readonly defaultOpen?: boolean
  readonly defaultDate?: ZonedDateTime
}

/** A modal for confirming the deletion of an asset. */
export function NewProjectExecutionModal(props: NewProjectExecutionModalProps) {
  const { defaultOpen } = props
  const { getText } = useText()

  return (
    <Dialog title={getText('newProjectExecution')} {...(defaultOpen != null && { defaultOpen })}>
      <NewProjectExecutionModalInner {...props} />
    </Dialog>
  )
}

/** A modal for confirming the deletion of an asset. */
function NewProjectExecutionModalInner(props: NewProjectExecutionModalProps) {
  const { backend, item, defaultDate } = props
  const { getText } = useText()
  const [preferredTimeZone] = useLocalStorageState('preferredTimeZone')
  const timeZone = preferredTimeZone ?? getLocalTimeZone()

  const nowZonedDateTime = now(timeZone)
  const minFirstOccurrence = nowZonedDateTime
  const form = Form.useForm({
    method: 'dialog',
    schema: createUpsertExecutionSchema(preferredTimeZone),
    defaultValues: {
      projectId: item.id,
      repeatInterval: 'daily',
      monthlyRepeatType: 'date',
      parallelMode: 'restart',
      startDate: defaultDate ?? minFirstOccurrence,
      endDate: null,
      maxDurationMinutes: MAX_DURATION_DEFAULT_MINUTES,
      date: 1,
      days: [1],
      months: [0],
      dayOfWeek: 0,
      weekNumber: 1,
      startHour: 0,
      endHour: HOURS_PER_DAY - 1,
    },
    onSubmit: async (values) => {
      await createProjectExecution([values, item.title])
    },
  })
  const repeatInterval = form.watch('repeatInterval', 'daily')
  const monthlyRepeatType = form.watch('monthlyRepeatType', 'date')
  const parallelMode = form.watch('parallelMode', 'restart')
  const date = form.watch('startDate', nowZonedDateTime) ?? nowZonedDateTime

  const createProjectExecution = useMutation(
    backendMutationOptions(backend, 'createProjectExecution'),
  ).mutateAsync

  const maxFirstOccurrence = (() => {
    switch (repeatInterval) {
      case 'hourly': {
        return minFirstOccurrence.add({ hours: 1 })
      }
      case 'daily': {
        return minFirstOccurrence.add({ days: 1 })
      }
      case 'monthly': {
        return minFirstOccurrence.add({ months: 1 })
      }
    }
  })()

  const repeatTimes = (() => {
    const parsed = form.schema.safeParse(form.getValues())
    const projectExecution = parsed.data
    if (!projectExecution) {
      return []
    }
    let nextDate = firstProjectExecutionOnOrAfter(projectExecution, date.toDate())
    const dates = [nextDate]
    while (dates.length < REPEAT_TIMES_COUNT) {
      nextDate = nextProjectExecutionDate(projectExecution, nextDate)
      dates.push(nextDate)
    }
    return dates
  })()

  return (
    <Form form={form} className="w-full">
      <Selector
        form={form}
        isRequired
        name="repeatInterval"
        label={getText('repeatIntervalLabel')}
        items={PROJECT_REPEAT_INTERVALS}
      >
        {(interval) => getText(REPEAT_INTERVAL_TO_TEXT_ID[interval])}
      </Selector>
      {repeatInterval === 'monthly' && (
        <Selector
          form={form}
          isRequired
          name="monthlyRepeatType"
          label={getText('monthlyRepeatTypeLabel')}
          items={MONTHLY_REPEAT_TYPES}
        >
          {(interval) => getText(MONTHLY_REPEAT_TYPE_TO_TEXT_ID[interval])}
        </Selector>
      )}
      <div className="flex w-full flex-col">
        <Selector
          form={form}
          isRequired
          name="parallelMode"
          label={getText('parallelModeLabel')}
          items={PROJECT_PARALLEL_MODES}
        >
          {(interval) => getText(PARALLEL_MODE_TO_TEXT_ID[interval])}
        </Selector>
        <Text>{getText(PARALLEL_MODE_TO_DESCRIPTION_ID[parallelMode])}</Text>
      </div>
      <div className="flex flex-col">
        <DatePicker
          form={form}
          isRequired
          noCalendarHeader
          name="startDate"
          granularity="minute"
          label={getText('firstOccurrenceLabel')}
          minValue={minFirstOccurrence}
          maxValue={maxFirstOccurrence}
        />
        <DatePicker
          form={form}
          noCalendarHeader
          name="endDate"
          granularity="minute"
          label={getText('endAtLabel')}
        />
        <Text>
          {getText(
            'repeatsAtX',
            (repeatInterval === 'hourly' ?
              // eslint-disable-next-line @typescript-eslint/unbound-method
              repeatTimes.map(Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format)
              // eslint-disable-next-line @typescript-eslint/unbound-method
            : repeatTimes.map(Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format)
            ).join(', '),
          )}
        </Text>
      </div>
      <Input
        form={form}
        name="maxDurationMinutes"
        type="number"
        defaultValue={MAX_DURATION_DEFAULT_MINUTES}
        min={MAX_DURATION_MINIMUM_MINUTES}
        max={MAX_DURATION_MAXIMUM_MINUTES}
        label={getText('maxDurationMinutesLabel')}
      />
      {repeatInterval === 'hourly' && (
        <Selector
          form={form}
          isRequired
          name="startHour"
          label={getText('startHourLabel')}
          items={HOURS}
          columns={12}
        />
      )}
      {repeatInterval === 'hourly' && (
        <Selector
          form={form}
          isRequired
          name="endHour"
          label={getText('endHourLabel')}
          items={HOURS}
          columns={12}
        />
      )}
      {repeatInterval === 'daily' && (
        <MultiSelector form={form} isRequired name="days" label={getText('daysLabel')} items={DAYS}>
          {(n) => getText(DAY_3_LETTER_TEXT_IDS[n] ?? 'monday3')}
        </MultiSelector>
      )}
      {repeatInterval === 'monthly' && monthlyRepeatType === 'date' && (
        <Selector
          form={form}
          isRequired
          name="date"
          label={getText('dateLabel')}
          items={DATES}
          columns={10}
        >
          {(n) => String(n + 1)}
        </Selector>
      )}
      {repeatInterval === 'monthly' && monthlyRepeatType === 'weekday' && (
        <>
          <Selector
            form={form}
            isRequired
            name="dayOfWeek"
            label={getText('dayOfWeekLabel')}
            items={DAYS}
          >
            {(n) => getText(DAY_3_LETTER_TEXT_IDS[n] ?? 'monday3')}
          </Selector>
          <Input
            form={form}
            isRequired
            name="weekNumber"
            label={getText('weekOfMonthLabel')}
            type="number"
          />
        </>
      )}
      {repeatInterval === 'monthly' && (
        <MultiSelector
          form={form}
          isRequired
          name="months"
          label={getText('monthsLabel')}
          items={MONTHS}
          columns={6}
        >
          {(n) => getText(MONTH_3_LETTER_TEXT_IDS[n] ?? 'january3')}
        </MultiSelector>
      )}

      <Form.FormError />
      <ButtonGroup>
        <Form.Submit />
        <DialogDismiss />
      </ButtonGroup>
    </Form>
  )
}
