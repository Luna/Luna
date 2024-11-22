/** @file Local storage keys for feature flags. */
import * as z from 'zod'

import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const FEATURE_FLAGS_SCHEMA = z.object({
  enableMultitabs: z.boolean(),
  enableAssetsTableBackgroundRefresh: z.boolean(),
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  assetsTableBackgroundRefreshInterval: z.number().min(100),
})

export const {
  useGet: useGetFeatureFlags,
  useSet: useSetLocalStorageFeatureFlags,
  useState: useFeatureFlagsState,
} = defineLocalStorageKey('featureFlags', {
  schema: () => FEATURE_FLAGS_SCHEMA,
})
