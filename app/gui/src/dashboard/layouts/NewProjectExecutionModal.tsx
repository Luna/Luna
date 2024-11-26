/** @file Modal for confirming delete of any type of asset. */
import * as z from 'zod'

import {
  ZonedDateTime,
  getDayOfWeek,
  getLocalTimeZone,
  now,
  toCalendarDate,
  toTimeZone,
} from '@internationalized/date'
import { useMutation } from '@tanstack/react-query'

import type Backend from '#/services/Backend'
import type { ProjectId } from '#/services/Backend'
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
  Switch,
  Text,
} from '#/components/AriaComponents'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useLocalStorageState } from '#/providers/LocalStorageProvider'
import { useText } from '#/providers/TextProvider'
import { DAY_3_LETTER_TEXT_IDS, toRfc3339 } from 'enso-common/src/utilities/data/dateTime'

const MAX_DURATION_DEFAULT_MINUTES = 60
const MAX_DURATION_MINIMUM_MINUTES = 1
const MAX_DURATION_MAXIMUM_MINUTES = 180
const REPEAT_TIMES_COUNT = 5
const MAX_DAYS_PER_MONTH = 31
const DAYS_PER_WEEK = 7
const HOURS_PER_DAY = 24
const MINUTE_MS = 60_000
const HOUR_MINUTE = 60

const DATES: readonly number[] = [...Array(MAX_DAYS_PER_MONTH).keys()]
const DAYS: readonly number[] = [...Array(DAYS_PER_WEEK).keys()]
const HOURS: readonly number[] = [...Array(HOURS_PER_DAY).keys()]

