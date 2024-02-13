/** @file The icon and name of a {@link backendModule.SecretAsset}. */
import * as React from 'react'

import KeyIcon from 'enso-assets/key.svg'

import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as modalProvider from '#/providers/ModalProvider'
import * as shortcutManagerProvider from '#/providers/ShortcutManagerProvider'

import UpsertSecretModal from '#/layouts/dashboard/UpsertSecretModal'

import type * as column from '#/components/dashboard/column'
import SvgMask from '#/components/SvgMask'

import * as backendModule from '#/services/Backend'

import * as eventModule from '#/utilities/event'
import * as indent from '#/utilities/indent'
import * as object from '#/utilities/object'
import * as shortcutManagerModule from '#/utilities/ShortcutManager'

// =====================
// === ConnectorName ===
// =====================

/** Props for a {@link SecretNameColumn}. */
export interface SecretNameColumnProps extends column.AssetColumnProps {}

/** The icon and name of a {@link backendModule.SecretAsset}.
 * @throws {Error} when the asset is not a {@link backendModule.SecretAsset}.
 * This should never happen. */
export default function SecretNameColumn(props: SecretNameColumnProps) {
  const { item, selected, rowState, setRowState } = props
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const { setModal } = modalProvider.useSetModal()
  const { shortcutManager } = shortcutManagerProvider.useShortcutManager()
  const smartAsset = item.item
  if (smartAsset.type !== backendModule.AssetType.secret) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error('`SecretNameColumn` can only display secrets.')
  }
  const asset = smartAsset.value

  return (
    <div
      className={`flex text-left items-center whitespace-nowrap rounded-l-full gap-1 px-1.5 py-1 min-w-max ${indent.indentClass(
        item.depth
      )}`}
      onKeyDown={event => {
        if (rowState.isEditingName && event.key === 'Enter') {
          event.stopPropagation()
        }
      }}
      onClick={event => {
        if (
          eventModule.isSingleClick(event) &&
          (selected ||
            shortcutManager.matchesMouseAction(shortcutManagerModule.MouseAction.editName, event))
        ) {
          setRowState(object.merger({ isEditingName: true }))
        } else if (eventModule.isDoubleClick(event)) {
          event.stopPropagation()
          setModal(
            <UpsertSecretModal
              id={asset.id}
              name={asset.title}
              doCreate={async (_name, value) => {
                try {
                  await smartAsset.update({ value })
                } catch (error) {
                  toastAndLog(null, error)
                }
              }}
            />
          )
        }
      }}
    >
      <SvgMask src={KeyIcon} className="h-4 w-4 m-1" />
      {/* Secrets cannot be renamed. */}
      <span data-testid="asset-row-name" className="bg-transparent grow leading-170 h-6 py-px">
        {asset.title}
      </span>
    </div>
  )
}
