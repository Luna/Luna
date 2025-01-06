/**
 * @file Main dashboard component, responsible for listing user's projects as well as other
 * interactive components.
 */
import * as React from 'react'

import * as detect from 'enso-common/src/detect'

import { DashboardTabBar } from './DashboardTabBar'

import * as eventCallbacks from '#/hooks/eventCallbackHooks'
import * as projectHooks from '#/hooks/projectHooks'
import { CategoriesProvider } from '#/layouts/Drive/Categories/categoriesHooks'
import DriveProvider from '#/providers/DriveProvider'

import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'
import * as inputBindingsProvider from '#/providers/InputBindingsProvider'
import * as modalProvider from '#/providers/ModalProvider'
import ProjectsProvider, {
  TabType,
  useClearLaunchedProjects,
  useLaunchedProjects,
  usePage,
  useProjectsStore,
  useSetPage,
  type LaunchedProject,
} from '#/providers/ProjectsProvider'

import AssetListEventType from '#/events/AssetListEventType'

import type * as assetTable from '#/layouts/AssetsTable'
import Chat from '#/layouts/Chat'
import ChatPlaceholder from '#/layouts/ChatPlaceholder'
import EventListProvider, * as eventListProvider from '#/layouts/Drive/EventListProvider'
import type * as editor from '#/layouts/Editor'
import UserBar from '#/layouts/UserBar'

import * as aria from '#/components/aria'
import Page from '#/components/Page'

import ManagePermissionsModal from '#/modals/ManagePermissionsModal'

import * as backendModule from '#/services/Backend'
import * as localBackendModule from '#/services/LocalBackend'
import * as projectManager from '#/services/ProjectManager'

import { listDirectoryQueryOptions, useBackendQuery } from '#/hooks/backendHooks'
import { useCategoriesAPI } from '#/layouts/Drive/Categories/categoriesHooks'
import { useDriveStore, useSetExpandedDirectories } from '#/providers/DriveProvider'
import { userGroupIdToDirectoryId, userIdToDirectoryId } from '#/services/RemoteBackend'
import { TEAMS_DIRECTORY_ID, USERS_DIRECTORY_ID } from '#/services/remoteBackendPaths'
import { baseName } from '#/utilities/fileInfo'
import { tryFindSelfPermission } from '#/utilities/permissions'
import { STATIC_QUERY_OPTIONS } from '#/utilities/reactQuery'
import * as sanitizedEventTargets from '#/utilities/sanitizedEventTargets'
import { usePrefetchQuery, useQueryClient } from '@tanstack/react-query'
import { EMPTY_ARRAY } from 'enso-common/src/utilities/data/array'
import { unsafeEntries, unsafeMutable } from 'enso-common/src/utilities/data/object'
import invariant from 'tiny-invariant'
import { DashboardTabPanels } from './DashboardTabPanels'

// =================
// === Dashboard ===
// =================

/** Props for {@link Dashboard}s that are common to all platforms. */
export interface DashboardProps {
  /** Whether the application may have the local backend running. */
  readonly supportsLocalBackend: boolean
  readonly appRunner: editor.GraphEditorRunner | null
  readonly initialProjectName: string | null
  readonly ydocUrl: string | null
}

/** The component that contains the entire UI. */
export default function Dashboard(props: DashboardProps) {
  return (
    /* Ideally this would be in `Drive.tsx`, but it currently must be all the way out here
     * due to modals being in `TheModal`. */
    <DriveProvider>
      {({ resetAssetTableState }) => (
        <CategoriesProvider onCategoryChange={resetAssetTableState}>
          <EventListProvider>
            <ProjectsProvider>
              <OpenedProjectsParentsExpander />
              <DashboardInner {...props} />
            </ProjectsProvider>
          </EventListProvider>
        </CategoriesProvider>
      )}
    </DriveProvider>
  )
}

