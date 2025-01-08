/** @file The React provider (and associated hooks) for Data Catalog state. */
import * as React from 'react'

import * as zustand from '#/utilities/zustand'
import invariant from 'tiny-invariant'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import type { Category, CategoryId } from '#/layouts/CategorySwitcher/Category'
import {
  useCategoriesAPI,
  type CategoriesContextValue,
} from '#/layouts/Drive/Categories/categoriesHooks'
import type { LaunchedProject } from '#/providers/ProjectsProvider'
import type LocalBackend from '#/services/LocalBackend'
import type RemoteBackend from '#/services/RemoteBackend'
import type AssetTreeNode from '#/utilities/AssetTreeNode'
import type { PasteData } from '#/utilities/pasteData'
import { EMPTY_SET } from '#/utilities/set'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  BackendType,
  type AssetId,
  type DirectoryAsset,
  type DirectoryId,
} from 'enso-common/src/services/Backend'

// ==================
// === DriveStore ===
// ==================

/** Attached data for a paste payload. */
export interface DrivePastePayload {
  readonly backendType: BackendType
  readonly category: Category
  readonly ids: ReadonlySet<AssetId>
}

/** The state of this zustand store. */
interface DriveStore {
  readonly resetAssetTableState: () => void
  readonly targetDirectory: AssetTreeNode<DirectoryAsset> | null
  readonly setTargetDirectory: (targetDirectory: AssetTreeNode<DirectoryAsset> | null) => void
  readonly newestFolderId: DirectoryId | null
  readonly setNewestFolderId: (newestFolderId: DirectoryId | null) => void
  readonly canCreateAssets: boolean
  readonly setCanCreateAssets: (canCreateAssets: boolean) => void
  readonly canDownload: boolean
  readonly setCanDownload: (canDownload: boolean) => void
  readonly pasteData: PasteData<DrivePastePayload> | null
  readonly setPasteData: (pasteData: PasteData<DrivePastePayload> | null) => void
  readonly expandedDirectories: Record<CategoryId, ReadonlySet<DirectoryId>>
  readonly setExpandedDirectories: (
    selectedKeys: Record<CategoryId, ReadonlySet<DirectoryId>>,
  ) => void
  readonly selectedKeys: ReadonlySet<AssetId>
  readonly setSelectedKeys: (selectedKeys: ReadonlySet<AssetId>) => void
  readonly visuallySelectedKeys: ReadonlySet<AssetId> | null
  readonly setVisuallySelectedKeys: (visuallySelectedKeys: ReadonlySet<AssetId> | null) => void
}

// =======================
// === ProjectsContext ===
// =======================

/** State contained in a `ProjectsContext`. */
export type ProjectsContextType = zustand.StoreApi<DriveStore>

const DriveContext = React.createContext<ProjectsContextType | null>(null)

/** Props for a {@link DriveProvider}. */
export interface ProjectsProviderProps {
  readonly children:
    | React.ReactNode
    | ((context: {
        readonly store: ProjectsContextType
        readonly resetAssetTableState: () => void
      }) => React.ReactNode)
  readonly launchedProjects: readonly LaunchedProject[]
  readonly categoriesAPI: CategoriesContextValue
  readonly remoteBackend: RemoteBackend
  readonly localBackend: LocalBackend | null
}

/** Compute the initial set of expanded directories. */
async function computeInitialExpandedDirectories(
  launchedProjects: readonly LaunchedProject[],
  categoriesAPI: CategoriesContextValue,
  remoteBackend: RemoteBackend,
  localBackend: LocalBackend | null,
) {
  const { cloudCategories, localCategories } = categoriesAPI
  const expandedDirectories: Record<CategoryId, Set<DirectoryId>> = {
    cloud: new Set(),
    recent: new Set(),
    trash: new Set(),
    local: new Set(),
  }
  const promises: Promise<void>[] = []
  for (const category of [...cloudCategories.categories, ...localCategories.categories]) {
    const set = (expandedDirectories[category.id] ??= new Set())
    for (const project of launchedProjects) {
      const backend = project.type === BackendType.remote ? remoteBackend : localBackend
      if (!backend) {
        continue
      }
      promises.push(
        backend.tryGetAssetAncestors(project, category.id).then((ancestors) => {
          if (!ancestors) {
            return
          }
          for (const ancestor of ancestors) {
            set.add(ancestor)
          }
        }),
      )
    }
  }

  await Promise.all(promises)
  return expandedDirectories
}

/**
 * A React provider (and associated hooks) for determining whether the current area
 * containing the current element is focused.
 */
