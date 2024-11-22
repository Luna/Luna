/** @file App-wide local storage keys. */
import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const {
  useGet: useGetInputBindings,
  useSet: useSetInputBindings,
  useState: useInputBindingsState,
} = defineLocalStorageKey('inputBindings', {
  schema: (z) =>
    z.record(z.string().array().readonly()).transform((value) =>
      Object.fromEntries(
        Object.entries<unknown>({ ...value }).flatMap((kv) => {
          const [k, v] = kv
          return Array.isArray(v) && v.every((item): item is string => typeof item === 'string') ?
              [[k, v]]
            : []
        }),
      ),
    ),
})

export const {
  useGet: useGetLocalRootDirectory,
  useSet: useSetLocalRootDirectory,
  useState: useLocalRootDirectoryState,
} = defineLocalStorageKey('localRootDirectory', {
  schema: (z) => z.string(),
})

export const {
  useGet: useGetAcceptedTermsOfServiceVersion,
  useSet: useSetAcceptedTermsOfServiceVersion,
  useState: useAcceptedTermsOfServiceVersionState,
} = defineLocalStorageKey('termsOfService', {
  schema: (z) => z.object({ versionHash: z.string() }),
})

export const {
  useGet: useGetAcceptedPrivacyPolicyVersion,
  useSet: useSetAcceptedPrivacyPolicyVersion,
  useState: useAcceptedPrivacyPolicyVersionState,
} = defineLocalStorageKey('privacyPolicy', {
  schema: (z) => z.object({ versionHash: z.string() }),
})
