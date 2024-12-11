/** @file Provider for enabling or disabling certain features. */
import * as z from 'zod'
import { createStore, useStore } from 'zustand'
import { persist } from 'zustand/middleware'

export const FEATURE_FLAGS_SCHEMA = z.object({
  enableMultitabs: z.boolean(),
  enableAssetsTableBackgroundRefresh: z.boolean(),
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  assetsTableBackgroundRefreshInterval: z.number().min(100),
})

/** Feature flags store. */
export interface FeatureFlags {
  readonly featureFlags: {
    readonly enableMultitabs: boolean
    readonly enableAssetsTableBackgroundRefresh: boolean
    readonly assetsTableBackgroundRefreshInterval: number
  }
  readonly setFeatureFlags: <Key extends keyof FeatureFlags['featureFlags']>(
    key: Key,
    value: FeatureFlags['featureFlags'][Key],
  ) => void
}

const flagsStore = createStore<FeatureFlags>()(
  persist(
    (set) => ({
      featureFlags: {
        enableMultitabs: false,
        enableAssetsTableBackgroundRefresh: true,
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        assetsTableBackgroundRefreshInterval: 3_000,
      },
      setFeatureFlags: (key, value) => {
        set(({ featureFlags }) => ({ featureFlags: { ...featureFlags, [key]: value } }))
      },
    }),
    { name: 'featureFlags' },
  ),
)

/** Hook to get all feature flags. */
export function useFeatureFlags() {
  return useStore(flagsStore, (state) => state.featureFlags)
}

/** Hook to get a specific feature flag. */
export function useFeatureFlag<Key extends keyof FeatureFlags['featureFlags']>(
  key: Key,
): FeatureFlags['featureFlags'][Key] {
  return useStore(flagsStore, ({ featureFlags }) => featureFlags[key])
}

/** Hook to set feature flags. */
export function useSetFeatureFlags() {
  return useStore(flagsStore, ({ setFeatureFlags }) => setFeatureFlags)
}

/**
 * Feature flags provider.
 * Gets feature flags from local storage and sets them in the store.
 * Also saves feature flags to local storage when they change.
 */
export function FeatureFlagsProvider({ children }: React.PropsWithChildren) {
  return children
}
