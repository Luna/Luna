/** @file Displays information describing a specific version of an asset. */
import { useMutation } from '@tanstack/react-query'

import { DAY_TEXT_IDS } from 'enso-common/src/utilities/data/dateTime'

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
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import * as backendModule from '#/services/Backend'
import { tv } from '#/utilities/tailwindVariants'

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
  readonly backend: Backend
  readonly item: backendModule.ProjectAsset
  readonly projectExecution: backendModule.ProjectExecution
}

/** Displays information describing a specific version of an asset. */
export default function ProjectExecution(props: ProjectExecutionProps) {
  const { backend, item, projectExecution } = props
  const { getText } = useText()
  const getOrdinal = useGetOrdinal()
  const time = projectExecution.time
  const dateString =
    time.dates?.[0] != null ?
      getOrdinal(time.dates[0] + 1)
    : getText(time.days?.[0] != null ? DAY_TEXT_IDS[time.days[0]] ?? 'monday' : 'everyDay')
  const minuteString = time.minute === 0 ? '' : `:${String(time.minute).padStart(2, '0')}`
  const timeString =
    time.hours?.[0] != null ?
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      getText(time.hours[0] > 11 ? 'xPm' : 'xAm', `${time.hours[0] % 12 || 12}${minuteString}`)
    : getText('everyHourXMinute', minuteString || ':00')
  const dateTimeString = getText('dateXTimeX', dateString, timeString)

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
          tooltip={getText('maxDurationMinutesLabel')}
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
