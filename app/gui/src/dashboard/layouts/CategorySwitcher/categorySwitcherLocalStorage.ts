/** @file Local storage keys for the category switcher. */
import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const {
  useGet: useGetLocalRootDirectories,
  useSet: useSetLocalRootDirectories,
  useState: useLocalRootDirectoriesState,
} = defineLocalStorageKey('localRootDirectories', {
  schema: (z) => z.string().array().readonly(),
})
