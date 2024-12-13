/**
 * @file Main dashboard component, responsible for listing user's projects as well as other
 * interactive components.
 */
import { useEffect, useRef, useState } from 'react'

import { usePrefetchQuery } from '@tanstack/react-query'

import { isOnElectron, platform, Platform } from 'enso-common/src/detect'
import { BackendType, Path } from 'enso-common/src/services/Backend'
import { baseName } from 'enso-common/src/utilities/data/fileInfo'

import { Tabs } from '#/components/aria'
import Page from '#/components/Page'
import AssetListEventType from '#/events/AssetListEventType'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import {
  useCloseAllProjects,
  useCloseProject,
  useOpenEditor,
  useOpenProject,
} from '#/hooks/projectHooks'
import { useSearchParamsState } from '#/hooks/searchParamsStateHooks'
import type { AssetManagementApi } from '#/layouts/AssetsTable'
import { Category, CATEGORY_SCHEMA } from '#/layouts/CategorySwitcher/Category'
import Chat from '#/layouts/Chat'
import ChatPlaceholder from '#/layouts/ChatPlaceholder'
import EventListProvider, { useDispatchAssetListEvent } from '#/layouts/Drive/EventListProvider'
import type { GraphEditorRunner } from '#/layouts/Editor'
import UserBar from '#/layouts/UserBar'
import ManagePermissionsModal from '#/modals/ManagePermissionsModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useBackend, useLocalBackend } from '#/providers/BackendProvider'
import { useSetCategory } from '#/providers/DriveProvider'
import { useInputBindings } from '#/providers/InputBindingsProvider'
import { useModalRef, useSetModal } from '#/providers/ModalProvider'
import ProjectsProvider, {
  TabType,
  useClearLaunchedProjects,
  useLaunchedProjects,
  usePage,
  useProjectsStore,
  useSetPage,
  type LaunchedProject,
} from '#/providers/ProjectsProvider'
import { newDirectoryId, newProjectId } from '#/services/LocalBackend'
import { UUID } from '#/services/ProjectManager'
import { tryFindSelfPermission } from '#/utilities/permissions'
import { STATIC_QUERY_OPTIONS } from '#/utilities/reactQuery'
import { document } from '#/utilities/sanitizedEventTargets'
import { DashboardTabBar } from './DashboardTabBar'
import { DashboardTabPanels } from './DashboardTabPanels'

/** Props for {@link Dashboard}s that are common to all platforms. */
export interface DashboardProps {
  /** Whether the application may have the local backend running. */
  readonly supportsLocalBackend: boolean
  readonly appRunner: GraphEditorRunner | null
  readonly initialProjectName: string | null
  readonly ydocUrl: string | null
}

/** The component that contains the entire UI. */
export default function Dashboard(props: DashboardProps) {
  return (
    <EventListProvider>
      <ProjectsProvider>
        <DashboardInner {...props} />
      </ProjectsProvider>
    </EventListProvider>
  )
}

/** Extract proper path from `file://` URL. */
function fileURLToPath(url: string): string | null {
  if (URL.canParse(url)) {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:') {
      return decodeURIComponent(
        platform() === Platform.windows ?
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
  const { user } = useFullUserSession()
  const localBackend = useLocalBackend()
  const { modalRef } = useModalRef()
  const { updateModal, unsetModal, setModal } = useSetModal()
  const inputBindings = useInputBindings()
  const [isHelpChatOpen, setIsHelpChatOpen] = useState(false)

  const dispatchAssetListEvent = useDispatchAssetListEvent()
  const assetManagementApiRef = useRef<AssetManagementApi | null>(null)

  const initialLocalProjectPath =
    initialProjectNameRaw != null ? fileURLToPath(initialProjectNameRaw) : null
  const initialProjectName = initialLocalProjectPath != null ? null : initialProjectNameRaw

  const [category, setCategoryRaw, resetCategory] = useSearchParamsState<Category>(
    'driveCategory',
    () => (localBackend != null ? { type: 'local' } : { type: 'cloud' }),
    (value): value is Category => CATEGORY_SCHEMA.safeParse(value).success,
  )

  const initialCategory = useRef(category)
  const setStoreCategory = useSetCategory()
  useEffect(() => {
    setStoreCategory(initialCategory.current)
  }, [setStoreCategory])

  const setCategory = useEventCallback((newCategory: Category) => {
    setCategoryRaw(newCategory)
    setStoreCategory(newCategory)
  })
  const backend = useBackend(category)

  const projectsStore = useProjectsStore()
  const page = usePage()
  const launchedProjects = useLaunchedProjects()
  // There is no shared enum type, but the other union member is the same type.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  const selectedProject = launchedProjects.find((p) => p.id === page) ?? null

  const setPage = useSetPage()
  const openEditor = useOpenEditor()
  const openProject = useOpenProject()
  const closeProject = useCloseProject()
  const closeAllProjects = useCloseAllProjects()
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
          type: BackendType.local,
          id: newProjectId(UUID(id)),
          title: projectName,
          parentId: newDirectoryId(localBackend.rootPath()),
        })
      }
      return null
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    window.projectManagementApi?.setOpenProjectHandler((project) => {
      setCategory({ type: 'local' })
      const projectId = newProjectId(UUID(project.id))
      openProject({
        type: BackendType.local,
        id: projectId,
        title: project.name,
        parentId: newDirectoryId(Path(project.parentDirectory)),
      })
    })
    return () => {
      window.projectManagementApi?.setOpenProjectHandler(() => {})
    }
  }, [dispatchAssetListEvent, openEditor, openProject, setCategory])

  useEffect(
    () =>
      inputBindings.attach(document.body, 'keydown', {
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

  useEffect(() => {
    if (isOnElectron()) {
      // We want to handle the back and forward buttons in electron the same way as in the browser.
      return inputBindings.attach(document.body, 'keydown', {
        goBack: () => {
          window.navigationApi.goBack()
        },
        goForward: () => {
          window.navigationApi.goForward()
        },
      })
    }
  }, [inputBindings])

  const doRemoveSelf = useEventCallback((project: LaunchedProject) => {
    dispatchAssetListEvent({ type: AssetListEventType.removeSelf, id: project.id })
    closeProject(project)
  })

  const onSignOut = useEventCallback(() => {
    setPage(TabType.drive)
    closeAllProjects()
    clearLaunchedProjects()
  })

  const doOpenShareModal = useEventCallback(() => {
    if (assetManagementApiRef.current != null && selectedProject != null) {
      const asset = assetManagementApiRef.current.getAsset(selectedProject.id)
      const self = tryFindSelfPermission(user, asset?.permissions)

      if (asset != null && self != null) {
        setModal(
          <ManagePermissionsModal
            backend={backend}
            category={category}
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

  const goToSettings = useEventCallback(() => {
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
        <Tabs
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
            category={category}
            setCategory={setCategory}
            resetCategory={resetCategory}
          />
        </Tabs>

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
