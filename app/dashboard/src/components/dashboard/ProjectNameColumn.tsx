/** @file The icon and name of a {@link backendModule.ProjectAsset}. */
import { useMutation } from '@tanstack/react-query'

import NetworkIcon from '#/assets/network.svg'

import { backendMutationOptions } from '#/hooks/backendHooks'
import * as projectHooks from '#/hooks/projectHooks'
import * as setAssetHooks from '#/hooks/setAssetHooks'
import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as authProvider from '#/providers/AuthProvider'
import { useDriveStore } from '#/providers/DriveProvider'
import * as inputBindingsProvider from '#/providers/InputBindingsProvider'
import * as textProvider from '#/providers/TextProvider'

import type * as column from '#/components/dashboard/column'
import ProjectIcon from '#/components/dashboard/ProjectIcon'
import EditableSpan from '#/components/EditableSpan'
import SvgMask from '#/components/SvgMask'

import * as backendModule from '#/services/Backend'

import * as eventModule from '#/utilities/event'
import * as indent from '#/utilities/indent'
import * as object from '#/utilities/object'
import * as permissions from '#/utilities/permissions'
import * as string from '#/utilities/string'
import * as tailwindMerge from '#/utilities/tailwindMerge'
import * as validation from '#/utilities/validation'
import { isOnMacOS } from 'enso-common/src/detect'

// ===================
// === ProjectName ===
// ===================

/** Props for a {@link ProjectNameColumn}. */
export interface ProjectNameColumnProps extends column.AssetColumnProps {}

/** The icon and name of a {@link backendModule.ProjectAsset}.
 * @throws {Error} when the asset is not a {@link backendModule.ProjectAsset}.
 * This should never happen. */
export default function ProjectNameColumn(props: ProjectNameColumnProps) {
  const {
    item,
    setItem,
    selected,
    rowState,
    setRowState,
    state,
    isEditable,
    backendType,
    isOpened,
  } = props
  const { backend, nodeMap } = state

  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const { user } = authProvider.useFullUserSession()
  const { getText } = textProvider.useText()
  const inputBindings = inputBindingsProvider.useInputBindings()
  const driveStore = useDriveStore()
  const doOpenProject = projectHooks.useOpenProject()

  if (item.type !== backendModule.AssetType.project) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error('`ProjectNameColumn` can only display projects.')
  }

  const asset = item.item
  const setAsset = setAssetHooks.useSetAsset(asset, setItem)
  const ownPermission =
    asset.permissions?.find(
      backendModule.isUserPermissionAnd((permission) => permission.user.userId === user.userId),
    ) ?? null
  // This is a workaround for a temporary bad state in the backend causing the `projectState` key
  // to be absent.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const projectState = asset.projectState ?? {
    type: backendModule.ProjectState.closed,
  }
  const isRunning = backendModule.IS_OPENING_OR_OPENED[projectState.type]
  const canExecute =
    isEditable &&
    (backend.type === backendModule.BackendType.local ||
      (ownPermission != null &&
        permissions.PERMISSION_ACTION_CAN_EXECUTE[ownPermission.permission]))
  const isCloud = backend.type === backendModule.BackendType.remote
  const isOtherUserUsingProject =
    isCloud && projectState.openedBy != null && projectState.openedBy !== user.email

  const updateProjectMutation = useMutation(backendMutationOptions(backend, 'updateProject'))

  const setIsEditing = (isEditingName: boolean) => {
    if (isEditable) {
      setRowState(object.merger({ isEditingName }))
    }
  }

  const doRename = async (newTitle: string) => {
    setIsEditing(false)

    if (string.isWhitespaceOnly(newTitle)) {
      // Do nothing.
    } else if (newTitle !== asset.title) {
      const oldTitle = asset.title
      setAsset(object.merger({ title: newTitle }))
      try {
        await updateProjectMutation.mutateAsync([
          asset.id,
          { ami: null, ideVersion: null, projectName: newTitle },
          asset.title,
        ])
      } catch (error) {
        toastAndLog('renameProjectError', error)
        setAsset(object.merger({ title: oldTitle }))
      }
    }
  }

  const handleClick = inputBindings.handler({
    editName: () => {
      setIsEditing(true)
    },
  })

  return (
    <div
      className={tailwindMerge.twMerge(
        'flex h-table-row min-w-max items-center gap-name-column-icon whitespace-nowrap rounded-l-full px-name-column-x py-name-column-y',
        indent.indentClass(item.depth),
      )}
      onKeyDown={(event) => {
        if (rowState.isEditingName && isOnMacOS() && event.key === 'Enter') {
          event.stopPropagation()
        }
      }}
      onClick={(event) => {
        if (rowState.isEditingName || isOtherUserUsingProject) {
          // The project should neither be edited nor opened in these cases.
        } else if (handleClick(event)) {
          // Already handled.
        } else if (
          !isRunning &&
          eventModule.isSingleClick(event) &&
          selected &&
          driveStore.getState().selectedKeys.size === 1
        ) {
          setIsEditing(true)
        } else if (eventModule.isDoubleClick(event)) {
          doOpenProject({
            id: asset.id,
            type: backendType,
            parentId: asset.parentId,
            title: asset.title,
          })
        }
      }}
    >
      {!canExecute ?
        <SvgMask src={NetworkIcon} className="m-name-column-icon size-4" />
      : <ProjectIcon
          isOpened={isOpened}
          backend={backend}
          // This is a workaround for a temporary bad state in the backend causing the
          // `projectState` key to be absent.
          item={object.merge(asset, { projectState })}
        />
      }
      <EditableSpan
        data-testid="asset-row-name"
        editable={rowState.isEditingName}
        className={tailwindMerge.twMerge(
          'grow bg-transparent font-naming',
          canExecute && !isOtherUserUsingProject && 'cursor-pointer',
          rowState.isEditingName && 'cursor-text',
        )}
        checkSubmittable={(newTitle) =>
          item.isNewTitleValid(newTitle, nodeMap.current.get(item.directoryKey)?.children)
        }
        onSubmit={doRename}
        onCancel={() => {
          setIsEditing(false)
        }}
        {...(backend.type === backendModule.BackendType.local ?
          {
            inputPattern: validation.LOCAL_PROJECT_NAME_PATTERN,
            inputTitle: getText('projectNameCannotBeEmpty'),
          }
        : {})}
      >
        {asset.title}
      </EditableSpan>
    </div>
  )
}
