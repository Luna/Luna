/** @file Table displaying a list of projects. */
import * as React from 'react'
import * as toastify from 'react-toastify'

import * as common from 'enso-common'

import * as array from '../array'
import * as assetEventModule from '../events/assetEvent'
import * as assetListEventModule from '../events/assetListEvent'
import * as backendModule from '../backend'
import * as columnModule from '../column'
import * as dateTime from '../dateTime'
import * as hooks from '../../hooks'
import * as permissions from '../permissions'
import * as presenceModule from '../presence'
import * as shortcuts from '../shortcuts'
import * as sorting from '../sorting'
import * as string from '../../string'
import * as uniqueString from '../../uniqueString'

import * as authProvider from '../../authentication/providers/auth'
import * as backendProvider from '../../providers/backend'
import * as loggerProvider from '../../providers/logger'
import * as modalProvider from '../../providers/modal'

import AssetRow from './assetRow'
import Button from './button'
import ConfirmDeleteModal from './confirmDeleteModal'
import ContextMenu from './contextMenu'
import ContextMenuEntry from './contextMenuEntry'
import ContextMenus from './contextMenus'
import GlobalContextMenu from './globalContextMenu'
import Table from './table'

// =================
// === Constants ===
// =================

/** The `localStorage` key under which the ID of the current directory is stored. */
const EXTRA_COLUMNS_KEY =
    common.PRODUCT_NAME.toLowerCase() + '-dashboard-directory-list-extra-columns'

/** A value that represents that the first argument is less than the second argument, in a
 * sorting function. */
const COMPARE_LESS_THAN = -1
/** The user-facing name of this asset type. */
const ASSET_TYPE_NAME = 'item'
/** The user-facing plural name of this asset type. */
const ASSET_TYPE_NAME_PLURAL = 'items'
// This is a function, even though it is not syntactically a function.
// eslint-disable-next-line no-restricted-syntax
const pluralize = string.makePluralize(ASSET_TYPE_NAME, ASSET_TYPE_NAME_PLURAL)
/** Placeholder row. */
const PLACEHOLDER = (
    <span className="opacity-75">
        You have no projects yet. Go ahead and create one using the button above, or open a template
        from the home screen.
    </span>
)
/** Placeholder row for directories that are empty. */
export const EMPTY_DIRECTORY_PLACEHOLDER = (
    <span className="px-2 opacity-75">This folder is empty.</span>
)

/** The {@link RegExp} matching a directory name following the default naming convention. */
const DIRECTORY_NAME_REGEX = /^New_Folder_(?<directoryIndex>\d+)$/
/** The default prefix of an automatically generated directory. */
const DIRECTORY_NAME_DEFAULT_PREFIX = 'New_Folder_'

// =====================
// === AssetTreeNode ===
// =====================

/** A node in the drive's item tree. */
export interface AssetTreeNode {
    /** The original id of the asset (the placeholder id for new assets). This must never change. */
    key: backendModule.AssetId
    /** The actual asset. This MAY change if this is initially a placeholder item, but rows MAY
     * keep updated values within the row itself as well. */
    item: backendModule.AnyAsset
    /** This is `null` if the asset is not a directory asset, OR if it is a collapsed directory
     * asset. */
    children: AssetTreeNode[] | null
    depth: number
}

/** Get an {@link AssetTreeNode.key} from an {@link AssetTreeNode}. Useful for React, references
 * of global functions do not change. */
function getAssetTreeNodeKey(node: AssetTreeNode) {
    return node.key
}

/** Return a positive number if `a > b`, a negative number if `a < b`, and zero if `a === b`.
 * Uses {@link backendModule.compareAssets} internally. */
function compareAssetTreeNodes(a: AssetTreeNode, b: AssetTreeNode) {
    return backendModule.compareAssets(a.item, b.item)
}

/** Return a new {@link AssetTreeNode} array if any children would be changed by the transformation
 * function, otherwise return the original {@link AssetTreeNode} array. */
