/** @file Local storage keys for the registration page. */
import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const {
  useGet: useGetLoginRedirect,
  useSet: useSetLoginRedirect,
  useDelete: useDeleteLoginRedirect,
  useState: useLoginRedirectState,
} = defineLocalStorageKey('loginRedirect', {
  isUserSpecific: true,
  schema: (z) => z.string(),
})