/** Extract proper path from `file://` URL. */
function fileURLToPath(url: string): string | null {
  if (URL.canParse(url)) {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:') {
      return decodeURIComponent(
        detect.platform() === detect.Platform.windows ?
          // On Windows, we must remove leading `/` from URL.
          parsed.pathname.slice(1)
        : parsed.pathname,
      )
    } else {
      return null
    }
  } else {
    return null
  }
}

/** The component that contains the entire UI. */
function DashboardInner(props: DashboardProps) {
  const { appRunner, initialProjectName: initialProjectNameRaw, ydocUrl } = props
  const { user } = authProvider.useFullUserSession()
  const localBackend = backendProvider.useLocalBackend()
  const { modalRef } = modalProvider.useModalRef()
  const { updateModal, unsetModal, setModal } = modalProvider.useSetModal()
  const inputBindings = inputBindingsProvider.useInputBindings()
  const [isHelpChatOpen, setIsHelpChatOpen] = React.useState(false)

  const dispatchAssetListEvent = eventListProvider.useDispatchAssetListEvent()
  const assetManagementApiRef = React.useRef<assetTable.AssetManagementApi | null>(null)

  const initialLocalProjectPath =
    initialProjectNameRaw != null ? fileURLToPath(initialProjectNameRaw) : null
  const initialProjectName = initialLocalProjectPath != null ? null : initialProjectNameRaw

  const categoriesAPI = useCategoriesAPI()

  const projectsStore = useProjectsStore()
  const page = usePage()
  const launchedProjects = useLaunchedProjects()
  // There is no shared enum type, but the other union member is the same type.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  const selectedProject = launchedProjects.find((p) => p.id === page) ?? null

  const setPage = useSetPage()
  const openEditor = projectHooks.useOpenEditor()
  const openProject = projectHooks.useOpenProject()
  const closeProject = projectHooks.useCloseProject()
  const closeAllProjects = projectHooks.useCloseAllProjects()
  const clearLaunchedProjects = useClearLaunchedProjects()

  usePrefetchQuery({
    queryKey: ['loadInitialLocalProject'],
    networkMode: 'always',
    ...STATIC_QUERY_OPTIONS,
    queryFn: async () => {
      if (initialLocalProjectPath != null && window.backendApi && localBackend) {
        const projectName = baseName(initialLocalProjectPath)
        const { id } = await window.backendApi.importProjectFromPath(
          initialLocalProjectPath,
          localBackend.rootPath(),
          projectName,
        )
        openProject({
          type: backendModule.BackendType.local,
          id: localBackendModule.newProjectId(projectManager.UUID(id)),
          title: projectName,
          parentId: localBackendModule.newDirectoryId(localBackend.rootPath()),
        })
      }
      return null
    },
    staleTime: Infinity,
  })

  React.useEffect(() => {
    window.projectManagementApi?.setOpenProjectHandler((project) => {
      categoriesAPI.setCategory('local')

      const projectId = localBackendModule.newProjectId(projectManager.UUID(project.id))

      openProject({
        type: backendModule.BackendType.local,
        id: projectId,
        title: project.name,
        parentId: localBackendModule.newDirectoryId(backendModule.Path(project.parentDirectory)),
      })
    })

    return () => {
      window.projectManagementApi?.setOpenProjectHandler(() => {})
    }
  }, [dispatchAssetListEvent, openEditor, openProject, categoriesAPI])

  React.useEffect(
    () =>
      inputBindings.attach(sanitizedEventTargets.document.body, 'keydown', {
        closeModal: () => {
          updateModal((oldModal) => {
            if (oldModal == null) {
              const currentPage = projectsStore.getState().page
              if (currentPage === TabType.settings) {
                setPage(TabType.drive)
              }
            }
            return null
          })
          if (modalRef.current == null) {
            return false
          }
        },
      }),
    [inputBindings, modalRef, updateModal, setPage, projectsStore],
  )

  React.useEffect(() => {
    if (detect.isOnElectron()) {
      // We want to handle the back and forward buttons in electron the same way as in the browser.
      return inputBindings.attach(sanitizedEventTargets.document.body, 'keydown', {
        goBack: () => {
          window.navigationApi.goBack()
        },
        goForward: () => {
          window.navigationApi.goForward()
        },
      })
    }
  }, [inputBindings])

  const doRemoveSelf = eventCallbacks.useEventCallback((project: LaunchedProject) => {
    dispatchAssetListEvent({ type: AssetListEventType.removeSelf, id: project.id })
    closeProject(project)
  })

  const onSignOut = eventCallbacks.useEventCallback(() => {
    setPage(TabType.drive)
    closeAllProjects()
    clearLaunchedProjects()
  })

  const doOpenShareModal = eventCallbacks.useEventCallback(() => {
    if (assetManagementApiRef.current != null && selectedProject != null) {
      const asset = assetManagementApiRef.current.getAsset(selectedProject.id)
      const self = tryFindSelfPermission(user, asset?.permissions)

      if (asset != null && self != null) {
        setModal(
          <ManagePermissionsModal
            backend={categoriesAPI.associatedBackend}
            category={categoriesAPI.category}
            item={asset}
            self={self}
            doRemoveSelf={() => {
              doRemoveSelf(selectedProject)
            }}
            eventTarget={null}
          />,
        )
      }
    }
  })

  const goToSettings = eventCallbacks.useEventCallback(() => {
    setPage(TabType.settings)
  })

  return (
    <Page hideInfoBar hideChat>
      <div
        className="flex min-h-full flex-col text-xs text-primary"
        onContextMenu={(event) => {
          event.preventDefault()
          unsetModal()
        }}
      >
        <aria.Tabs
          className="relative flex min-h-full grow select-none flex-col container-size"
          selectedKey={page}
          onSelectionChange={(newPage) => {
            // This is safe as we render only valid pages.
            // eslint-disable-next-line no-restricted-syntax
            setPage(newPage as TabType)
          }}
        >
          <div className="flex">
            <DashboardTabBar onCloseProject={closeProject} onOpenEditor={openEditor} />

            <UserBar
              onShareClick={selectedProject ? doOpenShareModal : undefined}
              setIsHelpChatOpen={setIsHelpChatOpen}
              goToSettingsPage={goToSettings}
              onSignOut={onSignOut}
            />
          </div>

          <DashboardTabPanels
            appRunner={appRunner}
            initialProjectName={initialProjectName}
            ydocUrl={ydocUrl}
            assetManagementApiRef={assetManagementApiRef}
          />
        </aria.Tabs>

        {process.env.ENSO_CLOUD_CHAT_URL != null ?
          <Chat
            isOpen={isHelpChatOpen}
            doClose={() => {
              setIsHelpChatOpen(false)
            }}
            endpoint={process.env.ENSO_CLOUD_CHAT_URL}
          />
        : <ChatPlaceholder
            isOpen={isHelpChatOpen}
            doClose={() => {
              setIsHelpChatOpen(false)
            }}
          />
        }
      </div>
    </Page>
  )
}

