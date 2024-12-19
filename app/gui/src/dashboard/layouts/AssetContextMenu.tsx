/** @file The context menu for an arbitrary {@link Asset}. */
import type { MouseEvent, MutableRefObject } from 'react'

import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'

import {
  assetIsProject,
  AssetType,
  IS_OPENING_OR_OPENED,
  Plan,
  type Asset,
  type DirectoryId,
  type ProjectId,
} from '@common/services/Backend'
import { normalizePath } from '@common/utilities/data/fileInfo'
import { mapNonNullish } from '@common/utilities/data/nullable'
import { merger } from '@common/utilities/data/object'

import ContextMenu from '#/components/ContextMenu'
import ContextMenuEntry from '#/components/ContextMenuEntry'
import type * as assetRow from '#/components/dashboard/AssetRow'
import { ContextMenuEntry as PaywallContextMenuEntry } from '#/components/Paywall'
import Separator from '#/components/styled/Separator'
import AssetEventType from '#/events/AssetEventType'
import AssetListEventType from '#/events/AssetListEventType'
import { useNewProject, useUploadFileWithToastMutation } from '#/hooks/backendHooks'
import { usePaywall } from '#/hooks/billing'
import { useCopy } from '#/hooks/copyHooks'
import {
  createGetProjectDetailsQuery,
  useCanOpenProjects,
  useCloseProject,
  useOpenProject,
  useOpenProjectMutation,
} from '#/hooks/projectHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { isCloudCategory } from '#/layouts/CategorySwitcher/Category'
import { useDispatchAssetEvent, useDispatchAssetListEvent } from '#/layouts/Drive/EventListProvider'
import { GlobalContextMenu } from '#/layouts/GlobalContextMenu'
import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'
import ManageLabelsModal from '#/modals/ManageLabelsModal'
import ManagePermissionsModal from '#/modals/ManagePermissionsModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useLocalBackend, useRemoteBackend } from '#/providers/BackendProvider'
import { usePasteData } from '#/providers/DriveProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import {
  canPermissionModifyDirectoryContents,
  isTeamPath,
  PERMISSION_ACTION_CAN_EXECUTE,
  PermissionAction,
  tryFindSelfPermission,
} from '#/utilities/permissions'
import { extractTypeAndId } from '@common/services/LocalBackend'
import { TEAMS_DIRECTORY_ID, USERS_DIRECTORY_ID } from '@common/services/remoteBackendPaths'
import { useSetAssetPanelProps, useSetIsAssetPanelTemporarilyVisible } from './AssetPanel'

/** Props for a {@link AssetContextMenu}. */
export interface AssetContextMenuProps {
  readonly hidden?: boolean
  readonly innerProps: assetRow.AssetRowInnerProps
  readonly rootDirectoryId: DirectoryId
  readonly triggerRef: MutableRefObject<HTMLElement | null>
  readonly event: Pick<MouseEvent, 'pageX' | 'pageY'>
  readonly eventTarget: HTMLElement | null
  readonly doDelete: () => void
  readonly doCopy: () => void
  readonly doCut: () => void
  readonly doPaste: (newParentKey: DirectoryId, newParentId: DirectoryId) => void
}

