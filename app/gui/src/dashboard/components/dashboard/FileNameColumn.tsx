/** @file The icon and name of a {@link FileAsset}. */
import { useMutation } from '@tanstack/react-query'

import { BackendType, isNewTitleValid, type FileAsset } from 'enso-common/src/services/Backend'
import { merger } from 'enso-common/src/utilities/data/object'
import { isWhitespaceOnly } from 'enso-common/src/utilities/data/string'

import type { AssetColumnProps } from '#/components/dashboard/column'
import EditableSpan from '#/components/EditableSpan'
import SvgMask from '#/components/SvgMask'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { isSingleClick } from '#/utilities/event'
import { fileIcon } from '#/utilities/fileIcon'
import { indentClass } from '#/utilities/indent'
import { twJoin } from '#/utilities/tailwindMerge'

/** Props for a {@link FileNameColumn}. */
export interface FileNameColumnProps extends AssetColumnProps {
  readonly item: FileAsset
}

/**
 * The icon and name of a {@link FileAsset}.
 * @throws {Error} when the asset is not a {@link FileAsset}.
 * This should never happen.
 */
export default function FileNameColumn(props: FileNameColumnProps) {
  const { item, selected, state, rowState, setRowState, isEditable, depth } = props
  const { backend, nodeMap } = state
  const isCloud = backend.type === BackendType.remote

  const updateFileMutation = useMutation(backendMutationOptions(backend, 'updateFile'))

  const setIsEditing = (isEditingName: boolean) => {
    if (isEditable) {
      setRowState(merger({ isEditingName }))
    }
  }

  // TODO[sb]: Wait for backend implementation. `editable` should also be re-enabled, and the
  // context menu entry should be re-added.
  // Backend implementation is tracked here: https://github.com/enso-org/cloud-v2/issues/505.
  const doRename = async (newTitle: string) => {
    if (isEditable) {
      setIsEditing(false)
      if (isWhitespaceOnly(newTitle)) {
        // Do nothing.
      } else if (!isCloud && newTitle !== item.title) {
        await updateFileMutation.mutateAsync([item.id, { title: newTitle }, item.title])
      }
    }
  }

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
          if (!isCloud) {
            setIsEditing(true)
          }
        }
      }}
    >
      <SvgMask src={fileIcon()} className="m-name-column-icon size-4" />
      <EditableSpan
        data-testid="asset-row-name"
        editable={rowState.isEditingName}
        className="grow bg-transparent font-naming"
        checkSubmittable={(newTitle) =>
          isNewTitleValid(
            item,
            newTitle,
            nodeMap.current.get(item.parentId)?.children?.map((child) => child.item),
          )
        }
        onSubmit={doRename}
        onCancel={() => {
          setIsEditing(false)
        }}
      >
        {item.title}
      </EditableSpan>
    </div>
  )
}
