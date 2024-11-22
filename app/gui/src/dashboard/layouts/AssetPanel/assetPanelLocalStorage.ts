/** @file Local storage keys for the asset panel. */
import { ASSET_PANEL_TABS } from '#/layouts/AssetPanel/types'
import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

export const { get: getAssetPanelTab, set: setAssetPanelTab } = defineLocalStorageKey(
  'assetPanelTab',
  { schema: (z) => z.enum(ASSET_PANEL_TABS) },
)

export const { get: getAssetPanelWidth, set: setAssetPanelWidth } = defineLocalStorageKey(
  'assetPanelWidth',
  { schema: (z) => z.number().int() },
)

export const { get: getIsAssetPanelHidden, set: setIsAssetPanelHidden } = defineLocalStorageKey(
  'isAssetPanelHidden',
  { schema: (z) => z.boolean() },
)

export const { get: getIsAssetPanelVisible, set: setIsAssetPanelVisible } = defineLocalStorageKey(
  'isAssetPanelVisible',
  { schema: (z) => z.boolean() },
)
