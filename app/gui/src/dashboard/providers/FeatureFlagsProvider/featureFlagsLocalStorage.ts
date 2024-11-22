/** @file Local storage keys for feature flags. */
import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const {
  useGet: useGetFeatureFlags,
  useSet: useSetLocalStorageFeatureFlags,
  useState: useFeatureFlagsState,
} = defineLocalStorageKey('featureFlags', {
  schema: (z) =>
    z.object({
      enableMultitabs: z.boolean(),
      enableAssetsTableBackgroundRefresh: z.boolean(),
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      assetsTableBackgroundRefreshInterval: z.number().min(100),
    }),
})
