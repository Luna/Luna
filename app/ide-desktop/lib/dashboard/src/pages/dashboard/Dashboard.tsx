/** @file Main dashboard component, responsible for listing user's projects as well as other
 * interactive components. */
import * as React from 'react'

import * as detect from 'enso-common/src/detect'

import * as eventHooks from '#/hooks/eventHooks'
import * as searchParamsState from '#/hooks/searchParamsStateHooks'

import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'
import * as inputBindingsProvider from '#/providers/InputBindingsProvider'
import * as localStorageProvider from '#/providers/LocalStorageProvider'
import * as modalProvider from '#/providers/ModalProvider'

import type * as assetEvent from '#/events/assetEvent'
import AssetEventType from '#/events/AssetEventType'
import type * as assetListEvent from '#/events/assetListEvent'
import AssetListEventType from '#/events/AssetListEventType'

import Category, * as categoryModule from '#/layouts/CategorySwitcher/Category'
import Chat from '#/layouts/Chat'
import ChatPlaceholder from '#/layouts/ChatPlaceholder'
import Drive from '#/layouts/Drive'
import Editor from '#/layouts/Editor'
import * as pageSwitcher from '#/layouts/PageSwitcher'
import Settings from '#/layouts/Settings'
import TopBar from '#/layouts/TopBar'

import Page from '#/components/Page'

import * as backendModule from '#/services/Backend'
import type Backend from '#/services/Backend'
import type * as projectManager from '#/services/ProjectManager'

import * as array from '#/utilities/array'
import LocalStorage from '#/utilities/LocalStorage'
import * as object from '#/utilities/object'
import * as sanitizedEventTargets from '#/utilities/sanitizedEventTargets'

import type * as types from '../../../../types/types'

// ============================
// === Global configuration ===
// ============================

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly driveCategory: Category
    readonly isAssetPanelVisible: boolean
    readonly page: pageSwitcher.Page
    readonly projectStartupInfo: backendModule.ProjectStartupInfo
  }
}

LocalStorage.registerKey('isAssetPanelVisible', {
  tryParse: value => (value === true ? value : null),
})

const PAGES = Object.values(pageSwitcher.Page)
LocalStorage.registerKey('page', {
  tryParse: value => (array.includes(PAGES, value) ? value : null),
})

const CATEGORIES = Object.values(Category)
LocalStorage.registerKey('driveCategory', {
  tryParse: value => (array.includes(CATEGORIES, value) ? value : null),
})

const BACKEND_TYPES = Object.values(backendModule.BackendType)
LocalStorage.registerKey('projectStartupInfo', {
  isUserSpecific: true,
  tryParse: value => {
    if (typeof value !== 'object' || value == null) {
      return null
    } else if (
      !('accessToken' in value) ||
      (typeof value.accessToken !== 'string' && value.accessToken != null)
    ) {
      return null
    } else if (!('backendType' in value) || !array.includes(BACKEND_TYPES, value.backendType)) {
      return null
    } else if (!('project' in value) || !('projectAsset' in value)) {
      return null
    } else {
      return {
        // These type assertions are UNSAFE, however correctly type-checking these
        // would be very complicated.
        // eslint-disable-next-line no-restricted-syntax
        project: value.project as backendModule.Project,
        // eslint-disable-next-line no-restricted-syntax
        projectAsset: value.projectAsset as backendModule.ProjectAsset,
        backendType: value.backendType,
        accessToken: value.accessToken ?? null,
      }
    }
  },
})

// =================
// === Dashboard ===
// =================

/** Props for {@link Dashboard}s that are common to all platforms. */
export interface DashboardProps {
  /** Whether the application may have the local backend running. */
  readonly supportsLocalBackend: boolean
  readonly appRunner: types.EditorRunner | null
  readonly initialProjectName: string | null
  readonly projectManagerUrl: string | null
  readonly ydocUrl: string | null
  readonly projectManagerRootDirectory: projectManager.Path | null
}

