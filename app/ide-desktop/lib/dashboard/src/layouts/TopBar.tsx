/** @file The top-bar of dashboard. */
import * as React from 'react'

import * as tailwindMerge from 'tailwind-merge'

import PageSwitcher, * as pageSwitcher from '#/layouts/PageSwitcher'
import UserBar from '#/layouts/UserBar'

import AssetInfoBar from '#/components/dashboard/AssetInfoBar'

import type * as backendModule from '#/services/Backend'

// ==============
// === TopBar ===
// ==============

/** Props for a {@link TopBar}. */
export interface TopBarProps {
  readonly isCloud: boolean
  readonly page: pageSwitcher.Page
  readonly setPage: (page: pageSwitcher.Page) => void
  readonly projectAsset: backendModule.ProjectAsset | null
  readonly setProjectAsset: React.Dispatch<React.SetStateAction<backendModule.ProjectAsset>> | null
  readonly isEditorDisabled: boolean
  readonly setIsHelpChatOpen: (isHelpChatOpen: boolean) => void
  readonly isAssetPanelVisible: boolean
  readonly isAssetPanelEnabled: boolean
  readonly setIsAssetPanelEnabled: React.Dispatch<React.SetStateAction<boolean>>
  readonly doRemoveSelf: () => void
  readonly onSignOut: () => void
}

/** The {@link TopBarProps.setQuery} parameter is used to communicate with the parent component,
 * because `searchVal` may change parent component's project list. */
export default function TopBar(props: TopBarProps) {
  const { isCloud, page, setPage, projectAsset, setProjectAsset } = props
  const { isEditorDisabled, setIsHelpChatOpen, isAssetPanelEnabled } = props
  const { isAssetPanelVisible, setIsAssetPanelEnabled, doRemoveSelf, onSignOut } = props

  const shouldMakeSpaceForExtendedEditorMenu = page === pageSwitcher.Page.editor

  return (
    <div className="relative z-1 m-top-bar mb flex h-row gap-top-bar">
      <PageSwitcher page={page} setPage={setPage} isEditorDisabled={isEditorDisabled} />
      <div
        className={tailwindMerge.twMerge(
          'grid transition-all duration-side-panel',
          isAssetPanelVisible ? 'grid-cols-0fr' : 'grid-cols-1fr'
        )}
      >
        <div className="invisible flex gap-top-bar-right overflow-hidden pointer-events-none-recursive">
          {page === pageSwitcher.Page.drive && (
            <AssetInfoBar
              invisible
              hidden={!isCloud}
              isAssetPanelEnabled={isAssetPanelEnabled}
              setIsAssetPanelEnabled={setIsAssetPanelEnabled}
            />
          )}
          <UserBar
            invisible
            page={page}
            setPage={setPage}
            setIsHelpChatOpen={setIsHelpChatOpen}
            projectAsset={projectAsset}
            setProjectAsset={setProjectAsset}
            doRemoveSelf={doRemoveSelf}
            onSignOut={onSignOut}
          />
        </div>
      </div>
      <div
        className={tailwindMerge.twMerge(
          'fixed top z-1 m-top-bar text-xs text-primary transition-all duration-side-panel',
          shouldMakeSpaceForExtendedEditorMenu && 'mr-extended-editor-menu',
          isAssetPanelVisible ? '-right-asset-panel-w' : 'right-0'
        )}
      >
        <div className="flex gap-top-bar-right">
          {page === pageSwitcher.Page.drive && (
            <AssetInfoBar
              hidden={!isCloud}
              isAssetPanelEnabled={isAssetPanelEnabled}
              setIsAssetPanelEnabled={setIsAssetPanelEnabled}
            />
          )}
          <UserBar
            page={page}
            setPage={setPage}
            setIsHelpChatOpen={setIsHelpChatOpen}
            projectAsset={projectAsset}
            setProjectAsset={setProjectAsset}
            doRemoveSelf={doRemoveSelf}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </div>
  )
}
