/** @file Check the version. */
import { useQuery, useQueryClient } from '@tanstack/react-query'

import DownloadIcon from '#/assets/download.svg'
import NewTabIcon from '#/assets/new_tab.svg'
import SnoozeIcon from '#/assets/snooze.svg'
import { IS_DEV_MODE } from 'enso-common/src/detect'

import { useToastAndLog } from '#/hooks/toastAndLogHooks'

import { useEnableVersionChecker, useSetEnableVersionChecker } from '#/components/Devtools'
import { useLocalBackend } from '#/providers/BackendProvider'
import { useText } from '#/providers/TextProvider'

import { Button, ButtonGroup, Dialog, Text } from '#/components/AriaComponents'

import { Stepper } from '#/components/Stepper'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { download } from '#/utilities/download'
import { getDownloadUrl, getLatestRelease, LATEST_RELEASE_PAGE_URL } from '#/utilities/github'
import { startTransition, useState } from 'react'

const CURRENT_VERSION = process.env.ENSO_CLOUD_DASHBOARD_VERSION
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const STALE_TIME = 24 * 60 * 60 * 1000 // 1 day
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const STALE_TIME_ERROR = 10 * 60 * 1000 // 10 minutes

/** Check the version. */
export default function VersionChecker() {
  const [isOpen, setIsOpen] = useState(false)

  const { getText, locale } = useText()
  const toastAndLog = useToastAndLog()
  const localBackend = useLocalBackend()

  const supportsLocalBackend = localBackend != null
  const overrideValue = useEnableVersionChecker()
  const setOverrideValue = useSetEnableVersionChecker()

  const enableVersionChecker = (() => {
    // In dev mode we can override the behavior using the devtools.
    if (IS_DEV_MODE) {
      return overrideValue ?? false
    }

    // Otherwise, we only check the version if we're connected to the local backend,
    // because usually that means we're running inside an electron app.
    return supportsLocalBackend
  })()

  const queryClient = useQueryClient()
  const metadataQuery = useQuery({
    queryKey: ['latestRelease'],
    queryFn: () => getLatestRelease(),
    select: (data) => ({
      tagName: data.tag_name,
      publishedAt: data.published_at,
      htmlUrl: data.html_url,
    }),
    enabled: enableVersionChecker,
    meta: { persist: false },
    staleTime: (query) => {
      if (query.state.error) {
        return STALE_TIME_ERROR
      }

      return STALE_TIME
    },
  })

  const { stepperState, isLastStep, resetStepper } = Stepper.useStepperState({ steps: 2 })

  const remindLater = useEventCallback(() => {
    setIsOpen(false)
    // We need to suppress the dialog from showing again for next 24 hours.
    queryClient.setQueryData(['latestRelease'], {
      /* eslint-disable @typescript-eslint/naming-convention, camelcase */
      tag_name: CURRENT_VERSION,
      published_at: new Date().toISOString(),
      html_url: LATEST_RELEASE_PAGE_URL,
      /* eslint-enable @typescript-eslint/naming-convention, camelcase */
    })
  })

  const onDownload = useEventCallback(async () => {
    const downloadUrl = await getDownloadUrl()

    if (downloadUrl == null) {
      toastAndLog('noAppDownloadError')
    } else {
      download(downloadUrl)
      stepperState.nextStep()
    }
  })

  if (!metadataQuery.isSuccess) {
    return null
  }

  const latestVersion = metadataQuery.data.tagName
  const htmlUrl = metadataQuery.data.htmlUrl
  const publishedAt = new Date(metadataQuery.data.publishedAt).toLocaleString(locale, {
    dateStyle: 'medium',
  })

  if (latestVersion !== CURRENT_VERSION && !isOpen && !isLastStep) {
    startTransition(() => {
      setIsOpen(true)
    })
  }

  return (
    <Dialog
      title={getText('versionOutdatedTitle')}
      modalProps={{ isOpen }}
      isDismissable={isLastStep}
      hideCloseButton={!isLastStep}
      isKeyboardDismissDisabled={!isLastStep}
      onOpenChange={(openChange) => {
        startTransition(() => {
          if (!openChange && overrideValue === true) {
            setOverrideValue(false)
          }

          if (!isLastStep) {
            remindLater()
          }

          resetStepper()

          setIsOpen(openChange)
        })
      }}
    >
      {() => (
        <Stepper state={stepperState} renderStep={null}>
          <Stepper.StepContent index={0}>
            <div className="flex flex-col">
              <Text className="text-center text-sm" balance>
                {getText('versionOutdatedPrompt')}
              </Text>
              <div className="mb-6 flex flex-col items-center">
                <Text variant="h1" className="mt-4">
                  {getText('latestVersion', latestVersion, publishedAt)}
                </Text>

                <Button
                  variant="link"
                  href={htmlUrl}
                  target="_blank"
                  icon={NewTabIcon}
                  iconPosition="end"
                >
                  {getText('changeLog')}
                </Button>

                <Text>
                  {getText('yourVersion')}{' '}
                  <Text>{CURRENT_VERSION ?? getText('unknownPlaceholder')}</Text>
                </Text>
              </div>

              <ButtonGroup className="justify-center">
                <Button
                  size="medium"
                  variant="outline"
                  fullWidth
                  onPress={remindLater}
                  icon={SnoozeIcon}
                  iconPosition="end"
                >
                  {getText('remindMeLater')}
                </Button>
                <Button
                  size="medium"
                  fullWidth
                  variant="primary"
                  onPress={onDownload}
                  icon={DownloadIcon}
                  iconPosition="end"
                >
                  {getText('download')}
                </Button>
              </ButtonGroup>
            </div>
          </Stepper.StepContent>

          <Stepper.StepContent index={1}>
            <div className="flex flex-col items-center text-center">
              <Text balance variant="body">
                {getText('downloadingAppMessage')}
              </Text>

              <Dialog.Close variant="primary" className="mt-4 min-w-48">
                {getText('close')}
              </Dialog.Close>
            </div>
          </Stepper.StepContent>
        </Stepper>
      )}
    </Dialog>
  )
}
