/** @file A panel containing the description and settings for an asset. */
import * as React from 'react'

import * as localStorageProvider from '#/providers/LocalStorageProvider'

import type * as assetEvent from '#/events/assetEvent'

import AssetProperties from '#/layouts/AssetProperties'
import AssetVersions from '#/layouts/AssetVersions'
import type Category from '#/layouts/CategorySwitcher/Category'
import type * as pageSwitcher from '#/layouts/PageSwitcher'
import UserBar from '#/layouts/UserBar'

import AssetInfoBar from '#/components/dashboard/AssetInfoBar'

import * as backend from '#/services/Backend'

import * as array from '#/utilities/array'
import type AssetTreeNode from '#/utilities/AssetTreeNode'
import LocalStorage from '#/utilities/LocalStorage'

// =====================
// === AssetPanelTab ===
// =====================

/** Determines the content of the {@link AssetPanel}. */
enum AssetPanelTab {
  properties = 'properties',
  versions = 'versions',
}

// ============================
// === Global configuration ===
// ============================

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly assetPanelTab: AssetPanelTab
  }
}

const TABS = Object.values(AssetPanelTab)
LocalStorage.registerKey('assetPanelTab', {
  tryParse: value => (array.includes(TABS, value) ? value : null),
})

// ==================
// === AssetPanel ===
// ==================

/** The subset of {@link AssetPanelProps} that are required to be supplied by the row. */
export interface AssetPanelRequiredProps {
  readonly item: AssetTreeNode
  readonly setItem: React.Dispatch<React.SetStateAction<AssetTreeNode>>
}

/** Props for an {@link AssetPanel}. */
export interface AssetPanelProps extends AssetPanelRequiredProps {
  readonly supportsLocalBackend: boolean
  readonly page: pageSwitcher.Page
  readonly setPage: (page: pageSwitcher.Page) => void
  readonly category: Category
  readonly isHelpChatOpen: boolean
  readonly setIsHelpChatOpen: React.Dispatch<React.SetStateAction<boolean>>
  readonly setVisibility: React.Dispatch<React.SetStateAction<boolean>>
  readonly dispatchAssetEvent: (event: assetEvent.AssetEvent) => void
  readonly projectAsset: backend.ProjectAsset | null
  readonly setProjectAsset: React.Dispatch<React.SetStateAction<backend.ProjectAsset>> | null
  readonly doRemoveSelf: () => void
  readonly onSignOut: () => void
}

/** A panel containing the description and settings for an asset. */
export default function AssetPanel(props: AssetPanelProps) {
  const { item, setItem, supportsLocalBackend, page, setPage, category } = props
  const { isHelpChatOpen, setIsHelpChatOpen, setVisibility } = props
  const { dispatchAssetEvent, projectAsset, setProjectAsset, doRemoveSelf, onSignOut } = props

  const { localStorage } = localStorageProvider.useLocalStorage()
  const [initialized, setInitialized] = React.useState(false)
  const [tab, setTab] = React.useState(() => {
    const savedTab = localStorage.get('assetPanelTab') ?? AssetPanelTab.properties
    if (
      (item.item.type === backend.AssetType.secret ||
        item.item.type === backend.AssetType.directory) &&
      savedTab === AssetPanelTab.versions
    ) {
      return AssetPanelTab.properties
    } else {
      return savedTab
    }
  })

  React.useEffect(() => {
    // This prevents secrets and directories always setting the tab to `properties`
    // (because they do not support the `versions` tab).
    if (initialized) {
      localStorage.set('assetPanelTab', tab)
    }
    // `initialized` is NOT a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, /* should never change */ localStorage])

  React.useEffect(() => {
    setInitialized(true)
  }, [])

  return (
    <div
      data-testid="asset-panel"
      className="absolute flex flex-col h-full border-black/[0.12] border-l-2 gap-asset-panel w-asset-panel p-top-bar-margin pl-asset-panel-l"
      onClick={event => {
        event.stopPropagation()
      }}
    >
      <div className="flex">
        {item.item.type !== backend.AssetType.secret &&
          item.item.type !== backend.AssetType.directory && (
            <button
              className={`rounded-full leading-cozy px-button-x select-none bg-frame hover:bg-selected-frame transition-colors ${
                tab !== AssetPanelTab.versions ? '' : 'bg-selected-frame'
              }`}
              onClick={() => {
                setTab(oldTab =>
                  oldTab === AssetPanelTab.versions
                    ? AssetPanelTab.properties
                    : AssetPanelTab.versions
                )
              }}
            >
              Versions
            </button>
          )}
        {/* Spacing. */}
        <div className="grow" />
        <div className="flex gap-top-bar-right">
          <AssetInfoBar
            canToggleAssetPanel={true}
            isAssetPanelVisible={true}
            setIsAssetPanelVisible={setVisibility}
          />
          <UserBar
            supportsLocalBackend={supportsLocalBackend}
            isHelpChatOpen={isHelpChatOpen}
            setIsHelpChatOpen={setIsHelpChatOpen}
            onSignOut={onSignOut}
            page={page}
            setPage={setPage}
            projectAsset={projectAsset}
            setProjectAsset={setProjectAsset}
            doRemoveSelf={doRemoveSelf}
          />
        </div>
      </div>
      {tab === AssetPanelTab.properties && (
        <AssetProperties
          item={item}
          setItem={setItem}
          category={category}
          dispatchAssetEvent={dispatchAssetEvent}
        />
      )}
      <AssetVersions hidden={tab !== AssetPanelTab.versions} item={item} />
    </div>
  )
}