export default function DriveProvider(props: ProjectsProviderProps) {
  const { children, launchedProjects, categoriesAPI, remoteBackend, localBackend } = props

  const { data: initialExpandedDirectories } = useSuspenseQuery({
    queryKey: ['computeInitialExpandedDirectories'],
    queryFn: () =>
      computeInitialExpandedDirectories(
        launchedProjects,
        categoriesAPI,
        remoteBackend,
        localBackend,
      ),
    staleTime: Infinity,
    meta: {
      // The query is not JSON-serializable as-is, so it MUST NOT be persisted.
      persist: false,
    },
  })

  const [store] = React.useState(() =>
    zustand.createStore<DriveStore>((set, get) => ({
      resetAssetTableState: () => {
        set({
          targetDirectory: null,
          selectedKeys: EMPTY_SET,
          visuallySelectedKeys: null,
        })
      },
      targetDirectory: null,
      setTargetDirectory: (targetDirectory) => {
        if (get().targetDirectory !== targetDirectory) {
          set({ targetDirectory })
        }
      },
      newestFolderId: null,
      setNewestFolderId: (newestFolderId) => {
        if (get().newestFolderId !== newestFolderId) {
          set({ newestFolderId })
        }
      },
      canCreateAssets: true,
      setCanCreateAssets: (canCreateAssets) => {
        if (get().canCreateAssets !== canCreateAssets) {
          set({ canCreateAssets })
        }
      },
      canDownload: false,
      setCanDownload: (canDownload) => {
        if (get().canDownload !== canDownload) {
          set({ canDownload })
        }
      },
      pasteData: null,
      setPasteData: (pasteData) => {
        if (get().pasteData !== pasteData) {
          set({ pasteData })
        }
      },
      expandedDirectories: initialExpandedDirectories,
      setExpandedDirectories: (expandedDirectories) => {
        if (get().expandedDirectories !== expandedDirectories) {
          set({ expandedDirectories })
        }
      },
      selectedKeys: EMPTY_SET,
      setSelectedKeys: (selectedKeys) => {
        set({ selectedKeys })
      },
      visuallySelectedKeys: null,
      setVisuallySelectedKeys: (visuallySelectedKeys) => {
        set({ visuallySelectedKeys })
      },
    })),
  )

  const resetAssetTableState = zustand.useStore(store, (state) => state.resetAssetTableState)

  return (
    <DriveContext.Provider value={store}>
      {typeof children === 'function' ? children({ store, resetAssetTableState }) : children}
    </DriveContext.Provider>
  )
}

/** The drive store. */
export function useDriveStore() {
  const store = React.useContext(DriveContext)

  invariant(store, 'Drive store can only be used inside an `DriveProvider`.')

  return store
}

/** The target directory of the Asset Table selection. */
export function useTargetDirectory() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.targetDirectory)
}

/** A function to set the target directory of the Asset Table selection. */
export function useSetTargetDirectory() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.setTargetDirectory)
}

/** The ID of the most newly created folder. */
export function useNewestFolderId() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.newestFolderId)
}

/** A function to set the ID of the most newly created folder. */
export function useSetNewestFolderId() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.setNewestFolderId)
}

/** Whether assets can be created in the current directory. */
export function useCanCreateAssets() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.canCreateAssets)
}

/** A function to set whether assets can be created in the current directory. */
export function useSetCanCreateAssets() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.setCanCreateAssets)
}

/** Whether the current Asset Table selection is downloadble. */
export function useCanDownload() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.canDownload)
}

/** A function to set whether the current Asset Table selection is downloadble. */
export function useSetCanDownload() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.setCanDownload)
}

/** The paste data for the Asset Table. */
export function usePasteData() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.pasteData)
}

/** A function to set the paste data for the Asset Table. */
export function useSetPasteData() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.setPasteData)
}

/** The expanded directories in the Asset Table. */
export function useExpandedDirectories() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.expandedDirectories)
}

/** A function to set the expanded directoyIds in the Asset Table. */
export function useSetExpandedDirectories() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.setExpandedDirectories, {
    unsafeEnableTransition: true,
  })
}

/** The selected keys in the Asset Table. */
export function useSelectedKeys() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.selectedKeys)
}

/** A function to set the selected keys in the Asset Table. */
export function useSetSelectedKeys() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.setSelectedKeys)
}

/** The visually selected keys in the Asset Table. */
export function useVisuallySelectedKeys() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.selectedKeys, {
    unsafeEnableTransition: true,
  })
}

/** A function to set the visually selected keys in the Asset Table. */
export function useSetVisuallySelectedKeys() {
  const store = useDriveStore()
  return zustand.useStore(store, (state) => state.setVisuallySelectedKeys, {
    unsafeEnableTransition: true,
  })
}

/** Toggle whether a specific directory is expanded. */
export function useToggleDirectoryExpansion() {
  const driveStore = useDriveStore()
  const { category } = useCategoriesAPI()
  const setExpandedDirectories = useSetExpandedDirectories()

  return useEventCallback((id: DirectoryId, override?: boolean) => {
    const expandedDirectories = driveStore.getState().expandedDirectories
    const isExpanded = expandedDirectories[category.id]?.has(id) ?? false
    const shouldExpand = override ?? !isExpanded

    if (shouldExpand !== isExpanded) {
      React.startTransition(() => {
        const directories = expandedDirectories[category.id] ?? []
        const newDirectories = new Set(directories)
        if (shouldExpand) {
          newDirectories.add(id)
        } else {
          newDirectories.delete(id)
        }
        setExpandedDirectories({
          ...expandedDirectories,
          [category.id]: newDirectories,
        })
      })
    }
  })
}
