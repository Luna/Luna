/** @file Local storage keys for the registration page. */
import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const { use: useLoginRedirect, useState: useLoginRedirectState } = defineLocalStorageKey(
  'loginRedirect',
  {
    isUserSpecific: true,
    schema: (z) => z.string(),
  },
)
