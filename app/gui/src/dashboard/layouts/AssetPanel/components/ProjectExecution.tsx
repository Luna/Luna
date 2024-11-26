/** @file Displays information describing a specific version of an asset. */
import { useMutation } from '@tanstack/react-query'

import {
  DAY_TEXT_IDS,
  HOUR_MINUTE,
  HOURS_PER_DAY,
  MINUTE_MS,
} from 'enso-common/src/utilities/data/dateTime'

import ParallelIcon from '#/assets/parallel.svg'
import Play2Icon from '#/assets/play2.svg'
import RepeatIcon from '#/assets/repeat.svg'
import Stop2Icon from '#/assets/stop2.svg'
import TimeIcon from '#/assets/time.svg'
import UpgradeIcon from '#/assets/upgrade.svg'
import { DialogTrigger } from '#/components/aria'
import { Button, ButtonGroup, CloseButton, Text } from '#/components/AriaComponents'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useGetOrdinal } from '#/hooks/ordinalHooks'
import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'
import { useLocalStorageState } from '#/providers/LocalStorageProvider'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import * as backendModule from '#/services/Backend'
import { tv } from '#/utilities/tailwindVariants'
import { getLocalTimeZone, now } from '@internationalized/date'

const PROJECT_EXECUTION_STYLES = tv({
  base: 'group flex flex-row gap-1 w-full rounded-default items-center odd:bg-primary/5 p-2',
  variants: {
    isEnabled: { false: { time: 'opacity-50', optionContainer: 'opacity-50' } },
  },
  slots: {
    timeContainer: 'flex flex-row items-center gap-2 grow px-2 py-0.5',
    time: '',
    timeButtons: 'opacity-0 group-hover:opacity-100 transition-[opacity]',
    optionContainer: 'flex flex-col grow-0 gap-1',
    maximumDuration: 'cursor-default hover:bg-transparent',
    repeatInterval: 'cursor-default',
    parallelMode: 'cursor-default',
  },
})

/** Props for a {@link ProjectExecution}. */
export interface ProjectExecutionProps {
  /** Defaults to `false`. */
  readonly hideDay?: boolean
  readonly backend: Backend
  readonly item: backendModule.ProjectAsset
  readonly projectExecution: backendModule.ProjectExecution
  /** Defaults to the first date of `projectExecution` if not given. */
  readonly date?: Date
}

/** Displays information describing a specific version of an asset. */
export function ProjectExecution(props: ProjectExecutionProps) {
  const { hideDay = false, backend, item, projectExecution, date } = props
  const { getText } = useText()
  const getOrdinal = useGetOrdinal()
  const [timeZone] = useLocalStorageState('preferredTimeZone')
  const time = { ...projectExecution.time }

  const timeZoneOffsetMs = now(timeZone ?? getLocalTimeZone()).offset
  const timeZoneOffsetMinutesTotal = Math.trunc(timeZoneOffsetMs / MINUTE_MS)
  let timeZoneOffsetHours = Math.floor(timeZoneOffsetMinutesTotal / HOUR_MINUTE)
  const timeZoneOffsetMinutes = timeZoneOffsetMinutesTotal - timeZoneOffsetHours * HOUR_MINUTE
  time.minute += timeZoneOffsetMinutes
  while (time.minute < 0) {
    time.minute += HOUR_MINUTE
    timeZoneOffsetHours += 1
  }
  while (time.minute > HOUR_MINUTE) {
    time.minute -= HOUR_MINUTE
    timeZoneOffsetHours -= 1
  }
  if (time.hours) {
    time.hours = time.hours.map(
      (hour) => (hour + timeZoneOffsetHours + HOURS_PER_DAY) % HOURS_PER_DAY,
    )
  }

  const dateString =
    time.dates?.[0] != null ?
      getOrdinal(time.dates[0] + 1)
    : getText(
        time.days?.[0] != null ? DAY_TEXT_IDS[time.days[0]] ?? 'monday'
        : projectExecution.repeatInterval === 'hourly' ? 'everyHour'
        : 'everyDay',
      )
  const minuteString = time.minute === 0 ? '' : `:${String(time.minute).padStart(2, '0')}`
  const hour = date?.getHours() ?? time.hours?.[0]
  const timeString =
    hour != null ?
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      getText(hour > 11 ? 'xPm' : 'xAm', `${hour % 12 || 12}${minuteString}`)
    : getText('everyHourXMinute', minuteString.replace(/^:/, '') || '00')
  const dateTimeString =
    hideDay && projectExecution.repeatInterval !== 'hourly' ?
      timeString
    : getText('dateXTimeX', dateString, timeString)

  const styles = PROJECT_EXECUTION_STYLES({
    isEnabled: projectExecution.enabled,
  })

  const deleteProjectExecution = useMutation(
    backendMutationOptions(backend, 'deleteProjectExecution'),
  ).mutateAsync

  const updateProjectExecution = useMutation(
    backendMutationOptions(backend, 'updateProjectExecution'),
  ).mutateAsync

  const syncProjectExecution = useMutation(
    backendMutationOptions(backend, 'syncProjectExecution'),
  ).mutateAsync

  return (
    <div className={styles.base()}>
      <div className={styles.timeContainer()}>
        <Text elementType="time" className={styles.time()}>
          {dateTimeString}
        </Text>
        <Button
          variant="icon"
          tooltip={
            projectExecution.enabled ?
              getText('currentlyEnabledLabel')
            : getText('currentlyDisabledLabel')
          }
          icon={projectExecution.enabled ? Stop2Icon : Play2Icon}
          className={styles.timeButtons()}
          onPress={async () => {
            await updateProjectExecution([
              projectExecution.projectExecutionId,
              { enabled: !projectExecution.enabled },
              item.title,
            ])
          }}
        />
        <Button
          variant="icon"
          tooltip={getText('updateExecutionToLatestVersionLabel')}
          icon={UpgradeIcon}
          className={styles.timeButtons()}
          onPress={async () => {
            await syncProjectExecution([projectExecution.projectExecutionId, item.title])
          }}
        />
        <DialogTrigger>
          <CloseButton
            className={styles.timeButtons()}
            tooltip={getText('delete')}
            tooltipPlacement="top left"
          />
          <ConfirmDeleteModal
            actionText={getText('deleteThisProjectExecution')}
            doDelete={async () => {
              await deleteProjectExecution([projectExecution.projectExecutionId, item.title])
            }}
          />
        </DialogTrigger>
      </div>
      <ButtonGroup className={styles.optionContainer()}>
        <Button
          size="xsmall"
          variant="outline"
          icon={TimeIcon}
          tooltip={getText('maxDurationLabel')}
          tooltipPlacement="left"
          className={styles.maximumDuration()}
        >
          {getText('xMinutes', projectExecution.maxDurationMinutes)}
        </Button>
        <Button
          size="xsmall"
          variant="outline"
          icon={RepeatIcon}
          tooltip={getText('repeatIntervalLabel')}
          tooltipPlacement="left"
          className={styles.repeatInterval()}
        >
          {getText(backendModule.REPEAT_INTERVAL_TO_TEXT_ID[projectExecution.repeatInterval])}
        </Button>
        <Button
          size="xsmall"
          variant="outline"
          icon={ParallelIcon}
          tooltip={getText('parallelModeLabel')}
          tooltipPlacement="left"
          className={styles.parallelMode()}
        >
          {getText(backendModule.PARALLEL_MODE_TO_TEXT_ID[projectExecution.parallelMode])}
        </Button>
      </ButtonGroup>
    </div>
  )
}