function assetTreeMap(tree: AssetTreeNode[], transform: (node: AssetTreeNode) => AssetTreeNode) {
    let result: AssetTreeNode[] | null = null
    for (let i = 0; i < tree.length; i += 1) {
        const node = tree[i]
        if (node == null) {
            break
        }
        const intermediateNode = transform(node)
        let newNode: AssetTreeNode = intermediateNode
        if (intermediateNode.children != null) {
            const newChildren = assetTreeMap(intermediateNode.children, transform)
            if (newChildren !== intermediateNode.children) {
                newNode = { ...intermediateNode, children: newChildren }
            }
        }
        if (newNode !== node) {
            result ??= Array.from(tree)
            result[i] = newNode
        }
    }
    return result ?? tree
}

/** Return a new {@link AssetTreeNode} array if any children would be changed by the transformation
 * function, otherwise return the original {@link AssetTreeNode} array. The predicate is applied to
 * a parent node after it is applied to its children. */
function assetTreeFilter(
    tree: AssetTreeNode[],
    predicate: (node: AssetTreeNode) => boolean,
    deleteEmptyChildren = false
) {
    let result: AssetTreeNode[] | null = null
    for (let i = 0; i < tree.length; i += 1) {
        const node = tree[i]
        if (node == null) {
            break
        }
        if (node.children != null) {
            const newChildren = assetTreeFilter(node.children, predicate)
            if (newChildren !== node.children) {
                result ??= tree.slice(0, i)
                const newNode = {
                    ...node,
                    children: newChildren.length === 0 && deleteEmptyChildren ? null : newChildren,
                }
                if (predicate(newNode)) {
                    result.push(newNode)
                }
            }
        } else if (result != null) {
            if (predicate(node)) {
                result.push(node)
            }
        } else {
            if (!predicate(node)) {
                result = tree.slice(0, i)
            }
        }
    }
    return result ?? tree
}

/** Return a new {@link AssetTreeNode}  */
function assetTreeDFS(
    tree: AssetTreeNode[],
    predicate: (node: AssetTreeNode) => boolean
): AssetTreeNode | null {
    let result: AssetTreeNode | null = null
    for (const node of tree) {
        if (predicate(node)) {
            result = node
            break
        }
        if (node.children != null) {
            const innerResult = assetTreeDFS(node.children, predicate)
            if (innerResult != null) {
                result = innerResult
                break
            }
        }
    }
    return result
}

/** Returns all items in the tree, flattened into an array using pre-order traversal. */
function assetTreePreorderTraversal(
    tree: AssetTreeNode[],
    preprocess?: ((tree: AssetTreeNode[]) => AssetTreeNode[]) | null
): AssetTreeNode[] {
    return (preprocess?.(tree) ?? tree).flatMap(node => {
        if (node.children != null) {
            return [node, ...assetTreePreorderTraversal(node.children, preprocess ?? null)]
        } else {
            return [node]
        }
    })
}

/** Creates an {@link AssetTreeNode} from a {@link backendModule.AnyAsset}. */
function assetTreeNodeFromAsset(asset: backendModule.AnyAsset, depth: number): AssetTreeNode {
    return {
        key: asset.id,
        item: asset,
        children: null,
        depth,
    }
}

// ===================
// === AssetsTable ===
// ===================

/** State passed through from a {@link AssetsTable} to every cell. */
export interface AssetsTableState {
    appRunner: AppRunner | null
    sortColumn: columnModule.SortableColumn | null
    setSortColumn: (column: columnModule.SortableColumn | null) => void
    sortDirection: sorting.SortDirection | null
    setSortDirection: (sortDirection: sorting.SortDirection | null) => void
    assetEvents: assetEventModule.AssetEvent[]
    dispatchAssetEvent: (event: assetEventModule.AssetEvent) => void
    dispatchAssetListEvent: (event: assetListEventModule.AssetListEvent) => void
    doToggleDirectoryExpansion: (
        directoryId: backendModule.DirectoryId,
        key: backendModule.AssetId,
        title?: string
    ) => void
    /** Called when the project is opened via the {@link ProjectActionButton}. */
    doOpenManually: (projectId: backendModule.ProjectId) => void
    doOpenIde: (project: backendModule.ProjectAsset) => void
    doCloseIde: () => void
}

/** Data associated with a {@link AssetRow}, used for rendering. */
export interface AssetRowState {
    setPresence: (presence: presenceModule.Presence) => void
    isEditingName: boolean
}

/** The default {@link AssetRowState} associated with a {@link AssetRow}. */
export const INITIAL_ROW_STATE: AssetRowState = Object.freeze({
    setPresence: () => {
        // Ignored. This MUST be replaced by the row component. It should also update `presence`.
    },
    isEditingName: false,
})