/** The component that contains the entire UI. */
export default function Dashboard(props: DashboardProps) {
  const { appRunner, initialProjectName } = props
  const { ydocUrl, projectManagerUrl, projectManagerRootDirectory } = props
  const session = authProvider.useNonPartialUserSession()
  const remoteBackend = backendProvider.useRemoteBackend()
  const localBackend = backendProvider.useLocalBackend()
  const { modalRef } = modalProvider.useModalRef()
  const { updateModal, unsetModal } = modalProvider.useSetModal()
  const { localStorage } = localStorageProvider.useLocalStorage()
  const inputBindings = inputBindingsProvider.useInputBindings()
  const [initialized, setInitialized] = React.useState(false)
  const [isHelpChatOpen, setIsHelpChatOpen] = React.useState(false)

  // These pages MUST be ROUTER PAGES.
  const [page, setPage] = searchParamsState.useSearchParamsState(
    'page',
    () => localStorage.get('page') ?? pageSwitcher.Page.drive,
    (value: unknown): value is pageSwitcher.Page =>
      array.includes(Object.values(pageSwitcher.Page), value)
  )
  const [projectStartupInfo, setProjectStartupInfo] =
    React.useState<backendModule.ProjectStartupInfo | null>(null)
  const [openProjectAbortController, setOpenProjectAbortController] =
    React.useState<AbortController | null>(null)
  const [assetListEvents, dispatchAssetListEvent] =
    eventHooks.useEvent<assetListEvent.AssetListEvent>()
  const [assetEvents, dispatchAssetEvent] = eventHooks.useEvent<assetEvent.AssetEvent>()
  const defaultCategory = remoteBackend != null ? Category.cloud : Category.local
  const [category, setCategory] = searchParamsState.useSearchParamsState(
    'driveCategory',
    () =>
      remoteBackend == null ? Category.local : localStorage.get('driveCategory') ?? defaultCategory,
    (value): value is Category => array.includes(Object.values(Category), value)
  )

  const isCloud = categoryModule.isCloud(category)
  const isUserEnabled = session.user?.isEnabled === true

  if (isCloud && !isUserEnabled && localBackend != null) {
    setTimeout(() => {
      // This sets `BrowserRouter`, so it must not be set synchronously.
      setCategory(Category.local)
    })
  }

  React.useEffect(() => {
    setInitialized(true)
  }, [])

  React.useEffect(() => {
    const savedProjectStartupInfo = localStorage.get('projectStartupInfo')
    if (initialProjectName != null) {
      if (page === pageSwitcher.Page.editor) {
        setPage(pageSwitcher.Page.drive)
      }
    } else if (savedProjectStartupInfo != null) {
      if (savedProjectStartupInfo.backendType === backendModule.BackendType.remote) {
        if (remoteBackend != null) {
          setPage(pageSwitcher.Page.drive)
          void (async () => {
            const abortController = new AbortController()
            setOpenProjectAbortController(abortController)
            try {
              const oldProject = await remoteBackend.getProjectDetails(
                savedProjectStartupInfo.projectAsset.id,
                savedProjectStartupInfo.projectAsset.parentId,
                savedProjectStartupInfo.projectAsset.title
              )
              if (backendModule.IS_OPENING_OR_OPENED[oldProject.state.type]) {
                const project = await remoteBackend.waitUntilProjectIsReady(
                  savedProjectStartupInfo.projectAsset.id,
                  savedProjectStartupInfo.projectAsset.parentId,
                  savedProjectStartupInfo.projectAsset.title,
                  abortController
                )
                if (!abortController.signal.aborted) {
                  setProjectStartupInfo(object.merge(savedProjectStartupInfo, { project }))
                  if (page === pageSwitcher.Page.editor) {
                    setPage(page)
                  }
                }
              }
            } catch {
              setProjectStartupInfo(null)
            }
          })()
        }
      } else if (projectManagerUrl != null && projectManagerRootDirectory != null) {
        if (localBackend != null) {
          void (async () => {
            await localBackend.openProject(
              savedProjectStartupInfo.projectAsset.id,
              {
                executeAsync: false,
                cognitoCredentials: null,
                parentId: savedProjectStartupInfo.projectAsset.parentId,
              },
              savedProjectStartupInfo.projectAsset.title
            )
            const project = await localBackend.getProjectDetails(
              savedProjectStartupInfo.projectAsset.id,
              savedProjectStartupInfo.projectAsset.parentId,
              savedProjectStartupInfo.projectAsset.title
            )
            setProjectStartupInfo(object.merge(savedProjectStartupInfo, { project }))
            if (page === pageSwitcher.Page.editor) {
              setPage(page)
            }
          })()
        }
      }
    }
    // This MUST only run when the component is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  eventHooks.useEventHandler(assetEvents, event => {
    switch (event.type) {
      case AssetEventType.openProject: {
        openProjectAbortController?.abort()
        setOpenProjectAbortController(null)
        break
      }
      default: {
        // Ignored.
        break
      }
    }
  })

  React.useEffect(() => {
    if (initialized) {
      if (projectStartupInfo != null) {
        localStorage.set('projectStartupInfo', projectStartupInfo)
      } else {
        localStorage.delete('projectStartupInfo')
      }
    }
    // `initialized` is NOT a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStartupInfo, /* should never change */ localStorage])

  React.useEffect(() => {
    if (page !== pageSwitcher.Page.settings) {
      localStorage.set('page', page)
    }
  }, [page, /* should never change */ localStorage])

  React.useEffect(
    () =>
      inputBindings.attach(sanitizedEventTargets.document.body, 'keydown', {
        closeModal: () => {
          updateModal(oldModal => {
            if (oldModal == null) {
              queueMicrotask(() => {
                setPage(oldPage => {
                  if (oldPage !== pageSwitcher.Page.settings) {
                    return oldPage
                  } else {
                    return localStorage.get('page') ?? pageSwitcher.Page.drive
                  }
                })
              })
              return oldModal
            } else {
              return null
            }
          })
          if (modalRef.current == null) {
            // eslint-disable-next-line no-restricted-syntax
            return false
          }
        },
      }),
    [inputBindings, modalRef, localStorage, updateModal, setPage]
  )

  React.useEffect(() => {
    if (detect.isOnElectron()) {
      // We want to handle the back and forward buttons in electron the same way as in the browser.
      // eslint-disable-next-line no-restricted-syntax
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

  const doOpenEditor = React.useCallback(
    async (
      backend: Backend,
      newProject: backendModule.ProjectAsset,
      setProjectAsset: React.Dispatch<React.SetStateAction<backendModule.ProjectAsset>>,
      switchPage: boolean
    ) => {
      if (switchPage) {
        setPage(pageSwitcher.Page.editor)
      }
      if (projectStartupInfo?.project.projectId !== newProject.id) {
        setProjectStartupInfo({
          project: await backend.getProjectDetails(
            newProject.id,
            newProject.parentId,
            newProject.title
          ),
          projectAsset: newProject,
          setProjectAsset: setProjectAsset,
          backendType: backend.type,
          accessToken: session.accessToken,
        })
      }
    },
    [projectStartupInfo?.project.projectId, session.accessToken, setPage]
  )

  const doCloseEditor = React.useCallback((closingProject: backendModule.ProjectAsset) => {
    setProjectStartupInfo(oldInfo =>
      oldInfo?.projectAsset.id === closingProject.id ? null : oldInfo
    )
  }, [])

  const doRemoveSelf = React.useCallback(() => {
    if (projectStartupInfo?.projectAsset != null) {
      const id = projectStartupInfo.projectAsset.id
      dispatchAssetListEvent({ type: AssetListEventType.removeSelf, id })
      setProjectStartupInfo(null)
    }
  }, [projectStartupInfo?.projectAsset, /* should never change */ dispatchAssetListEvent])

  const onSignOut = React.useCallback(() => {
    if (page === pageSwitcher.Page.editor) {
      setPage(pageSwitcher.Page.drive)
    }
    setProjectStartupInfo(null)
  }, [page, setPage])

  return (
    <Page hideInfoBar hideChat>
      <div className="flex text-xs text-primary">
        <div
          className="relative flex h-screen grow select-none flex-col container-size"
          onContextMenu={event => {
            event.preventDefault()
            unsetModal()
          }}
        >
          <TopBar
            projectAsset={projectStartupInfo?.projectAsset ?? null}
            setProjectAsset={projectStartupInfo?.setProjectAsset ?? null}
            page={page}
            setPage={setPage}
            isEditorDisabled={projectStartupInfo == null}
            setIsHelpChatOpen={setIsHelpChatOpen}
            doRemoveSelf={doRemoveSelf}
            onSignOut={onSignOut}
          />
          <Drive
            category={category}
            setCategory={setCategory}
            hidden={page !== pageSwitcher.Page.drive}
            initialProjectName={initialProjectName}
            projectStartupInfo={projectStartupInfo}
            setProjectStartupInfo={setProjectStartupInfo}
            assetListEvents={assetListEvents}
            dispatchAssetListEvent={dispatchAssetListEvent}
            assetEvents={assetEvents}
            dispatchAssetEvent={dispatchAssetEvent}
            doOpenEditor={doOpenEditor}
            doCloseEditor={doCloseEditor}
          />
          <Editor
            hidden={page !== pageSwitcher.Page.editor}
            ydocUrl={ydocUrl}
            projectStartupInfo={projectStartupInfo}
            appRunner={appRunner}
          />
          {page === pageSwitcher.Page.settings && <Settings backend={remoteBackend} />}
          {/* `session.accessToken` MUST be present in order for the `Chat` component to work. */}
          {session.accessToken != null && process.env.ENSO_CLOUD_CHAT_URL != null ? (
            <Chat
              isOpen={isHelpChatOpen}
              doClose={() => {
                setIsHelpChatOpen(false)
              }}
              endpoint={process.env.ENSO_CLOUD_CHAT_URL}
            />
          ) : (
            <ChatPlaceholder
              isOpen={isHelpChatOpen}
              doClose={() => {
                setIsHelpChatOpen(false)
              }}
            />
          )}
        </div>
      </div>
    </Page>
  )
}
