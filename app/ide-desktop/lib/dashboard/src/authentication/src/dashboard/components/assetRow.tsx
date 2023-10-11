/** @file A {@link TableRow} for an arbitrary asset. */
import * as React from 'react'

import BlankIcon from 'enso-assets/blank.svg'

import * as assetEventModule from '../events/assetEvent'
import * as assetListEventModule from '../events/assetListEvent'
import * as assetTreeNode from '../assetTreeNode'
import * as authProvider from '../../authentication/providers/auth'
import * as backendModule from '../backend'
import * as backendProvider from '../../providers/backend'
import * as download from '../../download'
import * as errorModule from '../../error'
import * as hooks from '../../hooks'
import * as indent from '../indent'
import * as modalProvider from '../../providers/modal'
import * as presenceModule from '../presence'

import * as assetsTable from './assetsTable'
import StatelessSpinner, * as statelessSpinner from './statelessSpinner'
import TableRow, * as tableRow from './tableRow'
import AssetContextMenu from './assetContextMenu'

// ================
// === AssetRow ===
// ================

/** Props for an {@link AssetRow}. */
export interface AssetRowProps
    extends tableRow.TableRowProps<
        assetTreeNode.AssetTreeNode,
        assetsTable.AssetsTableState,
        assetsTable.AssetRowState,
        backendModule.AssetId
    > {}

