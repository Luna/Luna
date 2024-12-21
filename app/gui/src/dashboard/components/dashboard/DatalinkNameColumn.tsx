/** @file The icon and name of a {@link DatalinkAsset}. */
import type { DatalinkAsset } from '@common/services/Backend'
import { merger } from '@common/utilities/data/object'

import DatalinkIcon from '#/assets/datalink.svg'
import type { AssetColumnProps } from '#/components/dashboard/column'
import EditableSpan from '#/components/EditableSpan'
import { useSetIsAssetPanelTemporarilyVisible } from '#/layouts/AssetPanel'
import { isDoubleClick, isSingleClick } from '#/utilities/event'
import { indentClass } from '#/utilities/indent'
import { twJoin } from '#/utilities/tailwindMerge'

/** Props for a {@link DatalinkNameColumn}. */
export interface DatalinkNameColumnProps extends AssetColumnProps {
  readonly item: DatalinkAsset
}

/** The icon and name of a {@link DatalinkAsset}. */
export default function DatalinkNameColumn(props: DatalinkNameColumnProps) {
  const { item, selected, rowState, setRowState, isEditable, depth } = props
  const setIsAssetPanelTemporarilyVisible = useSetIsAssetPanelTemporarilyVisible()

  const setIsEditing = (isEditingName: boolean) => {
    if (isEditable) {
      setRowState(merger({ isEditingName }))
    }
  }

  // TODO[sb]: Wait for backend implementation. `editable` should also be re-enabled, and the
  // context menu entry should be re-added.
  // Backend implementation is tracked here: https://github.com/enso-org/cloud-v2/issues/505.
  const doRename = () => Promise.resolve(null)

  return (
    <div
      className={twJoin(
        'flex h-table-row w-auto min-w-48 max-w-96 items-center gap-name-column-icon whitespace-nowrap rounded-l-full px-name-column-x py-name-column-y contain-strict rounded-rows-child [contain-intrinsic-size:37px] [content-visibility:auto]',
        indentClass(depth),
      )}
      onKeyDown={(event) => {
        if (rowState.isEditingName && event.key === 'Enter') {
          event.stopPropagation()
        }
      }}
      onClick={(event) => {
        if (isSingleClick(event) && selected) {
          setIsEditing(true)
        } else if (isDoubleClick(event)) {
          event.stopPropagation()
          setIsAssetPanelTemporarilyVisible(true)
        }
      }}
    >
      <img src={DatalinkIcon} className="m-name-column-icon size-4" />
      <EditableSpan
        editable={false}
        onSubmit={async (newTitle) => {
          setIsEditing(false)

          if (newTitle !== item.title) {
            await doRename()
          }
        }}
        onCancel={() => {
          setIsEditing(false)
        }}
        className="grow bg-transparent font-naming"
      >
        {item.title}
      </EditableSpan>
    </div>
  )
}
