/** @file Local storage keys for the category switcher. */
import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const { use: useLocalRootDirectories, useState: useLocalRootDirectoriesState } =
  defineLocalStorageKey('localRootDirectories', {
    schema: (z) => z.string().array().readonly(),
  })
