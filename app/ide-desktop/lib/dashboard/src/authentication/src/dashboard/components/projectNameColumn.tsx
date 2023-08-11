/** @file The icon and name of a {@link backendModule.ProjectAsset}. */
import * as React from 'react'

import * as assetEventModule from '../events/assetEvent'
import * as assetListEventModule from '../events/assetListEvent'
import * as backendModule from '../backend'
import * as backendProvider from '../../providers/backend'
import * as eventModule from '../event'
import * as hooks from '../../hooks'
import * as indent from '../indent'
import * as presence from '../presence'
import * as shortcutsModule from '../shortcuts'
import * as shortcutsProvider from '../../providers/shortcuts'
import * as validation from '../validation'

import * as column from '../column'
import EditableSpan from './editableSpan'
import ProjectIcon from './projectIcon'

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
        keyProp: key,
        item,
        setItem,
        selected,
        rowState,
        setRowState,
        state: {
            appRunner,
            assetEvents,
            dispatchAssetEvent,
            dispatchAssetListEvent,
            doOpenManually,
            doOpenIde,
            doCloseIde,
        },
    } = props
    const toastAndLog = hooks.useToastAndLog()
    const { backend } = backendProvider.useBackend()
    const { shortcuts } = shortcutsProvider.useShortcuts()
    const asset = item.item
    if (asset.type !== backendModule.AssetType.project) {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('`ProjectNameColumn` can only display project assets.')
    }
    const setAsset = React.useCallback(
        (valueOrUpdater: React.SetStateAction<backendModule.ProjectAsset>) => {
            if (typeof valueOrUpdater === 'function') {
                setItem(oldItem => ({
                    ...oldItem,
                    // This is SAFE, because it is a mistake for an item to change type.
                    // eslint-disable-next-line no-restricted-syntax
                    item: valueOrUpdater(oldItem.item as backendModule.ProjectAsset),
                }))
            } else {
                setItem(oldItem => ({ ...oldItem, item: valueOrUpdater }))
            }
        },
        [/* should never change */ setItem]
    )

    const doRename = async (newName: string) => {
        try {
            await backend.projectUpdate(
                asset.id,
                {
                    ami: null,
                    ideVersion: null,
                    projectName: newName,
                },
                asset.title
            )
            return
        } catch (error) {
            toastAndLog('Unable to rename project', error)
            throw error
        }
    }

    hooks.useEventHandler(assetEvents, async event => {
        switch (event.type) {
            case assetEventModule.AssetEventType.newFolder:
            case assetEventModule.AssetEventType.newSecret:
            case assetEventModule.AssetEventType.openProject:
            case assetEventModule.AssetEventType.cancelOpeningAllProjects:
            case assetEventModule.AssetEventType.deleteMultiple:
            case assetEventModule.AssetEventType.downloadSelected:
            case assetEventModule.AssetEventType.removeSelf: {
                // Ignored. Any missing project-related events should be handled by `ProjectIcon`.
                // `deleteMultiple` and `downloadSelected` are handled by `AssetRow`.
                break
            }
            case assetEventModule.AssetEventType.newProject: {
                // This should only run before this project gets replaced with the actual project
                // by this event handler. In both cases `key` will match, so using `key` here
                // is a mistake.
                if (asset.id === event.placeholderId) {
                    rowState.setPresence(presence.Presence.inserting)
                    try {
                        const createdProject = await backend.createProject({
                            parentDirectoryId: asset.parentId,
                            projectName: asset.title,
                            projectTemplateName: event.templateId,
                        })
                        rowState.setPresence(presence.Presence.present)
                        setAsset({
                            ...asset,
                            id: createdProject.projectId,
                            projectState: { type: backendModule.ProjectState.placeholder },
                        })
                        dispatchAssetEvent({
                            type: assetEventModule.AssetEventType.openProject,
                            id: createdProject.projectId,
                        })
                    } catch (error) {
                        dispatchAssetListEvent({
                            type: assetListEventModule.AssetListEventType.delete,
                            id: item.key,
                        })
                        toastAndLog('Error creating new project', error)
                    }
                }
                break
            }
            case assetEventModule.AssetEventType.uploadFiles: {
                const file = event.files.get(item.key)
                if (file != null) {
                    rowState.setPresence(presence.Presence.inserting)
                    try {
                        if (backend.type === backendModule.BackendType.local) {
                            /** Information required to display a bundle. */
                            interface BundleInfo {
                                name: string
                                id: string
                            }
                            // This non-standard property is defined in Electron.
                            let info: BundleInfo
                            if (
                                'backendApi' in window &&
                                'path' in file &&
                                typeof file.path === 'string'
                            ) {
                                info = await window.backendApi.importProjectFromPath(file.path)
                            } else {
                                const response = await fetch('./api/upload-project', {
                                    method: 'POST',
                                    // Ideally this would use `file.stream()`, to minimize RAM
                                    // requirements. for uploading large projects. Unfortunately,
                                    // this requires HTTP/2, which is HTTPS-only, so it will not
                                    // work on `http://localhost`.
                                    body: await file.arrayBuffer(),
                                })
                                // This is SAFE, as the types of this API are statically known.
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                info = await response.json()
                            }
                            rowState.setPresence(presence.Presence.present)
                            setAsset({
                                ...asset,
                                title: info.name,
                                id: backendModule.ProjectId(info.id),
                            })
                        } else {
                            const fileName = asset.title
                            const title = backendModule.stripProjectExtension(asset.title)
                            setAsset({
                                ...asset,
                                title,
                            })
                            const createdFile = await backend.uploadFile(
                                {
                                    fileId: null,
                                    fileName,
                                    parentDirectoryId: asset.parentId,
                                },
                                file
                            )
                            const project = createdFile.project
                            if (project == null) {
                                throw new Error('The uploaded file was not a project.')
                            } else {
                                rowState.setPresence(presence.Presence.present)
                                setAsset({
                                    ...asset,
                                    title,
                                    id: project.projectId,
                                    projectState: project.state,
                                })
                                return
                            }
                        }
                    } catch (error) {
                        dispatchAssetListEvent({
                            type: assetListEventModule.AssetListEventType.delete,
                            id: key,
                        })
                        toastAndLog('Could not upload project', error)
                    }
                }
                break
            }
        }
    })

    return (
        <div
            className={`flex text-left items-center whitespace-nowrap ${indent.indentClass(
                item.depth
            )}`}
            onClick={event => {
                if (!rowState.isEditingName && eventModule.isDoubleClick(event)) {
                    // It is a double click; open the project.
                    dispatchAssetEvent({
                        type: assetEventModule.AssetEventType.openProject,
                        id: asset.id,
                    })
                } else if (
                    eventModule.isSingleClick(event) &&
                    (selected ||
                        shortcuts.matchesMouseAction(shortcutsModule.MouseAction.editName, event))
                ) {
                    setRowState(oldRowState => ({
                        ...oldRowState,
                        isEditingName: true,
                    }))
                }
            }}
        >
            <ProjectIcon
                keyProp={key}
                item={asset}
                setItem={setAsset}
                assetEvents={assetEvents}
                doOpenManually={doOpenManually}
                appRunner={appRunner}
                openIde={() => {
                    doOpenIde(asset)
                }}
                onClose={doCloseIde}
            />
            <EditableSpan
                editable={rowState.isEditingName}
                onSubmit={async newTitle => {
                    setRowState(oldRowState => ({
                        ...oldRowState,
                        isEditingName: false,
                    }))
                    if (newTitle !== asset.title) {
                        const oldTitle = asset.title
                        setAsset(oldItem => ({ ...oldItem, title: newTitle }))
                        try {
                            await doRename(newTitle)
                        } catch {
                            setAsset(oldItem => ({ ...oldItem, title: oldTitle }))
                        }
                    }
                }}
                onCancel={() => {
                    setRowState(oldRowState => ({
                        ...oldRowState,
                        isEditingName: false,
                    }))
                }}
                {...(backend.type === backendModule.BackendType.local
                    ? {
                          inputPattern: validation.LOCAL_PROJECT_NAME_PATTERN,
                          inputTitle: validation.LOCAL_PROJECT_NAME_TITLE,
                      }
                    : {})}
                className={`bg-transparent grow px-2 ${
                    rowState.isEditingName ? 'cursor-text' : 'cursor-pointer'
                }`}
            >
                {asset.title}
            </EditableSpan>
        </div>
    )
}