/** A row containing an {@link backendModule.AnyAsset}. */
export default function AssetRow(props: AssetRowProps) {
    const {
        keyProp: key,
        item: rawItem,
        initialRowState,
        hidden,
        selected,
        allowContextMenu,
        onContextMenu,
        state,
        columns,
    } = props
    const { assetEvents, dispatchAssetEvent, dispatchAssetListEvent, doCut, doPaste } = state
    const { organization } = authProvider.useNonPartialUserSession()
    const { backend } = backendProvider.useBackend()
    const { setModal, unsetModal } = modalProvider.useSetModal()
    const { user } = authProvider.useNonPartialUserSession()
    const toastAndLog = hooks.useToastAndLog()
    const [item, setItem] = React.useState(rawItem)
    const asset = item.item
    const [presence, setPresence] = React.useState(presenceModule.Presence.present)
    const [rowState, setRowState] = React.useState<assetsTable.AssetRowState>(() => ({
        ...initialRowState,
        setPresence,
    }))
    React.useEffect(() => {
        setItem(rawItem)
    }, [rawItem])
    React.useEffect(() => {
        // Mutation is HIGHLY INADVISABLE in React, however it is useful here as we want to avoid re-rendering the
        // parent.
        rawItem.item = asset
    }, [asset, rawItem])

    const doMove = React.useCallback(
        async (
            newParentKey: backendModule.AssetId | null,
            newParentId: backendModule.DirectoryId | null
        ) => {
            // The asset is effectivly being deleted from the current position, and created at the new
            // position, from the viewpoint of the asset list.
            try {
                dispatchAssetListEvent({
                    type: assetListEventModule.AssetListEventType.move,
                    newParentKey,
                    newParentId,
                    key: item.key,
                    item: asset,
                })
                await backend.updateAsset(
                    asset.id,
                    { parentDirectoryId: newParentId ?? backend.rootDirectoryId(organization) },
                    asset.title
                )
            } catch (error) {
                toastAndLog(`Could not move '${asset.title}'`, error)
                // Move the asset back to its original position.
                dispatchAssetListEvent({
                    type: assetListEventModule.AssetListEventType.move,
                    newParentKey: item.directoryKey,
                    newParentId: item.directoryId,
                    key: item.key,
                    item: asset,
                })
            }
        },
        [
            backend,
            organization,
            asset,
            item.directoryId,
            item.directoryKey,
            item.key,
            /* should never change */ toastAndLog,
            /* should never change */ dispatchAssetListEvent,
        ]
    )

    const doDelete = React.useCallback(async () => {
        setPresence(presenceModule.Presence.deleting)
        if (asset.type === backendModule.AssetType.directory) {
            dispatchAssetListEvent({
                type: assetListEventModule.AssetListEventType.closeFolder,
                id: asset.id,
                // This is SAFE, as this asset is already known to be a directory.
                // eslint-disable-next-line no-restricted-syntax
                key: item.key as backendModule.DirectoryId,
            })
        }
        try {
            dispatchAssetListEvent({
                type: assetListEventModule.AssetListEventType.willDelete,
                key: item.key,
            })
            if (
                asset.type === backendModule.AssetType.project &&
                backend.type === backendModule.BackendType.local
            ) {
                if (
                    asset.projectState.type !== backendModule.ProjectState.placeholder &&
                    asset.projectState.type !== backendModule.ProjectState.closed
                ) {
                    await backend.openProject(asset.id, null, asset.title)
                }
                try {
                    await backend.closeProject(asset.id, asset.title)
                } catch {
                    // Ignored. The project was already closed.
                }
            }
            await backend.deleteAsset(asset.id, asset.title)
            dispatchAssetListEvent({
                type: assetListEventModule.AssetListEventType.delete,
                key: item.key,
            })
        } catch (error) {
            setPresence(presenceModule.Presence.present)
            toastAndLog(
                errorModule.tryGetMessage(error)?.slice(0, -1) ??
                    `Could not delete ${backendModule.ASSET_TYPE_NAME[asset.type]}`
            )
        }
    }, [
        backend,
        dispatchAssetListEvent,
        asset,
        /* should never change */ item.key,
        /* should never change */ toastAndLog,
    ])

    const doRestore = React.useCallback(async () => {
        // Visually, the asset is deleted from the Trash view.
        setPresence(presenceModule.Presence.deleting)
        try {
            await backend.undoDeleteAsset(asset.id, asset.title)
            dispatchAssetListEvent({
                type: assetListEventModule.AssetListEventType.delete,
                key: item.key,
            })
        } catch (error) {
            setPresence(presenceModule.Presence.present)
            toastAndLog(`Unable to restore ${backendModule.ASSET_TYPE_NAME[asset.type]}`, error)
        }
    }, [
        backend,
        dispatchAssetListEvent,
        asset,
        /* should never change */ item.key,
        /* should never change */ toastAndLog,
    ])

    hooks.useEventHandler(assetEvents, async event => {
        switch (event.type) {
            // These events are handled in the specific `NameColumn` files.
            case assetEventModule.AssetEventType.newProject:
            case assetEventModule.AssetEventType.newFolder:
            case assetEventModule.AssetEventType.uploadFiles:
            case assetEventModule.AssetEventType.newDataConnector:
            case assetEventModule.AssetEventType.openProject:
            case assetEventModule.AssetEventType.closeProject:
            case assetEventModule.AssetEventType.cancelOpeningAllProjects: {
                break
            }
            case assetEventModule.AssetEventType.move: {
                if (event.ids.has(item.key)) {
                    await doMove(event.newParentKey, event.newParentId)
                }
                break
            }
            case assetEventModule.AssetEventType.deleteMultiple: {
                if (event.ids.has(item.key)) {
                    await doDelete()
                }
                break
            }
            case assetEventModule.AssetEventType.restoreMultiple: {
                if (event.ids.has(item.key)) {
                    await doRestore()
                }
                break
            }
            case assetEventModule.AssetEventType.downloadSelected: {
                if (selected) {
                    download.download(
                        './api/project-manager/' + `projects/${asset.id}/enso-project`,
                        `${asset.title}.enso-project`
                    )
                }
                break
            }
            case assetEventModule.AssetEventType.removeSelf: {
                // This is not triggered from the asset list, so it uses `item.id` instead of `key`.
                if (event.id === asset.id && user != null) {
                    setPresence(presenceModule.Presence.deleting)
                    try {
                        await backend.createPermission({
                            action: null,
                            resourceId: asset.id,
                            userSubjects: [user.id],
                        })
                        dispatchAssetListEvent({
                            type: assetListEventModule.AssetListEventType.delete,
                            key: item.key,
                        })
                    } catch (error) {
                        setPresence(presenceModule.Presence.present)
                        toastAndLog(
                            errorModule.tryGetMessage(error)?.slice(0, -1) ??
                                `Could not delete ${backendModule.ASSET_TYPE_NAME[asset.type]}`
                        )
                    }
                }
                break
            }
        }
    })

    switch (asset.type) {
        case backendModule.AssetType.directory:
        case backendModule.AssetType.project:
        case backendModule.AssetType.file:
        case backendModule.AssetType.secret: {
            return (
                <>
                    <TableRow
                        className={presenceModule.CLASS_NAME[presence]}
                        {...props}
                        hidden={hidden || presence === presenceModule.Presence.deleting}
                        onContextMenu={(innerProps, event) => {
                            if (allowContextMenu) {
                                event.preventDefault()
                                event.stopPropagation()
                                onContextMenu?.(innerProps, event)
                                setModal(
                                    <AssetContextMenu
                                        innerProps={innerProps}
                                        event={event}
                                        eventTarget={
                                            event.target instanceof HTMLElement
                                                ? event.target
                                                : event.currentTarget
                                        }
                                        doCut={doCut}
                                        doPaste={doPaste}
                                        doDelete={doDelete}
                                    />
                                )
                            } else {
                                onContextMenu?.(innerProps, event)
                            }
                        }}
                        item={item}
                        setItem={setItem}
                        initialRowState={rowState}
                        setRowState={setRowState}
                        onDragOver={event => {
                            if (item.item.type === backendModule.AssetType.directory) {
                                event.preventDefault()
                            }
                        }}
                        onDrop={async event => {
                            if (item.item.type === backendModule.AssetType.directory) {
                                const payload = await assetsTable.tryFindAssetRowsDragPayload(
                                    event.dataTransfer
                                )
                                if (payload != null) {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    unsetModal()
                                    dispatchAssetEvent({
                                        type: assetEventModule.AssetEventType.move,
                                        newParentKey: item.key,
                                        newParentId: item.item.id,
                                        ids: new Set(payload.map(dragItem => dragItem.asset.id)),
                                    })
                                }
                            }
                        }}
                    />
                    {selected &&
                        allowContextMenu &&
                        presence !== presenceModule.Presence.deleting && (
                            // This is a copy of the context menu, since the context menu registers keyboard
                            // shortcut handlers. This is a bit of a hack, however it is preferable to duplicating
                            // the entire context menu (once for the keyboard actions, once for the JSX).
                            <AssetContextMenu
                                hidden
                                innerProps={{
                                    key,
                                    item,
                                    setItem,
                                    state,
                                    rowState,
                                    setRowState,
                                }}
                                event={{ pageX: 0, pageY: 0 }}
                                eventTarget={null}
                                doCut={doCut}
                                doPaste={doPaste}
                                doDelete={doDelete}
                            />
                        )}
                </>
            )
        }
        case backendModule.AssetType.specialLoading: {
            return hidden ? null : (
                <tr>
                    <td colSpan={columns.length} className="rounded-rows-skip-level border-r p-0">
                        <div
                            className={`flex justify-center rounded-full h-8 py-1 ${indent.indentClass(
                                item.depth
                            )}`}
                        >
                            <StatelessSpinner
                                size={24}
                                state={statelessSpinner.SpinnerState.loadingMedium}
                            />
                        </div>
                    </td>
                </tr>
            )
        }
        case backendModule.AssetType.specialEmpty: {
            return hidden ? null : (
                <tr>
                    <td colSpan={columns.length} className="rounded-rows-skip-level border-r p-0">
                        <div
                            className={`flex items-center rounded-full h-8 py-2 ${indent.indentClass(
                                item.depth
                            )}`}
                        >
                            <img src={BlankIcon} />
                            {assetsTable.EMPTY_DIRECTORY_PLACEHOLDER}
                        </div>
                    </td>
                </tr>
            )
        }
    }
}
