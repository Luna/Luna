/** @file The icon and name of a {@link ProjectAsset}. */
import { useMutation } from '@tanstack/react-query'

import { isOnMacOS } from 'enso-common/src/detect'
import {
  BackendType,
  IS_OPENING_OR_OPENED,
  isNewTitleValid,
  type ProjectAsset,
} from 'enso-common/src/services/Backend'
import { merger } from 'enso-common/src/utilities/data/object'
import { isWhitespaceOnly } from 'enso-common/src/utilities/data/string'

import type { AssetColumnProps } from '#/components/dashboard/column'
import ProjectIcon, { CLOSED_PROJECT_STATE } from '#/components/dashboard/ProjectIcon'
import EditableSpan from '#/components/EditableSpan'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useOpenProject } from '#/hooks/projectHooks'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useDriveStore } from '#/providers/DriveProvider'
import { useText } from '#/providers/TextProvider'
import { isDoubleClick, isSingleClick } from '#/utilities/event'
import { indentClass } from '#/utilities/indent'
import { PERMISSION_ACTION_CAN_EXECUTE, tryFindSelfPermission } from '#/utilities/permissions'
import { twJoin, twMerge } from '#/utilities/tailwindMerge'
import { LOCAL_PROJECT_NAME_PATTERN } from '#/utilities/validation'

/** Props for a {@link ProjectNameColumn}. */
export interface ProjectNameColumnProps extends AssetColumnProps {
  readonly item: ProjectAsset
}

/**
 * The icon and name of a {@link ProjectAsset}.
 * @throws {Error} when the asset is not a {@link ProjectAsset}.
 * This should never happen.
 */
export default function ProjectNameColumn(props: ProjectNameColumnProps) {
  const {
    item,
    selected,
    rowState,
    setRowState,
    state,
    isEditable,
    backendType,
    isOpened,
    isPlaceholder,
  } = props
  const { depth } = props
  const { backend, nodeMap } = state

  const { user } = useFullUserSession()
  const { getText } = useText()
  const driveStore = useDriveStore()
  const doOpenProject = useOpenProject()
  const ownPermission = tryFindSelfPermission(user, item.permissions)
  // This is a workaround for a temporary bad state in the backend causing the `projectState` key
  // to be absent.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const projectState = item.projectState ?? CLOSED_PROJECT_STATE
  const isRunning = IS_OPENING_OR_OPENED[projectState.type]
  const canExecute =
    isEditable &&
    (backend.type === BackendType.local ||
      (ownPermission != null && PERMISSION_ACTION_CAN_EXECUTE[ownPermission.permission]))
  const isCloud = backend.type === BackendType.remote
  const isOtherUserUsingProject =
    isCloud && projectState.openedBy != null && projectState.openedBy !== user.email

  const updateProjectMutation = useMutation(backendMutationOptions(backend, 'updateProject'))

  const setIsEditing = (isEditingName: boolean) => {
    if (isEditable) {
      setRowState(merger({ isEditingName }))
    }
  }

  const doRename = async (newTitle: string) => {
    setIsEditing(false)

    if (isWhitespaceOnly(newTitle)) {
      // Do nothing.
    } else if (newTitle !== item.title) {
      await updateProjectMutation.mutateAsync([
        item.id,
        { ami: null, ideVersion: null, projectName: newTitle },
        item.title,
      ])
    }
  }

  return (
    <div
      className={twJoin(
        'flex h-table-row w-auto min-w-48 max-w-96 items-center gap-name-column-icon whitespace-nowrap rounded-l-full px-name-column-x py-name-column-y contain-strict rounded-rows-child [contain-intrinsic-size:37px] [content-visibility:auto]',
        indentClass(depth),
      )}
      onKeyDown={(event) => {
        if (rowState.isEditingName && isOnMacOS() && event.key === 'Enter') {
          event.stopPropagation()
        }
      }}
      onClick={(event) => {
        if (rowState.isEditingName || isOtherUserUsingProject) {
          // The project should neither be edited nor opened in these cases.
        } else if (
          !isRunning &&
          isSingleClick(event) &&
          selected &&
          driveStore.getState().selectedKeys.size === 1
        ) {
          setIsEditing(true)
        } else if (isDoubleClick(event) && canExecute) {
          doOpenProject({
            id: item.id,
            type: backendType,
            parentId: item.parentId,
            title: item.title,
          })
        }
      }}
    >
      <ProjectIcon
        isDisabled={!canExecute}
        isOpened={isOpened}
        backend={backend}
        item={item}
        isPlaceholder={isPlaceholder}
      />

      <EditableSpan
        data-testid="asset-row-name"
        editable={rowState.isEditingName}
        className={twMerge(
          'grow bg-transparent font-naming',
          canExecute && !isOtherUserUsingProject && 'cursor-pointer',
          rowState.isEditingName && 'cursor-text',
        )}
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
        {...(backend.type === BackendType.local ?
          {
            inputPattern: LOCAL_PROJECT_NAME_PATTERN,
            inputTitle: getText('projectNameCannotBeEmpty'),
          }
        : {})}
      >
        {item.title}
      </EditableSpan>
    </div>
  )
}
