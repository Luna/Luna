/**
 * @file
 *
 * Feature flags provider.
 * Feature flags are used to enable or disable certain features in the application.
 */
import { IS_DEV_MODE, isOnElectron } from 'enso-common/src/detect'
import { z } from 'zod'
import { createStore, useStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { unsafeWriteValue } from '../utilities/write'

export const FEATURE_FLAGS_SCHEMA = z.object({
  enableMultitabs: z.boolean(),
  enableAssetsTableBackgroundRefresh: z.boolean(),
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  assetsTableBackgroundRefreshInterval: z.number().min(100),
  enableCloudExecution: z.boolean(),
  newProjectButtonView: z.enum(['tab_bar', 'expand', 'popover', 'button_with_popover', 'table']),
})

/** Feature flags. */
export type FeatureFlags = z.infer<typeof FEATURE_FLAGS_SCHEMA>

/** Feature flags store. */
export interface FeatureFlagsStore {
  readonly featureFlags: FeatureFlags
  readonly setFeatureFlags: <Key extends keyof FeatureFlags>(
    key: Key,
    value: FeatureFlags[Key],
  ) => void
}

const flagsStore = createStore<FeatureFlagsStore>()(
  persist(
    (set) => ({
      featureFlags: {
        enableMultitabs: false,
        enableAssetsTableBackgroundRefresh: true,
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        assetsTableBackgroundRefreshInterval: 3_000,
        enableCloudExecution: IS_DEV_MODE || isOnElectron(),
        newProjectButtonView: 'expand',
      },
      setFeatureFlags: (key, value) => {
        set(({ featureFlags }) => ({ featureFlags: { ...featureFlags, [key]: value } }))
      },
    }),
    {
      name: 'featureFlags',
      version: 1,
      merge: (persistedState, newState) => {
        /**
         * Mutates the state with provided feature flags
         */
        function unsafeMutateFeatureFlags(flags: Partial<FeatureFlags>) {
          unsafeWriteValue(newState, 'featureFlags', {
            ...newState.featureFlags,
            ...flags,
          })
        }

        const parsedPersistedState = FEATURE_FLAGS_SCHEMA.safeParse(persistedState)

        if (parsedPersistedState.success) {
          unsafeMutateFeatureFlags(parsedPersistedState.data)
        }

        if (typeof window !== 'undefined') {
          const predefinedFeatureFlags = FEATURE_FLAGS_SCHEMA.partial().safeParse(
            window.overrideFeatureFlags,
          )

          if (predefinedFeatureFlags.success) {
            const withOmittedUndefined = Object.fromEntries(
              Object.entries(predefinedFeatureFlags.data).filter(([, value]) => value != null),
            )
            // This is safe, because zod omits unset values.
            unsafeMutateFeatureFlags(withOmittedUndefined)
          }
        }

        return newState
      },
    },
  ),
)

/** Hook to get all feature flags. */
export function useFeatureFlags() {
  return useStore(flagsStore, (state) => state.featureFlags)
}

/** Hook to get a specific feature flag. */
export function useFeatureFlag<Key extends keyof FeatureFlagsStore['featureFlags']>(
  key: Key,
): FeatureFlagsStore['featureFlags'][Key] {
  return useStore(flagsStore, ({ featureFlags }) => featureFlags[key])
}

/**
 * Props for {@link WithFeatureFlag}.
 */
interface WithFeatureFlagProps<Key extends keyof FeatureFlagsStore['featureFlags']> {
  readonly flag: Key
  readonly showIf?:
    | FeatureFlagsStore['featureFlags'][Key]
    | FeatureFlagsStore['featureFlags'][Key][]
    | ((value: FeatureFlagsStore['featureFlags'][Key]) => boolean)
  readonly fallback?: React.ReactNode
  readonly children: React.ReactNode
}

/**
 * Displays a component only if a feature flag is enabled or has a specific value.
 */
export function WithFeatureFlag<Key extends keyof FeatureFlagsStore['featureFlags']>(
  props: WithFeatureFlagProps<Key>,
) {
  const { flag, showIf = (value) => Boolean(value), children, fallback = null } = props

  const featureFlagValue = useFeatureFlag(flag)

  const shouldShow = () => {
    if (typeof showIf === 'function') {
      return showIf(featureFlagValue)
    }

    if (Array.isArray(showIf)) {
      return showIf.includes(featureFlagValue)
    }

    return showIf === featureFlagValue
  }

  return shouldShow() ? children : fallback
}

/** Hook to set feature flags. */
export function useSetFeatureFlags() {
  return useStore(flagsStore, ({ setFeatureFlags }) => setFeatureFlags)
}

// Define global API for managing feature flags
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'featureFlags', {
    value: flagsStore.getState().featureFlags,
    configurable: false,
    writable: false,
  })

  Object.defineProperty(window, 'setFeatureFlags', {
    value: flagsStore.getState().setFeatureFlags,
    configurable: false,
    writable: false,
  })
}
