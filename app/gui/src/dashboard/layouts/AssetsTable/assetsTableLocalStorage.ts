/** @file Local storage keys for the assets table. */
import { Column } from '#/components/dashboard/column/columnUtils'
import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const {
  useGet: useGetEnabledColumns,
  useSet: useSetEnabledColumns,
  useState: useEnabledColumnsState,
} = defineLocalStorageKey('enabledColumns', {
  schema: (z) => z.nativeEnum(Column).array().readonly(),
})