/** The context menu for an arbitrary {@link Asset}. */
export default function AssetContextMenu(props: AssetContextMenuProps) {
  const { innerProps, rootDirectoryId, event, eventTarget, hidden = false, triggerRef } = props
  const { doCopy, doCut, doPaste, doDelete } = props
  const { asset, path: pathRaw, state, setRowState } = innerProps
  const { backend, category, nodeMap } = state

  const canOpenProjects = useCanOpenProjects()
  const { user } = useFullUserSession()
  const { setModal } = useSetModal()
  const remoteBackend = useRemoteBackend()
  const localBackend = useLocalBackend()
  const { getText } = useText()
  const toastAndLog = useToastAndLog()
  const dispatchAssetEvent = useDispatchAssetEvent()
  const dispatchAssetListEvent = useDispatchAssetListEvent()
  const setIsAssetPanelTemporarilyVisible = useSetIsAssetPanelTemporarilyVisible()
  const setAssetPanelProps = useSetAssetPanelProps()
  const openProject = useOpenProject()
  const closeProject = useCloseProject()
  const openProjectMutation = useOpenProjectMutation()
  const self = tryFindSelfPermission(user, asset.permissions)
  const isCloud = isCloudCategory(category)
  const pathComputed =
    category.type === 'recent' || category.type === 'trash' ? null
    : isCloud ? `${pathRaw}${asset.type === AssetType.datalink ? '.datalink' : ''}`
    : asset.type === AssetType.project ?
      mapNonNullish(localBackend?.getProjectPath(asset.id) ?? null, normalizePath)
    : normalizePath(extractTypeAndId(asset.id).id)
  const path =
    pathComputed == null ? null
    : isCloud ? encodeURI(pathComputed)
    : pathComputed
  const copyMutation = useCopy({ copyText: path ?? '' })
  const uploadFileToCloudMutation = useUploadFileWithToastMutation(remoteBackend)
  const disabledTooltip = !canOpenProjects ? getText('downloadToOpenWorkflow') : undefined

  const { isFeatureUnderPaywall } = usePaywall({ plan: user.plan })
  const isUnderPaywall = isFeatureUnderPaywall('share')

  const newProject = useNewProject(backend, category)

  const systemApi = window.systemApi
  const ownsThisAsset = !isCloud || self?.permission === PermissionAction.own
  const canManageThisAsset = asset.id !== USERS_DIRECTORY_ID && asset.id !== TEAMS_DIRECTORY_ID
  const managesThisAsset = ownsThisAsset || self?.permission === PermissionAction.admin
  const canEditThisAsset = managesThisAsset || self?.permission === PermissionAction.edit
  const canAddToThisDirectory =
    category.type !== 'recent' && asset.type === AssetType.directory && canEditThisAsset
  const pasteData = usePasteData()
  const hasPasteData = (pasteData?.data.ids.size ?? 0) > 0
  const pasteDataParentKeys =
    !pasteData ? null : (
      new Map(
        Array.from(nodeMap.current.entries()).map(([id, otherAsset]) => [
          id,
          otherAsset.directoryKey,
        ]),
      )
    )
  const canPaste =
    !pasteData || !pasteDataParentKeys || !isCloud ?
      true
    : Array.from(pasteData.data.ids).every((key) => {
        const parentKey = pasteDataParentKeys.get(key)
        const parent = parentKey == null ? null : nodeMap.current.get(parentKey)
        if (!parent) {
          return false
        } else if (isTeamPath(parent.path)) {
          return true
        } else {
          // Assume user path; check permissions
          const permission = tryFindSelfPermission(user, asset.permissions)
          return permission != null && canPermissionModifyDirectoryContents(permission.permission)
        }
      })

  const { data } = useQuery({
    ...createGetProjectDetailsQuery({
      // This is safe because we disable the query when the asset is not a project.
      // see `enabled` property below.
      // eslint-disable-next-line no-restricted-syntax
      assetId: asset.id as ProjectId,
      parentId: asset.parentId,
      backend,
    }),
    enabled: asset.type === AssetType.project && canOpenProjects,
  })

  const isRunningProject =
    (asset.type === AssetType.project && data && IS_OPENING_OR_OPENED[data.state.type]) ?? false

  const canExecute =
    category.type !== 'trash' &&
    (!isCloud || (self != null && PERMISSION_ACTION_CAN_EXECUTE[self.permission]))

  const isOtherUserUsingProject =
    isCloud &&
    assetIsProject(asset) &&
    asset.projectState.openedBy != null &&
    asset.projectState.openedBy !== user.email

  const pasteMenuEntry = hasPasteData && canPaste && (
    <ContextMenuEntry
      hidden={hidden}
      action="paste"
      doAction={() => {
        const directoryId = asset.type === AssetType.directory ? asset.id : asset.parentId
        doPaste(directoryId, directoryId)
      }}
    />
  )

  const canUploadToCloud = user.plan !== Plan.free

  return (
    category.type === 'trash' ?
      !ownsThisAsset ? null
      : <ContextMenu aria-label={getText('assetContextMenuLabel')} hidden={hidden} event={event}>
          <ContextMenuEntry
            hidden={hidden}
            action="undelete"
            label={getText('restoreFromTrashShortcut')}
            doAction={() => {
              dispatchAssetEvent({ type: AssetEventType.restore, ids: new Set([asset.id]) })
            }}
          />
          <ContextMenuEntry
            hidden={hidden}
            action="delete"
            label={getText('deleteForeverShortcut')}
            doAction={() => {
              setModal(
                <ConfirmDeleteModal
                  defaultOpen
                  actionText={`delete the ${asset.type} '${asset.title}' forever`}
                  doDelete={() => {
                    const ids = new Set([asset.id])
                    dispatchAssetEvent({ type: AssetEventType.deleteForever, ids })
                  }}
                />,
              )
            }}
          />
          {pasteMenuEntry}
        </ContextMenu>
    : !canManageThisAsset ? null
    : <ContextMenu aria-label={getText('assetContextMenuLabel')} hidden={hidden} event={event}>
        {asset.type === AssetType.datalink && (
          <ContextMenuEntry
            hidden={hidden}
            action="useInNewProject"
            doAction={() => {
              void newProject(
                { templateName: asset.title, datalinkId: asset.id },
                asset.parentId,
                path,
              )
            }}
          />
        )}
        {asset.type === AssetType.project &&
          canExecute &&
          !isRunningProject &&
          !isOtherUserUsingProject && (
            <ContextMenuEntry
              hidden={hidden}
              action="open"
              isDisabled={!canOpenProjects}
              tooltip={disabledTooltip}
              doAction={() => {
                openProject({
                  id: asset.id,
                  title: asset.title,
                  parentId: asset.parentId,
                  type: state.backend.type,
                })
              }}
            />
          )}
        {asset.type === AssetType.project && isCloud && (
          <ContextMenuEntry
            hidden={hidden}
            action="run"
            isDisabled={!canOpenProjects}
            tooltip={disabledTooltip}
            doAction={() => {
              openProjectMutation.mutate({
                id: asset.id,
                title: asset.title,
                parentId: asset.parentId,
                type: state.backend.type,
                inBackground: true,
              })
            }}
          />
        )}
        {!isCloud && path != null && systemApi && (
          <ContextMenuEntry
            hidden={hidden}
            action="openInFileBrowser"
            doAction={() => {
              systemApi.showItemInFolder(path)
            }}
          />
        )}
        {asset.type === AssetType.project &&
          canExecute &&
          isRunningProject &&
          !isOtherUserUsingProject && (
            <ContextMenuEntry
              hidden={hidden}
              action="close"
              doAction={() => {
                closeProject({
                  id: asset.id,
                  title: asset.title,
                  parentId: asset.parentId,
                  type: state.backend.type,
                })
              }}
            />
          )}
        {asset.type === AssetType.project && !isCloud && (
          <PaywallContextMenuEntry
            hidden={hidden}
            isUnderPaywall={!canUploadToCloud}
            feature="uploadToCloud"
            action="uploadToCloud"
            doAction={async () => {
              try {
                const projectResponse = await fetch(
                  `./api/project-manager/projects/${extractTypeAndId(asset.id).id}/enso-project`,
                )
                // This DOES NOT update the cloud assets list when it
                // completes, as the current backend is not the remote
                // (cloud) backend. The user may change to the cloud backend
                // while this request is in progress, however this is
                // uncommon enough that it is not worth the added complexity.
                const fileName = `${asset.title}.enso-project`
                await uploadFileToCloudMutation.mutateAsync(
                  {
                    fileName,
                    fileId: null,
                    parentDirectoryId: null,
                  },
                  new File([await projectResponse.blob()], fileName),
                )
                toast.success(getText('uploadProjectToCloudSuccess'))
              } catch (error) {
                toastAndLog('uploadProjectToCloudError', error)
              }
            }}
          />
        )}
        {canExecute &&
          !isRunningProject &&
          !isOtherUserUsingProject &&
          (!isCloud || asset.type === AssetType.project || asset.type === AssetType.directory) && (
            <ContextMenuEntry
              hidden={hidden}
              action="rename"
              doAction={() => {
                setRowState(merger({ isEditingName: true }))
              }}
            />
          )}
        {(asset.type === AssetType.secret || asset.type === AssetType.datalink) &&
          canEditThisAsset && (
            <ContextMenuEntry
              hidden={hidden}
              action="edit"
              doAction={() => {
                setIsAssetPanelTemporarilyVisible(true)
                const assetPanelProps = { backend, item: asset }
                switch (asset.type) {
                  case AssetType.secret: {
                    setAssetPanelProps({
                      ...assetPanelProps,
                      path: pathRaw,
                      spotlightOn: 'secret',
                    })
                    break
                  }
                  case AssetType.datalink: {
                    setAssetPanelProps({
                      ...assetPanelProps,
                      path: pathRaw,
                      spotlightOn: 'datalink',
                    })
                    break
                  }
                }
              }}
            />
          )}
        {isCloud && (
          <ContextMenuEntry
            hidden={hidden}
            action="editDescription"
            label={getText('editDescriptionShortcut')}
            doAction={() => {
              setIsAssetPanelTemporarilyVisible(true)
              setAssetPanelProps({
                backend,
                item: asset,
                path: pathRaw,
                spotlightOn: 'description',
              })
            }}
          />
        )}
        {isCloud && (
          <ContextMenuEntry
            hidden={hidden}
            isDisabled
            action="snapshot"
            doAction={() => {
              // No backend support yet.
            }}
          />
        )}
        {ownsThisAsset && !isRunningProject && !isOtherUserUsingProject && (
          <ContextMenuEntry
            hidden={hidden}
            action="delete"
            label={isCloud ? getText('moveToTrashShortcut') : getText('deleteShortcut')}
            doAction={() => {
              if (isCloud) {
                if (asset.type === AssetType.directory) {
                  setModal(
                    <ConfirmDeleteModal
                      defaultOpen
                      actionText={getText('trashTheAssetTypeTitle', asset.type, asset.title)}
                      doDelete={doDelete}
                    />,
                  )
                } else {
                  doDelete()
                }
              } else {
                setModal(
                  <ConfirmDeleteModal
                    defaultOpen
                    actionText={getText('deleteTheAssetTypeTitle', asset.type, asset.title)}
                    doDelete={doDelete}
                  />,
                )
              }
            }}
          />
        )}
        {isCloud && <Separator hidden={hidden} />}

        {isCloud && managesThisAsset && self != null && (
          <PaywallContextMenuEntry
            feature="share"
            isUnderPaywall={isUnderPaywall}
            action="share"
            hidden={hidden}
            doAction={() => {
              setModal(
                <ManagePermissionsModal
                  backend={backend}
                  category={category}
                  item={asset}
                  self={self}
                  eventTarget={eventTarget}
                  doRemoveSelf={() => {
                    dispatchAssetEvent({
                      type: AssetEventType.removeSelf,
                      id: asset.id,
                    })
                  }}
                />,
              )
            }}
          />
        )}

        {isCloud && (
          <ContextMenuEntry
            hidden={hidden}
            action="label"
            doAction={() => {
              setModal(<ManageLabelsModal backend={backend} item={asset} triggerRef={triggerRef} />)
            }}
          />
        )}
        {isCloud && managesThisAsset && self != null && <Separator hidden={hidden} />}
        {asset.type === AssetType.project && (
          <ContextMenuEntry
            hidden={hidden}
            action="duplicate"
            doAction={() => {
              dispatchAssetListEvent({
                type: AssetListEventType.copy,
                newParentId: asset.parentId,
                newParentKey: asset.parentId,
                items: [asset],
              })
            }}
          />
        )}
        {isCloud && <ContextMenuEntry hidden={hidden} action="copy" doAction={doCopy} />}
        {path != null && (
          <ContextMenuEntry
            hidden={hidden}
            action="copyAsPath"
            doAction={copyMutation.mutateAsync}
          />
        )}
        {!isRunningProject && !isOtherUserUsingProject && (
          <ContextMenuEntry hidden={hidden} action="cut" doAction={doCut} />
        )}
        {(isCloud ? asset.type !== AssetType.directory : asset.type === AssetType.project) && (
          <ContextMenuEntry
            hidden={hidden}
            isDisabled={asset.type === AssetType.secret}
            action="download"
            doAction={() => {
              dispatchAssetEvent({ type: AssetEventType.download, ids: new Set([asset.id]) })
            }}
          />
        )}
        {pasteMenuEntry}
        {canAddToThisDirectory && <Separator hidden={hidden} />}
        {canAddToThisDirectory && (
          <GlobalContextMenu
            noWrapper
            hidden={hidden}
            backend={backend}
            category={category}
            rootDirectoryId={rootDirectoryId}
            directoryKey={asset.id}
            directoryId={asset.id}
            path={path}
            doPaste={doPaste}
            event={event}
          />
        )}
      </ContextMenu>
  )
}
