/** @file The icon and name of a {@link DirectoryAsset}. */
import { useMutation } from '@tanstack/react-query'

import { isNewTitleValid, type DirectoryAsset } from '@common/services/Backend'
import { merger } from '@common/utilities/data/object'
import { isWhitespaceOnly } from '@common/utilities/data/string'

import FolderIcon from '#/assets/folder.svg'
import FolderArrowIcon from '#/assets/folder_arrow.svg'
import { Button } from '#/components/AriaComponents'
import type { AssetColumnProps } from '#/components/dashboard/column'
import EditableSpan from '#/components/EditableSpan'
import SvgMask from '#/components/SvgMask'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useStore } from '#/hooks/storeHooks'
import { useDriveStore, useToggleDirectoryExpansion } from '#/providers/DriveProvider'
import { useText } from '#/providers/TextProvider'
import { isSingleClick } from '#/utilities/event'
import { indentClass } from '#/utilities/indent'
import { twJoin, twMerge } from '#/utilities/tailwindMerge'
import { DIRECTORY_NAME_REGEX } from '#/utilities/validation'

/** Props for a {@link DirectoryNameColumn}. */
export interface DirectoryNameColumnProps extends AssetColumnProps {
  readonly item: DirectoryAsset
}

/**
 * The icon and name of a {@link DirectoryAsset}.
 * @throws {Error} when the asset is not a {@link DirectoryAsset}.
 * This should never happen.
 */
export default function DirectoryNameColumn(props: DirectoryNameColumnProps) {
  const { item, depth, selected, state, rowState, setRowState, isEditable } = props
  const { backend, nodeMap } = state
  const { getText } = useText()
  const driveStore = useDriveStore()
  const toggleDirectoryExpansion = useToggleDirectoryExpansion()
  const isExpanded = useStore(driveStore, (storeState) =>
    storeState.expandedDirectoryIds.includes(item.id),
  )

  const updateDirectoryMutation = useMutation(backendMutationOptions(backend, 'updateDirectory'))

  const setIsEditing = (isEditingName: boolean) => {
    if (isEditable) {
      setRowState(merger({ isEditingName }))
    }

    if (!isEditingName) {
      driveStore.setState({ newestFolderId: null })
    }
  }

  const doRename = async (newTitle: string) => {
    if (isEditable) {
      setIsEditing(false)
      if (!isWhitespaceOnly(newTitle) && newTitle !== item.title) {
        await updateDirectoryMutation.mutateAsync([item.id, { title: newTitle }, item.title])
      }
    }
  }

  return (
    <div
      className={twJoin(
        'group flex h-table-row w-auto min-w-48 max-w-96 items-center gap-name-column-icon whitespace-nowrap rounded-l-full px-name-column-x py-name-column-y contain-strict rounded-rows-child [contain-intrinsic-size:37px] [content-visibility:auto]',
        indentClass(depth),
      )}
      onKeyDown={(event) => {
        if (rowState.isEditingName && event.key === 'Enter') {
          event.stopPropagation()
        }
      }}
      onClick={(event) => {
        if (isSingleClick(event) && selected && driveStore.getState().selectedKeys.size === 1) {
          event.stopPropagation()
          setIsEditing(true)
        }
      }}
    >
      <Button
        icon={FolderArrowIcon}
        size="medium"
        variant="custom"
        aria-label={isExpanded ? getText('collapse') : getText('expand')}
        tooltipPlacement="left"
        className={twJoin(
          'm-0 hidden cursor-pointer border-0 transition-transform duration-arrow group-hover:m-name-column-icon group-hover:inline-block',
          isExpanded && 'rotate-90',
        )}
        onPress={() => {
          toggleDirectoryExpansion(item.id)
        }}
      />
      <SvgMask src={FolderIcon} className="m-name-column-icon size-4 group-hover:hidden" />
      <EditableSpan
        data-testid="asset-row-name"
        editable={rowState.isEditingName}
        className={twMerge(
          'cursor-pointer bg-transparent font-naming',
          rowState.isEditingName ? 'cursor-text' : 'cursor-pointer',
        )}
        checkSubmittable={(newTitle) =>
          DIRECTORY_NAME_REGEX.test(newTitle) &&
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
