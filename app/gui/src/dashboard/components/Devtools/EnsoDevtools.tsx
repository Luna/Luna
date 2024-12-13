/** @file UI for manipulating application state. */
import { useEffect, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { IS_DEV_MODE } from 'enso-common/src/detect'
import { Plan } from 'enso-common/src/services/Backend'

import { SETUP_PATH } from '#/appUtils'
import CrossIcon from '#/assets/cross.svg'
import DevtoolsLogo from '#/assets/enso_logo.svg'
import TrashIcon from '#/assets/trash.svg'
import {
  Button,
  DialogTrigger,
  Form,
  Input,
  Popover,
  Radio,
  RadioGroup,
  Separator,
  Switch,
  Text,
} from '#/components/AriaComponents'
import Portal from '#/components/Portal'
import { usePaywallFeatures, type PaywallFeatureName } from '#/hooks/billing'
import { useAuth, UserSessionType } from '#/providers/AuthProvider'
import {
  FEATURE_FLAGS_SCHEMA,
  useFeatureFlags,
  useSetFeatureFlags,
} from '#/providers/FeatureFlagsProvider'
import { useLocalStorage } from '#/providers/LocalStorageProvider'
import { useText } from '#/providers/TextProvider'
import LocalStorage, { type LocalStorageData } from '#/utilities/LocalStorage'
import {
  useAnimationsDisabled,
  useEnableVersionChecker,
  usePaywallDevtools,
  useSetAnimationsDisabled,
  useSetEnableVersionChecker,
  useShowDevtools,
} from './EnsoDevtoolsProvider'

/** A component that provides a UI for toggling paywall features. */
export function EnsoDevtools() {
  const { getText } = useText()
  const { authQueryKey, session } = useAuth()
  const queryClient = useQueryClient()
  const { getFeature } = usePaywallFeatures()

  const showDevtools = useShowDevtools()

  const { features, setFeature } = usePaywallDevtools()
  const enableVersionChecker = useEnableVersionChecker()
  const setEnableVersionChecker = useSetEnableVersionChecker()

  const animationsDisabled = useAnimationsDisabled()
  const setAnimationsDisabled = useSetAnimationsDisabled()

  const { localStorage } = useLocalStorage()
  const [localStorageState, setLocalStorageState] = useState<Partial<LocalStorageData>>({})

  // Re-render when localStorage changes.
  useEffect(() => localStorage.subscribeAll(setLocalStorageState), [localStorage])

  const featureFlags = useFeatureFlags()
  const setFeatureFlags = useSetFeatureFlags()

  if (!showDevtools) {
    return null
  }

  return (
    <Portal>
      <DialogTrigger>
        <Button
          icon={DevtoolsLogo}
          aria-label={getText('ensoDevtoolsButtonLabel')}
          variant="icon"
          rounded="full"
          size="hero"
          className="fixed bottom-16 right-3 z-50"
          data-ignore-click-outside
        />

        <Popover>
          <Text.Heading disableLineHeightCompensation>
            {getText('ensoDevtoolsPopoverHeading')}
          </Text.Heading>

          <Separator orientation="horizontal" className="my-3" />

          {session?.type === UserSessionType.full && (
            <>
              <Text variant="subtitle">{getText('ensoDevtoolsPlanSelectSubtitle')}</Text>

              <Form
                gap="small"
                schema={(schema) => schema.object({ plan: schema.nativeEnum(Plan) })}
                defaultValues={{ plan: session.user.plan ?? Plan.free }}
              >
                {({ form }) => (
                  <>
                    <RadioGroup
                      name="plan"
                      onChange={(value) => {
                        queryClient.setQueryData(authQueryKey, {
                          ...session,
                          user: { ...session.user, plan: value },
                        })
                      }}
                    >
                      <Radio label={getText('free')} value={Plan.free} />
                      <Radio label={getText('solo')} value={Plan.solo} />
                      <Radio label={getText('team')} value={Plan.team} />
                      <Radio label={getText('enterprise')} value={Plan.enterprise} />
                    </RadioGroup>

                    <Button
                      size="small"
                      variant="outline"
                      onPress={() =>
                        queryClient.invalidateQueries({ queryKey: authQueryKey }).then(() => {
                          form.reset()
                        })
                      }
                    >
                      {getText('reset')}
                    </Button>
                  </>
                )}
              </Form>

              <Separator orientation="horizontal" className="my-3" />

              {/* eslint-disable-next-line no-restricted-syntax */}
              <Button variant="link" href={SETUP_PATH + '?__qd-debg__=true'}>
                Open setup page
              </Button>

              <Separator orientation="horizontal" className="my-3" />
            </>
          )}

          <Text variant="subtitle" className="mb-2">
            {getText('productionOnlyFeatures')}
          </Text>

          <Form
            schema={(z) =>
              z.object({ enableVersionChecker: z.boolean(), disableAnimations: z.boolean() })
            }
            defaultValues={{
              enableVersionChecker: enableVersionChecker ?? !IS_DEV_MODE,
              disableAnimations: animationsDisabled,
            }}
          >
            {({ form }) => (
              <>
                <Switch
                  form={form}
                  name="disableAnimations"
                  label={getText('disableAnimations')}
                  description={getText('disableAnimationsDescription')}
                  onChange={(value) => {
                    setAnimationsDisabled(value)
                  }}
                />

                <Switch
                  form={form}
                  name="enableVersionChecker"
                  label={getText('enableVersionChecker')}
                  description={getText('enableVersionCheckerDescription')}
                  onChange={(value) => {
                    setEnableVersionChecker(value)
                  }}
                />
              </>
            )}
          </Form>

          <Separator orientation="horizontal" className="my-3" />

          <Text variant="subtitle" className="mb-2">
            {getText('ensoDevtoolsFeatureFlags')}

            <Form
              gap="small"
              schema={FEATURE_FLAGS_SCHEMA}
              formOptions={{ mode: 'onChange' }}
              defaultValues={{
                enableMultitabs: featureFlags.enableMultitabs,
                enableAssetsTableBackgroundRefresh: featureFlags.enableAssetsTableBackgroundRefresh,
                assetsTableBackgroundRefreshInterval:
                  featureFlags.assetsTableBackgroundRefreshInterval,
              }}
            >
              {(form) => (
                <>
                  <Switch
                    form={form}
                    name="enableMultitabs"
                    label={getText('ensoDevtoolsFeatureFlags.enableMultitabs')}
                    description={getText('ensoDevtoolsFeatureFlags.enableMultitabsDescription')}
                    onChange={(value) => {
                      setFeatureFlags('enableMultitabs', value)
                    }}
                  />

                  <div>
                    <Switch
                      form={form}
                      name="enableAssetsTableBackgroundRefresh"
                      label={getText('ensoDevtoolsFeatureFlags.enableAssetsTableBackgroundRefresh')}
                      description={getText(
                        'ensoDevtoolsFeatureFlags.enableAssetsTableBackgroundRefreshDescription',
                      )}
                      onChange={(value) => {
                        setFeatureFlags('enableAssetsTableBackgroundRefresh', value)
                      }}
                    />
                    <Input
                      form={form}
                      type="number"
                      inputMode="numeric"
                      name="assetsTableBackgroundRefreshInterval"
                      label={getText(
                        'ensoDevtoolsFeatureFlags.assetsTableBackgroundRefreshInterval',
                      )}
                      description={getText(
                        'ensoDevtoolsFeatureFlags.assetsTableBackgroundRefreshIntervalDescription',
                      )}
                      onChange={(event) => {
                        setFeatureFlags(
                          'assetsTableBackgroundRefreshInterval',
                          event.target.valueAsNumber,
                        )
                      }}
                    />
                  </div>
                </>
              )}
            </Form>
          </Text>

          <Separator orientation="horizontal" className="my-3" />

          <Text variant="subtitle" className="mb-2">
            {getText('ensoDevtoolsPaywallFeaturesToggles')}
          </Text>

          <Form
            gap="small"
            schema={(z) =>
              z.object(Object.fromEntries(Object.keys(features).map((key) => [key, z.boolean()])))
            }
            defaultValues={Object.fromEntries(
              Object.keys(features).map((feature) => {
                // eslint-disable-next-line no-restricted-syntax
                const featureName = feature as PaywallFeatureName
                return [featureName, features[featureName].isForceEnabled ?? true]
              }),
            )}
          >
            {Object.keys(features).map((feature) => {
              // eslint-disable-next-line no-restricted-syntax
              const featureName = feature as PaywallFeatureName
              const { label, descriptionTextId } = getFeature(featureName)

              return (
                <Switch
                  key={feature}
                  name={featureName}
                  label={getText(label)}
                  description={getText(descriptionTextId)}
                  onChange={(value) => {
                    setFeature(featureName, value)
                  }}
                />
              )
            })}
          </Form>

          <Separator orientation="horizontal" className="my-3" />

          <div className="mb-2 flex w-full items-center justify-between">
            <Text variant="subtitle">{getText('localStorage')}</Text>

            <Button
              aria-label={getText('deleteAll')}
              size="small"
              variant="icon"
              icon={TrashIcon}
              onPress={() => {
                for (const key of LocalStorage.getAllKeys()) {
                  localStorage.delete(key)
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-0.5">
            {LocalStorage.getAllKeys().map((key) => (
              <div key={key} className="flex w-full items-center justify-between gap-1">
                <Text variant="body">
                  {key
                    .replace(/[A-Z]/g, (m) => ' ' + m.toLowerCase())
                    .replace(/^./, (m) => m.toUpperCase())}
                </Text>

                <Button
                  variant="icon"
                  size="small"
                  isDisabled={localStorageState[key] == null}
                  aria-label={getText('delete')}
                  icon={CrossIcon}
                  onPress={() => {
                    localStorage.delete(key)
                  }}
                />
              </div>
            ))}
          </div>
        </Popover>
      </DialogTrigger>
    </Portal>
  )
}