/** Props for a {@link AssetsTable}. */
export interface AssetsTableProps {
    appRunner: AppRunner | null
    query: string
    initialProjectName: string | null
    assetEvents: assetEventModule.AssetEvent[]
    dispatchAssetEvent: (event: assetEventModule.AssetEvent) => void
    assetListEvents: assetListEventModule.AssetListEvent[]
    dispatchAssetListEvent: (event: assetListEventModule.AssetListEvent) => void
    doOpenIde: (project: backendModule.ProjectAsset) => void
    doCloseIde: () => void
    loadingProjectManagerDidFail: boolean
    isListingRemoteDirectoryWhileOffline: boolean
    isListingLocalDirectoryAndWillFail: boolean
    isListingRemoteDirectoryAndWillFail: boolean
}

/** The table of project assets. */
export default function AssetsTable(props: AssetsTableProps) {
    const {
        appRunner,
        query,
        initialProjectName,
        assetEvents,
        dispatchAssetEvent,
        assetListEvents,
        dispatchAssetListEvent,
        doOpenIde,
        doCloseIde: rawDoCloseIde,
        loadingProjectManagerDidFail,
        isListingRemoteDirectoryWhileOffline,
        isListingLocalDirectoryAndWillFail,
        isListingRemoteDirectoryAndWillFail,
    } = props
    const logger = loggerProvider.useLogger()
    const { organization, user, accessToken } = authProvider.useNonPartialUserSession()
    const { backend } = backendProvider.useBackend()
    const { setModal } = modalProvider.useSetModal()
    const [initialized, setInitialized] = React.useState(false)
    const [assetTree, setAssetTree] = React.useState<AssetTreeNode[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [extraColumns, setExtraColumns] = React.useState(
        () => new Set<columnModule.ExtraColumn>()
    )
    const [sortColumn, setSortColumn] = React.useState<columnModule.SortableColumn | null>(null)
    const [sortDirection, setSortDirection] = React.useState<sorting.SortDirection | null>(null)
    const [selectedKeys, setSelectedKeys] = React.useState(() => new Set<backendModule.AssetId>())
    const [nameOfProjectToImmediatelyOpen, setNameOfProjectToImmediatelyOpen] =
        React.useState(initialProjectName)
    const assetsMap = React.useMemo(
        () => new Map(assetTreePreorderTraversal(assetTree).map(asset => [asset.key, asset])),
        [assetTree]
    )
    const filter = React.useMemo(() => {
        if (query === '') {
            return null
        } else {
            const regex = new RegExp(string.regexEscape(query), 'i')
            return (node: AssetTreeNode) => regex.test(node.item.title)
        }
    }, [query])
    const displayItems = React.useMemo(() => {
        if (sortColumn == null || sortDirection == null) {
            return assetTreePreorderTraversal(assetTree)
        } else {
            const sortDescendingMultiplier = -1
            const multiplier = {
                [sorting.SortDirection.ascending]: 1,
                [sorting.SortDirection.descending]: sortDescendingMultiplier,
            }[sortDirection]
            let compare: (a: AssetTreeNode, b: AssetTreeNode) => number
            switch (sortColumn) {
                case columnModule.Column.name: {
                    compare = (a, b) =>
                        multiplier *
                        (a.item.title > b.item.title
                            ? 1
                            : a.item.title < b.item.title
                            ? COMPARE_LESS_THAN
                            : 0)
                    break
                }
                case columnModule.Column.modified: {
                    compare = (a, b) =>
                        multiplier *
                        (Number(new Date(a.item.modifiedAt)) - Number(new Date(b.item.modifiedAt)))
                    break
                }
            }
            return assetTreePreorderTraversal(assetTree, tree => tree.sort(compare))
        }
    }, [assetTree, sortColumn, sortDirection])

    React.useEffect(() => {
        setIsLoading(true)
    }, [backend])

    React.useEffect(() => {
        if (backend.type === backendModule.BackendType.local && loadingProjectManagerDidFail) {
            setIsLoading(false)
        }
    }, [loadingProjectManagerDidFail, backend.type])

    const overwriteAssets = React.useCallback(
        (newAssets: backendModule.AnyAsset[]) => {
            setAssetTree(
                newAssets.map(asset => ({
                    key: asset.id,
                    item: asset,
                    children: null,
                    depth: 0,
                }))
            )
            if (nameOfProjectToImmediatelyOpen != null) {
                const projectToLoad = newAssets
                    .filter(backendModule.assetIsProject)
                    .find(projectAsset => projectAsset.title === nameOfProjectToImmediatelyOpen)
                if (projectToLoad != null) {
                    dispatchAssetEvent({
                        type: assetEventModule.AssetEventType.openProject,
                        id: projectToLoad.id,
                    })
                }
                setNameOfProjectToImmediatelyOpen(null)
            }
            if (!initialized && initialProjectName != null) {
                setInitialized(true)
                if (!newAssets.some(asset => asset.title === initialProjectName)) {
                    const errorMessage = `No project named '${initialProjectName}' was found.`
                    toastify.toast.error(errorMessage)
                    logger.error(`Error opening project on startup: ${errorMessage}`)
                }
            }
        },
        [
            initialized,
            initialProjectName,
            logger,
            nameOfProjectToImmediatelyOpen,
            /* should never change */ setNameOfProjectToImmediatelyOpen,
            /* should never change */ dispatchAssetEvent,
        ]
    )

    React.useEffect(() => {
        overwriteAssets([])
        // `setAssets` is a callback, not a dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [backend])

    hooks.useAsyncEffect(
        null,
        async signal => {
            switch (backend.type) {
                case backendModule.BackendType.local: {
                    if (!isListingLocalDirectoryAndWillFail) {
                        const newAssets = await backend.listDirectory({ parentId: null }, null)
                        if (!signal.aborted) {
                            setIsLoading(false)
                            overwriteAssets(newAssets)
                        }
                    }
                    break
                }
                case backendModule.BackendType.remote: {
                    if (
                        !isListingRemoteDirectoryAndWillFail &&
                        !isListingRemoteDirectoryWhileOffline
                    ) {
                        const newAssets = await backend.listDirectory({ parentId: null }, null)
                        if (!signal.aborted) {
                            setIsLoading(false)
                            overwriteAssets(newAssets)
                        }
                    } else {
                        setIsLoading(false)
                    }
                    break
                }
            }
        },
        [accessToken, organization, backend]
    )

    React.useEffect(() => {
        setInitialized(true)
        const extraColumnsJson = localStorage.getItem(EXTRA_COLUMNS_KEY)
        if (extraColumnsJson != null) {
            const savedExtraColumns: unknown = JSON.parse(extraColumnsJson)
            if (
                Array.isArray(savedExtraColumns) &&
                savedExtraColumns.every(array.includesPredicate(columnModule.EXTRA_COLUMNS))
            ) {
                setExtraColumns(new Set(savedExtraColumns))
            }
        }
    }, [])

    React.useEffect(() => {
        if (initialized) {
            localStorage.setItem(EXTRA_COLUMNS_KEY, JSON.stringify(Array.from(extraColumns)))
        }
    }, [extraColumns, initialized])

    const directoryListAbortControllersRef = React.useRef(
        new Map<backendModule.DirectoryId, AbortController>()
    )
    const doToggleDirectoryExpansion = React.useCallback(
        (directoryId: backendModule.DirectoryId, key: backendModule.AssetId, title?: string) => {
            const directory = assetsMap.get(key)
            if (directory?.children != null) {
                const abortController = directoryListAbortControllersRef.current.get(directoryId)
                if (abortController != null) {
                    abortController.abort()
                    directoryListAbortControllersRef.current.delete(directoryId)
                }
                setAssetTree(oldAssetTree =>
                    assetTreeMap(oldAssetTree, item =>
                        item.key !== key ? item : { ...item, children: null }
                    )
                )
            } else {
                const loadingAsset: backendModule.SpecialLoadingAsset = {
                    type: backendModule.AssetType.specialLoading,
                    title: '',
                    id: backendModule.LoadingAssetId(uniqueString.uniqueString()),
                    modifiedAt: dateTime.toRfc3339(new Date()),
                    parentId: directoryId,
                    permissions: [],
                    projectState: null,
                }
                const loadingAssetNode: AssetTreeNode = {
                    key: loadingAsset.id,
                    item: loadingAsset,
                    children: null,
                    depth: 0,
                }
                setAssetTree(oldAssetTree =>
                    assetTreeMap(oldAssetTree, item =>
                        item.key !== key
                            ? item
                            : {
                                  ...item,
                                  children: [
                                      // `Object.assign` is dangerous because it can change the
                                      // type of an asset by adding extra properties.
                                      // However, it is convenient here.
                                      Object.assign(loadingAssetNode, { depth: item.depth + 1 }),
                                  ],
                              }
                    )
                )
                void (async () => {
                    const abortController = new AbortController()
                    directoryListAbortControllersRef.current.set(directoryId, abortController)
                    const childAssets = await backend.listDirectory(
                        { parentId: directoryId },
                        title ?? null
                    )
                    if (!abortController.signal.aborted) {
                        const childAssetNodes = childAssets.map(assetTreeNodeFromAsset)
                        setAssetTree(oldAssetTree =>
                            assetTreeMap(oldAssetTree, item => {
                                if (item.key !== key) {
                                    return item
                                } else {
                                    const initialChildren = item.children?.filter(
                                        child =>
                                            child.item.type !==
                                            backendModule.AssetType.specialLoading
                                    )
                                    const specialEmptyAsset: backendModule.SpecialEmptyAsset | null =
                                        (initialChildren != null && initialChildren.length !== 0) ||
                                        childAssetNodes.length !== 0
                                            ? null
                                            : {
                                                  type: backendModule.AssetType.specialEmpty,
                                                  title: '',
                                                  id: backendModule.EmptyAssetId(
                                                      uniqueString.uniqueString()
                                                  ),
                                                  modifiedAt: dateTime.toRfc3339(new Date()),
                                                  parentId: directoryId,
                                                  permissions: [],
                                                  projectState: null,
                                              }
                                    const children =
                                        specialEmptyAsset != null
                                            ? [
                                                  assetTreeNodeFromAsset(
                                                      specialEmptyAsset,
                                                      item.depth + 1
                                                  ),
                                              ]
                                            : initialChildren == null ||
                                              initialChildren.length === 0
                                            ? childAssetNodes
                                            : [...initialChildren, ...childAssetNodes].sort(
                                                  compareAssetTreeNodes
                                              )
                                    for (const child of children) {
                                        child.depth = item.depth + 1
                                    }
                                    return {
                                        ...item,
                                        children,
                                    }
                                }
                            })
                        )
                    }
                })()
            }
        },
        [assetsMap, backend]
    )

    const getNewProjectName = React.useCallback(
        (templateId: string | null, parentKey: backendModule.DirectoryId | null) => {
            const prefix = `${templateId ?? 'New_Project'}_`
            const projectNameTemplate = new RegExp(`^${prefix}(?<projectIndex>\\d+)$`)
            const siblings =
                parentKey == null
                    ? assetTree
                    : assetTreeDFS(assetTree, node => node.key === parentKey)?.children ?? []
            const projectIndices = siblings
                .filter(node => backendModule.assetIsProject(node.item))
                .map(node => projectNameTemplate.exec(node.item.title)?.groups?.projectIndex)
                .map(maybeIndex => (maybeIndex != null ? parseInt(maybeIndex, 10) : 0))
            return `${prefix}${Math.max(0, ...projectIndices) + 1}`
        },
        [assetTree]
    )

    hooks.useEventHandler(assetListEvents, event => {
        switch (event.type) {
            case assetListEventModule.AssetListEventType.newFolder: {
                const siblings =
                    event.parentKey == null
                        ? assetTree
                        : assetTreeDFS(assetTree, node => node.key === event.parentKey)?.children ??
                          []
                const directoryIndices = siblings
                    .filter(node => backendModule.assetIsProject(node.item))
                    .map(node => DIRECTORY_NAME_REGEX.exec(node.item.title))
                    .map(match => match?.groups?.directoryIndex)
                    .map(maybeIndex => (maybeIndex != null ? parseInt(maybeIndex, 10) : 0))
                const title = `${DIRECTORY_NAME_DEFAULT_PREFIX}${
                    Math.max(0, ...directoryIndices) + 1
                }`
                const placeholderItem: backendModule.DirectoryAsset = {
                    id: backendModule.DirectoryId(uniqueString.uniqueString()),
                    title,
                    modifiedAt: dateTime.toRfc3339(new Date()),
                    parentId: event.parentId ?? backend.rootDirectoryId(organization),
                    permissions: permissions.tryGetSingletonOwnerPermission(organization, user),
                    projectState: null,
                    type: backendModule.AssetType.directory,
                }
                const typeOrder = backendModule.ASSET_TYPE_ORDER[placeholderItem.type]
                if (
                    event.parentId != null &&
                    event.parentKey != null &&
                    assetTreeDFS(assetTree, node => node.key === event.parentKey)?.children == null
                ) {
                    doToggleDirectoryExpansion(event.parentId, event.parentKey)
                }
                setAssetTree(oldAssetTree =>
                    assetTreeMap(oldAssetTree, item =>
                        item.key !== event.parentKey
                            ? item
                            : {
                                  ...item,
                                  children: array.splicedBefore(
                                      (item.children ?? []).filter(
                                          node =>
                                              node.item.type !==
                                              backendModule.AssetType.specialEmpty
                                      ),
                                      [assetTreeNodeFromAsset(placeholderItem, item.depth + 1)],
                                      innerItem =>
                                          backendModule.ASSET_TYPE_ORDER[innerItem.item.type] >=
                                          typeOrder
                                  ),
                              }
                    )
                )
                dispatchAssetEvent({
                    type: assetEventModule.AssetEventType.newFolder,
                    placeholderId: placeholderItem.id,
                })
                break
            }
            case assetListEventModule.AssetListEventType.newProject: {
                const projectName = getNewProjectName(event.templateId, event.parentId)
                const dummyId = backendModule.ProjectId(uniqueString.uniqueString())
                const placeholderItem: backendModule.ProjectAsset = {
                    id: dummyId,
                    title: projectName,
                    modifiedAt: dateTime.toRfc3339(new Date()),
                    parentId: event.parentId ?? backend.rootDirectoryId(organization),
                    permissions: permissions.tryGetSingletonOwnerPermission(organization, user),
                    projectState: { type: backendModule.ProjectState.placeholder },
                    type: backendModule.AssetType.project,
                }
                const typeOrder = backendModule.ASSET_TYPE_ORDER[placeholderItem.type]
                if (
                    event.parentId != null &&
                    event.parentKey != null &&
                    assetTreeDFS(assetTree, node => node.key === event.parentKey)?.children == null
                ) {
                    doToggleDirectoryExpansion(event.parentId, event.parentKey)
                }
                setAssetTree(oldAssetTree =>
                    assetTreeMap(oldAssetTree, item =>
                        item.key !== event.parentKey
                            ? item
                            : {
                                  ...item,
                                  children: array.splicedBefore(
                                      (item.children ?? []).filter(
                                          node =>
                                              node.item.type !==
                                              backendModule.AssetType.specialEmpty
                                      ),
                                      [assetTreeNodeFromAsset(placeholderItem, item.depth + 1)],
                                      innerItem =>
                                          backendModule.ASSET_TYPE_ORDER[innerItem.item.type] >=
                                          typeOrder
                                  ),
                              }
                    )
                )
                dispatchAssetEvent({
                    type: assetEventModule.AssetEventType.newProject,
                    placeholderId: dummyId,
                    templateId: event.templateId,
                    onSpinnerStateChange: event.onSpinnerStateChange,
                })
                break
            }
            case assetListEventModule.AssetListEventType.uploadFiles: {
                const reversedFiles = Array.from(event.files).reverse()
                const parentId = event.parentId ?? backend.rootDirectoryId(organization)
                const placeholderFiles: backendModule.FileAsset[] = reversedFiles
                    .filter(backendModule.fileIsNotProject)
                    .map(file => ({
                        type: backendModule.AssetType.file,
                        id: backendModule.FileId(uniqueString.uniqueString()),
                        title: file.name,
                        parentId,
                        permissions: permissions.tryGetSingletonOwnerPermission(organization, user),
                        modifiedAt: dateTime.toRfc3339(new Date()),
                        projectState: null,
                    }))
                const placeholderProjects: backendModule.ProjectAsset[] = reversedFiles
                    .filter(backendModule.fileIsProject)
                    .map(file => ({
                        type: backendModule.AssetType.project,
                        id: backendModule.ProjectId(uniqueString.uniqueString()),
                        title: file.name,
                        parentId,
                        permissions: permissions.tryGetSingletonOwnerPermission(organization, user),
                        modifiedAt: dateTime.toRfc3339(new Date()),
                        projectState: {
                            type: backendModule.ProjectState.new,
                        },
                    }))
                const fileTypeOrder = backendModule.ASSET_TYPE_ORDER[backendModule.AssetType.file]
                const projectTypeOrder =
                    backendModule.ASSET_TYPE_ORDER[backendModule.AssetType.project]
                if (
                    event.parentId != null &&
                    event.parentKey != null &&
                    assetTreeDFS(assetTree, node => node.key === event.parentKey)?.children == null
                ) {
                    doToggleDirectoryExpansion(event.parentId, event.parentKey)
                }
                setAssetTree(oldAssetTree =>
                    assetTreeMap(oldAssetTree, item =>
                        item.key !== event.parentKey
                            ? item
                            : {
                                  ...item,
                                  children: array.spliceBefore(
                                      array.splicedBefore(
                                          (item.children ?? []).filter(
                                              node =>
                                                  node.item.type !==
                                                  backendModule.AssetType.specialEmpty
                                          ),
                                          placeholderFiles.map(assetTreeNodeFromAsset),
                                          innerItem =>
                                              backendModule.ASSET_TYPE_ORDER[innerItem.item.type] >=
                                              fileTypeOrder
                                      ),
                                      placeholderProjects.map(assetTreeNodeFromAsset),
                                      innerItem =>
                                          backendModule.ASSET_TYPE_ORDER[innerItem.item.type] >=
                                          projectTypeOrder
                                  ),
                              }
                    )
                )
                dispatchAssetEvent({
                    type: assetEventModule.AssetEventType.uploadFiles,
                    files: new Map(
                        [...placeholderFiles, ...placeholderProjects].map((placeholderItem, i) => [
                            placeholderItem.id,
                            // This is SAFE, as `placeholderItems` is created using a map on
                            // `event.files`.
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            event.files[i]!,
                        ])
                    ),
                })
                break
            }
            case assetListEventModule.AssetListEventType.newSecret: {
                const placeholderItem: backendModule.SecretAsset = {
                    id: backendModule.SecretId(uniqueString.uniqueString()),
                    title: event.name,
                    modifiedAt: dateTime.toRfc3339(new Date()),
                    parentId: event.parentId ?? backend.rootDirectoryId(organization),
                    permissions: permissions.tryGetSingletonOwnerPermission(organization, user),
                    projectState: null,
                    type: backendModule.AssetType.secret,
                }
                const typeOrder = backendModule.ASSET_TYPE_ORDER[placeholderItem.type]
                if (
                    event.parentId != null &&
                    event.parentKey != null &&
                    assetTreeDFS(assetTree, node => node.key === event.parentKey)?.children == null
                ) {
                    doToggleDirectoryExpansion(event.parentId, event.parentKey)
                }
                setAssetTree(oldAssetTree =>
                    assetTreeMap(oldAssetTree, item =>
                        item.key !== event.parentKey
                            ? item
                            : {
                                  ...item,
                                  children: array.splicedBefore(
                                      (item.children ?? []).filter(
                                          node =>
                                              node.item.type !==
                                              backendModule.AssetType.specialEmpty
                                      ),
                                      [assetTreeNodeFromAsset(placeholderItem, item.depth + 1)],
                                      innerItem =>
                                          backendModule.ASSET_TYPE_ORDER[innerItem.item.type] >=
                                          typeOrder
                                  ),
                              }
                    )
                )
                dispatchAssetEvent({
                    type: assetEventModule.AssetEventType.newSecret,
                    placeholderId: placeholderItem.id,
                    value: event.value,
                })
                break
            }
            case assetListEventModule.AssetListEventType.delete: {
                setAssetTree(oldAssetTree =>
                    assetTreeFilter(oldAssetTree, item => item.item.id !== event.id, true)
                )
                break
            }
        }
    })

    const doOpenManually = React.useCallback(
        (projectId: backendModule.ProjectId) => {
            dispatchAssetEvent({
                type: assetEventModule.AssetEventType.openProject,
                id: projectId,
            })
        },
        [/* should never change */ dispatchAssetEvent]
    )

    const doCloseIde = React.useCallback(() => {
        dispatchAssetEvent({
            type: assetEventModule.AssetEventType.cancelOpeningAllProjects,
        })
        rawDoCloseIde()
    }, [rawDoCloseIde, /* should never change */ dispatchAssetEvent])

    const state = React.useMemo(
        // The type MUST be here to trigger excess property errors at typecheck time.
        (): AssetsTableState => ({
            appRunner,
            sortColumn,
            setSortColumn,
            sortDirection,
            setSortDirection,
            assetEvents,
            dispatchAssetEvent,
            dispatchAssetListEvent,
            doToggleDirectoryExpansion,
            doOpenManually,
            doOpenIde,
            doCloseIde,
        }),
        [
            appRunner,
            sortColumn,
            sortDirection,
            assetEvents,
            doOpenManually,
            doOpenIde,
            doCloseIde,
            doToggleDirectoryExpansion,
            /* should never change */ setSortColumn,
            /* should never change */ setSortDirection,
            /* should never change */ dispatchAssetEvent,
            /* should never change */ dispatchAssetListEvent,
        ]
    )

    return (
        <div className="flex-1 overflow-auto">
            <div className="flex flex-col w-min min-w-full h-full">
                <div className="h-0">
                    <div className="block sticky right-0 px-2 py-1 ml-auto mt-3.5 w-29 z-10">
                        <div className="inline-flex gap-3">
                            {columnModule.EXTRA_COLUMNS.map(column => (
                                <Button
                                    key={column}
                                    active={extraColumns.has(column)}
                                    image={columnModule.EXTRA_COLUMN_IMAGES[column]}
                                    onClick={() => {
                                        const newExtraColumns = new Set(extraColumns)
                                        if (extraColumns.has(column)) {
                                            newExtraColumns.delete(column)
                                        } else {
                                            newExtraColumns.add(column)
                                        }
                                        setExtraColumns(newExtraColumns)
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <Table<AssetTreeNode, AssetsTableState, AssetRowState, backendModule.AssetId>
                    footer={<tfoot className="h-full"></tfoot>}
                    rowComponent={AssetRow}
                    items={displayItems}
                    filter={filter}
                    isLoading={isLoading}
                    state={state}
                    initialRowState={INITIAL_ROW_STATE}
                    getKey={getAssetTreeNodeKey}
                    selectedKeys={selectedKeys}
                    setSelectedKeys={setSelectedKeys}
                    placeholder={PLACEHOLDER}
                    columns={columnModule.getColumnList(backend.type, extraColumns).map(column => ({
                        id: column,
                        className: columnModule.COLUMN_CSS_CLASS[column],
                        heading: columnModule.COLUMN_HEADING[column],
                        render: columnModule.COLUMN_RENDERER[column],
                    }))}
                    onContextMenu={(innerSelectedKeys, event, innerSetSelectedKeys) => {
                        event.preventDefault()
                        event.stopPropagation()
                        const pluralized = pluralize(innerSelectedKeys.size)
                        // This is not a React component even though it contains JSX.
                        // eslint-disable-next-line no-restricted-syntax
                        const doDeleteAll = () => {
                            setModal(
                                <ConfirmDeleteModal
                                    description={`${innerSelectedKeys.size} selected ${pluralized}`}
                                    doDelete={() => {
                                        innerSetSelectedKeys(new Set())
                                        dispatchAssetEvent({
                                            type: assetEventModule.AssetEventType.deleteMultiple,
                                            ids: innerSelectedKeys,
                                        })
                                        return Promise.resolve()
                                    }}
                                />
                            )
                        }
                        setModal(
                            <ContextMenus key={uniqueString.uniqueString()} event={event}>
                                {innerSelectedKeys.size !== 0 && (
                                    <ContextMenu>
                                        <ContextMenuEntry
                                            action={shortcuts.KeyboardAction.moveAllToTrash}
                                            doAction={doDeleteAll}
                                        />
                                    </ContextMenu>
                                )}
                                <GlobalContextMenu
                                    directoryKey={null}
                                    directoryId={null}
                                    dispatchAssetListEvent={dispatchAssetListEvent}
                                />
                            </ContextMenus>
                        )
                    }}
                />
            </div>
        </div>
    )
}
