/** @file Provider for enabling or disabling certain features. */
import { useEffect, type ReactNode } from 'react'

import { createStore, useStore } from 'zustand'

import { useMount } from '#/hooks/mountHooks'
import { unsafeEntries } from '#/utilities/object'
import {
  useGetFeatureFlags,
  useSetLocalStorageFeatureFlags,
} from './FeatureFlagsProvider/featureFlagsLocalStorage'
import { useLocalStorage } from './LocalStorageProvider'
export { FEATURE_FLAGS_SCHEMA } from './FeatureFlagsProvider/featureFlagsLocalStorage'

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

const flagsStore = createStore<FeatureFlags>((set) => ({
  featureFlags: {
    enableMultitabs: false,
    enableAssetsTableBackgroundRefresh: true,
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    assetsTableBackgroundRefreshInterval: 3_000,
  },
  setFeatureFlags: (key, value) => {
    set(({ featureFlags }) => {
      const newFlags = { ...featureFlags, [key]: value }
      return { featureFlags: newFlags }
    })
  },
}))

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
export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { localStorage } = useLocalStorage()
  const getFeatureFlags = useGetFeatureFlags()
  const setFeatureFlags = useSetFeatureFlags()
  const setLocalStorageFeatureFlags = useSetLocalStorageFeatureFlags()

  useMount(() => {
    const storedFeatureFlags = getFeatureFlags()

    if (storedFeatureFlags != null) {
      for (const [key, value] of unsafeEntries(storedFeatureFlags)) {
        setFeatureFlags(key, value)
      }
    }
  })

  useEffect(
    () =>
      flagsStore.subscribe((state, prevState) => {
        if (state.featureFlags !== prevState.featureFlags) {
          setLocalStorageFeatureFlags(state.featureFlags)
        }
      }),
    [localStorage, setLocalStorageFeatureFlags],
  )

  return <>{children}</>
}
