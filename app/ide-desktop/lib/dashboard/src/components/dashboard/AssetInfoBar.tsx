/** @file A toolbar for displaying asset information. */
import * as React from 'react'

import SettingsIcon from 'enso-assets/settings.svg'

import * as backendProvider from '#/providers/BackendProvider'

import Button from '#/components/Button'

import * as backendModule from '#/services/Backend'

/** Props for an {@link AssetInfoBar}. */
export interface AssetInfoBarProps {
  readonly isAssetPanelEnabled: boolean
  readonly setIsAssetPanelEnabled: React.Dispatch<React.SetStateAction<boolean>>
}

/** A menubar for displaying asset information. */
// This parameter will be used in the future.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AssetInfoBar(props: AssetInfoBarProps) {
  const {
    isAssetPanelEnabled: isAssetPanelVisible,
    setIsAssetPanelEnabled: setIsAssetPanelVisible,
  } = props
  const { backend } = backendProvider.useBackend()
  return (
    <div
      className={`pointer-events-auto flex h-row shrink-0 cursor-default items-center gap-icons rounded-full bg-frame px-icons-x ${
        backend.type === backendModule.BackendType.remote ? '' : 'invisible'
      }`}
      onClick={event => {
        event.stopPropagation()
      }}
    >
      <Button
        alt={isAssetPanelVisible ? 'Close Asset Panel' : 'Open Asset Panel'}
        active={isAssetPanelVisible}
        image={SettingsIcon}
        error="Select exactly one asset to see its settings."
        onClick={() => {
          setIsAssetPanelVisible(visible => !visible)
        }}
      />
    </div>
  )
}