/** Expand the list of parents for opened projects. */
function OpenedProjectsParentsExpander() {
  const queryClient = useQueryClient()
  const remoteBackend = backendProvider.useRemoteBackend()
  const localBackend = backendProvider.useLocalBackend()
  const categoriesAPI = useCategoriesAPI()
  const { category, cloudCategories, localCategories } = categoriesAPI
  const driveStore = useDriveStore()
  const launchedProjects = useLaunchedProjects()
  const setExpandedDirectories = useSetExpandedDirectories()
  const { user } = authProvider.useFullUserSession()
  const { data: userGroups } = useBackendQuery(remoteBackend, 'listUserGroups', [])
  const { data: users } = useBackendQuery(remoteBackend, 'listUsers', [])

  const updateOpenedProjects = eventCallbacks.useEventCallback(async () => {
    const userGroupDirectoryIds = new Set(
      (user.userGroups ?? EMPTY_ARRAY).map(userGroupIdToDirectoryId),
    )

    const expandedDirectories = structuredClone(driveStore.getState().expandedDirectories)
    for (const otherCategory of [...cloudCategories.categories, ...localCategories.categories]) {
      expandedDirectories[otherCategory.rootPath] ??= []
    }

    if (localBackend) {
      const localProjects = launchedProjects.filter(
        (project) => project.type === backendModule.BackendType.local,
      )
      for (const project of localProjects) {
        const path = localBackendModule.extractTypeAndId(project.parentId).id
        for (const [rootPath, directoriesInCategory] of unsafeEntries(expandedDirectories)) {
          const strippedPath = path.replace(`${rootPath}/`, '')
          if (strippedPath !== path) {
            let parentPath = String(rootPath)
            const parents = strippedPath.split('/')
            for (const parent of parents) {
              parentPath += `/${parent}`
              const currentParentPath = backendModule.Path(parentPath)
              const currentParentId = localBackendModule.newDirectoryId(currentParentPath)
              if (!backendModule.isDescendantPath(currentParentPath, rootPath)) {
                continue
              }
              if (directoriesInCategory.includes(currentParentId)) {
                continue
              }
              const id = localBackendModule.newDirectoryId(currentParentPath)
              // This is SAFE as the value has been `structuredClone`d above.
              unsafeMutable(directoriesInCategory).push(id)
            }
          }
        }
      }
    }

    const cloudProjects = launchedProjects.filter(
      (project) => project.type === backendModule.BackendType.remote,
    )
    const promises = cloudProjects.map((project) =>
      queryClient.ensureQueryData(
        listDirectoryQueryOptions({
          backend: remoteBackend,
          parentId: project.parentId,
          categoryType: category.type,
        }),
      ),
    )
    const projectsSiblings = await Promise.allSettled(promises)
    const projects = projectsSiblings.flatMap((directoryResult, i) => {
      const projectInfo = cloudProjects[i]
      const project =
        projectInfo && directoryResult.status === 'fulfilled' ?
          directoryResult.value
            .filter(backendModule.assetIsProject)
            .find((asset) => asset.id === projectInfo.id)
        : null
      return project ? [project] : []
    })
    for (const project of projects) {
      const parents = project.parentsPath.split('/').filter(backendModule.isDirectoryId)
      const rootDirectoryId = parents[0]
      const baseVirtualPath = (() => {
        const userGroupName = userGroups?.find(
          (userGroup) => userGroupIdToDirectoryId(userGroup.id) === rootDirectoryId,
        )?.groupName
        if (userGroupName != null) {
          return `enso://Teams/${userGroupName}`
        }
        const userName = users?.find(
          (otherUser) => userIdToDirectoryId(otherUser.userId) === rootDirectoryId,
        )?.name
        if (userName != null) {
          return `enso://Users/${userGroupName}`
        }
      })()
      const virtualPath = backendModule.Path(`${baseVirtualPath}/${project.virtualParentsPath}`)
      invariant(
        baseVirtualPath != null,
        'The root directory must be either a user directory or a team directory.',
      )
      for (const [categoryRootPath, directoriesInCategoryRaw] of unsafeEntries(
        expandedDirectories,
      )) {
        const directoriesInCategory = unsafeMutable(directoriesInCategoryRaw)
        if (!backendModule.isDescendantPath(virtualPath, categoryRootPath)) {
          continue
        }
        if ((rootDirectoryId && userGroupDirectoryIds.has(rootDirectoryId)) ?? false) {
          directoriesInCategory.push(TEAMS_DIRECTORY_ID)
        } else {
          directoriesInCategory.push(USERS_DIRECTORY_ID)
        }
        for (const parent of parents) {
          directoriesInCategory.push(parent)
        }
      }
    }

    setExpandedDirectories(expandedDirectories)
  })

  React.useEffect(() => {
    void updateOpenedProjects()
  }, [updateOpenedProjects])

  return null
}
