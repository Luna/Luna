/** @file Utilities related to `AssetRow`s. */
import type * as assetsTable from '#/layouts/AssetsTable'

import { EMPTY_SET } from 'enso-common/src/utilities/data/set'

/** The default {@link assetsTable.AssetRowState} associated with an `AssetRow`. */
export const INITIAL_ROW_STATE: assetsTable.AssetRowState = Object.freeze({
  setVisibility: () => {
    // Ignored. This MUST be replaced by the row component. It should also update `visibility`.
  },
  isEditingName: false,
  temporarilyAddedLabels: EMPTY_SET,
  temporarilyRemovedLabels: EMPTY_SET,
})