/** Create the form schema for this page. */
function createUpsertExecutionSchema(timeZone: string | undefined) {
  return z
    .object({
      projectId: z.string().refine((x: unknown): x is ProjectId => true),
      multiSelect: z.boolean(),
      repeatInterval: z.enum(PROJECT_REPEAT_INTERVALS),
      dates: z
        .number()
        .int()
        .min(0)
        .max(MAX_DAYS_PER_MONTH - 1)
        .array()
        .transform((arr) => arr.sort((a, b) => a - b))
        .readonly(),
      days: z
        .number()
        .int()
        .min(0)
        .max(DAYS_PER_WEEK - 1)
        .array()
        .transform((arr) => arr.sort((a, b) => a - b))
        .readonly(),
      hours: z
        .number()
        .int()
        .min(0)
        .max(HOURS_PER_DAY - 1)
        .array()
        .transform((arr) => arr.sort((a, b) => a - b))
        .readonly(),
      minute: z.number(),
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
        multiSelect,
        maxDurationMinutes,
        parallelMode,
        dates,
        days,
        hours,
        minute,
      }) => {
        const date = startDate ?? now('UTC')
        const utcDate = toTimeZone(date, 'UTC')
        const startDateTime = startDate != null ? toRfc3339(startDate.toDate()) : startDate
        const endDateTime = endDate != null ? toRfc3339(endDate.toDate()) : endDate
        const shared = {
          projectId,
          repeatInterval,
          maxDurationMinutes,
          parallelMode,
          startDate: startDateTime,
          endDate: endDateTime,
        }
        if (multiSelect) {
          const timeZoneOffsetMs = -toTimeZone(date, timeZone ?? getLocalTimeZone()).offset
          const timeZoneOffsetMinutesTotal = Math.trunc(timeZoneOffsetMs / MINUTE_MS)
          let timeZoneOffsetHours = Math.floor(timeZoneOffsetMinutesTotal / HOUR_MINUTE)
          const timeZoneOffsetMinutes =
            timeZoneOffsetMinutesTotal - timeZoneOffsetHours * HOUR_MINUTE
          minute += timeZoneOffsetMinutes
          while (minute < 0) {
            minute += HOUR_MINUTE
            timeZoneOffsetHours += 1
          }
          while (minute > HOUR_MINUTE) {
            minute -= HOUR_MINUTE
            timeZoneOffsetHours -= 1
          }
          return {
            ...shared,
            time: {
              ...(repeatInterval === 'monthly' && { dates }),
              ...(repeatInterval === 'weekly' && { days }),
              ...(repeatInterval !== 'hourly' && {
                hours: hours.map(
                  (hour) => (hour + timeZoneOffsetHours + HOURS_PER_DAY) % HOURS_PER_DAY,
                ),
              }),
              minute,
            },
          }
        } else {
          return {
            ...shared,
            time: {
              ...(repeatInterval === 'monthly' && { dates: [utcDate.day] }),
              ...(repeatInterval === 'weekly' && { days: [getDayOfWeek(utcDate, 'en-US')] }),
              ...(repeatInterval !== 'hourly' && { hours: [utcDate.hour] }),
              minute: repeatInterval !== 'hourly' ? utcDate.minute : minute,
            },
          }
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

  const nowZonedDateTime = now(getLocalTimeZone())
  const minFirstOccurrence = nowZonedDateTime
  const form = Form.useForm({
    method: 'dialog',
    schema: createUpsertExecutionSchema(preferredTimeZone),
    defaultValues: {
      projectId: item.id,
      multiSelect: false,
      repeatInterval: 'weekly',
      parallelMode: 'restart',
      startDate: defaultDate ?? minFirstOccurrence,
      endDate: null,
      maxDurationMinutes: MAX_DURATION_DEFAULT_MINUTES,
      dates: [],
      days: [],
      hours: [],
      minute: 0,
    },
    onSubmit: async (values) => {
      await createProjectExecution([values, item.title])
    },
  })
  const repeatInterval = form.watch('repeatInterval', 'weekly')
  const parallelMode = form.watch('parallelMode', 'restart')
  const date = form.watch('startDate', nowZonedDateTime) ?? nowZonedDateTime
  const multiSelect = form.watch('multiSelect', false)

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
      case 'weekly': {
        return minFirstOccurrence.add({ weeks: 1 })
      }
      case 'monthly': {
        return minFirstOccurrence.add({ months: 1 })
      }
    }
  })()

  const repeatTimes = Array.from({ length: REPEAT_TIMES_COUNT }, (_, i) => {
    switch (repeatInterval) {
      case 'hourly': {
        return date.add({ hours: i })
      }
      case 'daily': {
        return date.add({ days: i })
      }
      case 'weekly': {
        return date.add({ weeks: i })
      }
      case 'monthly': {
        return date.add({ months: i })
      }
    }
  })

  const startAndEndDatesElement = (
    <>
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
            repeatTimes
              .map((time) => toCalendarDate(time).toDate(getLocalTimeZone()).toLocaleDateString())
              .join(', '),
          )}
        </Text>
      </div>
    </>
  )

  return (
    <Form form={form} className="w-full">
      <div className="self-end">
        <Switch form={form} label={getText('advancedModeLabel')} name="multiSelect" />
      </div>
      {!multiSelect && (
        <>
          <Selector
            form={form}
            isRequired
            name="repeatInterval"
            label={getText('repeatIntervalLabel')}
            items={PROJECT_REPEAT_INTERVALS}
          >
            {(interval) => getText(REPEAT_INTERVAL_TO_TEXT_ID[interval])}
          </Selector>
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
          {startAndEndDatesElement}
          <Input
            form={form}
            name="maxDurationMinutes"
            type="number"
            defaultValue={MAX_DURATION_DEFAULT_MINUTES}
            min={MAX_DURATION_MINIMUM_MINUTES}
            max={MAX_DURATION_MAXIMUM_MINUTES}
            label={getText('maxDurationMinutesLabel')}
          />
        </>
      )}
      {multiSelect && (
        <>
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
            <MultiSelector
              form={form}
              isRequired
              name="dates"
              label={getText('datesLabel')}
              items={DATES}
              columns={10}
            >
              {(n) => String(n + 1)}
            </MultiSelector>
          )}
          {repeatInterval === 'weekly' && (
            <MultiSelector
              form={form}
              isRequired
              name="days"
              label={getText('daysLabel')}
              items={DAYS}
            >
              {(n) => getText(DAY_3_LETTER_TEXT_IDS[n] ?? 'monday3')}
            </MultiSelector>
          )}
          {repeatInterval !== 'hourly' && (
            <MultiSelector
              form={form}
              isRequired
              name="hours"
              label={getText('hoursLabel')}
              items={HOURS}
              columns={12}
            />
          )}
          <Input
            form={form}
            required
            name="minute"
            label={getText('minuteLabel')}
            type="number"
            min={0}
            max={59}
          />
          {startAndEndDatesElement}
          <Selector
            form={form}
            isRequired
            name="parallelMode"
            label={getText('parallelModeLabel')}
            items={PROJECT_PARALLEL_MODES}
          >
            {(interval) => getText(PARALLEL_MODE_TO_TEXT_ID[interval])}
          </Selector>
        </>
      )}

      <Form.FormError />
      <ButtonGroup>
        <Form.Submit />
        <DialogDismiss />
      </ButtonGroup>
    </Form>
  )
}
