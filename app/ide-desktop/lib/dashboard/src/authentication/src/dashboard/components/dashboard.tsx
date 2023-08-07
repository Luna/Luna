/** @file Main dashboard component, responsible for listing user's projects as well as other
 * interactive components. */
import * as React from 'react'

import * as common from 'enso-common'

import * as assetListEventModule from '../events/assetListEvent'
import * as backendModule from '../backend'
import * as hooks from '../../hooks'
import * as http from '../../http'
import * as localBackend from '../localBackend'
import * as localStorageModule from '../localStorage'
import * as projectManager from '../projectManager'
import * as remoteBackendModule from '../remoteBackend'
import * as shortcuts from '../shortcuts'

import * as authProvider from '../../authentication/providers/auth'
import * as backendProvider from '../../providers/backend'
import * as localStorageProvider from '../../providers/localStorage'
import * as loggerProvider from '../../providers/logger'
import * as modalProvider from '../../providers/modal'

import * as app from '../../components/app'
import * as pageSwitcher from './pageSwitcher'
import * as spinner from './spinner'
import Chat, * as chat from './chat'
import DriveView from './driveView'
import Editor from './editor'
import Templates from './templates'
import TheModal from './theModal'
import TopBar from './topBar'

// =================
// === Constants ===
// =================

/** The `id` attribute of the loading spinner element. */
const LOADER_ELEMENT_ID = 'loader'

// =================
// === Dashboard ===
// =================

/** Props for {@link Dashboard}s that are common to all platforms. */
export interface DashboardProps {
    /** Whether the application may have the local backend running. */
    supportsLocalBackend: boolean
    appRunner: AppRunner
    initialProjectName: string | null
}

/** The component that contains the entire UI. */
export default function Dashboard(props: DashboardProps) {
    const { supportsLocalBackend, appRunner, initialProjectName } = props
    const navigate = hooks.useNavigate()
    const logger = loggerProvider.useLogger()
    const session = authProvider.useNonPartialUserSession()
    const { backend } = backendProvider.useBackend()
    const { setBackend } = backendProvider.useSetBackend()
    const { unsetModal } = modalProvider.useSetModal()
    const { localStorage } = localStorageProvider.useLocalStorage()
    const [directoryId, setDirectoryId] = React.useState(
        session.organization != null
            ? backendModule.rootDirectoryId(session.organization.id)
            : // The local backend uses the empty string as the sole directory ID.
              backendModule.DirectoryId('')
    )
    const [query, setQuery] = React.useState('')
    const [isHelpChatOpen, setIsHelpChatOpen] = React.useState(false)
    const [isHelpChatVisible, setIsHelpChatVisible] = React.useState(false)
    const [loadingProjectManagerDidFail, setLoadingProjectManagerDidFail] = React.useState(false)
    const [page, setPage] = React.useState(pageSwitcher.Page.drive)
    const [project, setProject] = React.useState<backendModule.Project | null>(null)
    const [assetListEvents, dispatchAssetListEvent] =
        hooks.useEvent<assetListEventModule.AssetListEvent>()

    const isListingLocalDirectoryAndWillFail =
        backend.type === backendModule.BackendType.local && loadingProjectManagerDidFail
    const isListingRemoteDirectoryAndWillFail =
        backend.type === backendModule.BackendType.remote &&
        session.organization?.isEnabled !== true
    const isListingRemoteDirectoryWhileOffline =
        session.type === authProvider.UserSessionType.offline &&
        backend.type === backendModule.BackendType.remote

    React.useEffect(() => {
        unsetModal()
    }, [page, /* should never change */ unsetModal])

    React.useEffect(() => {
        const savedPage = localStorage.get(localStorageModule.LocalStorageKey.page)
        if (savedPage != null) {
            setPage(savedPage)
        }
        const savedProject = localStorage.get(
            localStorageModule.LocalStorageKey.currentlyOpenProject
        )
        if (savedProject != null) {
            setProject(savedProject)
            if (savedPage !== pageSwitcher.Page.editor) {
                // A workaround to hide the spinner, when the previous project is being loaded in
                // the background. This `MutationObserver` is disconnected when the loader is
                // removed from the DOM.
                const observer = new MutationObserver(mutations => {
                    for (const mutation of mutations) {
                        for (const node of Array.from(mutation.addedNodes)) {
                            if (node instanceof HTMLElement && node.id === LOADER_ELEMENT_ID) {
                                document.body.style.cursor = 'auto'
                                node.style.display = 'none'
                            }
                        }
                        for (const node of Array.from(mutation.removedNodes)) {
                            if (node instanceof HTMLElement && node.id === LOADER_ELEMENT_ID) {
                                document.body.style.cursor = 'auto'
                                observer.disconnect()
                            }
                        }
                    }
                })
                observer.observe(document.body, { childList: true })
            }
        }
    }, [/* should never change */ localStorage])

    React.useEffect(() => {
        if (project != null) {
            localStorage.set(localStorageModule.LocalStorageKey.currentlyOpenProject, project)
        }
        return () => {
            localStorage.delete(localStorageModule.LocalStorageKey.currentlyOpenProject)
        }
    }, [project, /* should never change */ localStorage])

    React.useEffect(() => {
        localStorage.set(localStorageModule.LocalStorageKey.page, page)
    }, [page, /* should never change */ localStorage])

    React.useEffect(() => {
        if (
            supportsLocalBackend &&
            session.type !== authProvider.UserSessionType.offline &&
            localStorage.get(localStorageModule.LocalStorageKey.backendType) ===
                backendModule.BackendType.local
        ) {
            setBackend(new localBackend.LocalBackend())
            setDirectoryId(backendModule.DirectoryId(''))
        }
        // This hook MUST only run once, on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    React.useEffect(() => {
        const goToDrive = () => {
            setPage(pageSwitcher.Page.drive)
        }
        document.addEventListener('show-dashboard', goToDrive)
        return () => {
            document.removeEventListener('show-dashboard', goToDrive)
        }
    }, [])

    React.useEffect(() => {
        // The types come from a third-party API and cannot be changed.
        // eslint-disable-next-line no-restricted-syntax
        let handle: number | undefined
        if (isHelpChatOpen) {
            setIsHelpChatVisible(true)
        } else {
            handle = window.setTimeout(() => {
                setIsHelpChatVisible(false)
            }, chat.ANIMATION_DURATION_MS)
        }
        return () => {
            clearTimeout(handle)
        }
    }, [isHelpChatOpen])

    React.useEffect(() => {
        const onProjectManagerLoadingFailed = () => {
            setLoadingProjectManagerDidFail(true)
        }
        document.addEventListener(
            projectManager.ProjectManagerEvents.loadingFailed,
            onProjectManagerLoadingFailed
        )
        return () => {
            document.removeEventListener(
                projectManager.ProjectManagerEvents.loadingFailed,
                onProjectManagerLoadingFailed
            )
        }
    }, [])

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                shortcuts.SHORTCUT_REGISTRY.matchesKeyboardAction(
                    shortcuts.KeyboardAction.closeModal,
                    event
                )
            ) {
                event.preventDefault()
                unsetModal()
            }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [unsetModal])

    const setBackendType = React.useCallback(
        (newBackendType: backendModule.BackendType) => {
            if (newBackendType !== backend.type) {
                switch (newBackendType) {
                    case backendModule.BackendType.local:
                        setBackend(new localBackend.LocalBackend())
                        setDirectoryId(backendModule.DirectoryId(''))
                        break
                    case backendModule.BackendType.remote: {
                        const headers = new Headers()
                        headers.append('Authorization', `Bearer ${session.accessToken ?? ''}`)
                        const client = new http.Client(headers)
                        setBackend(new remoteBackendModule.RemoteBackend(client, logger))
                        setDirectoryId(
                            session.organization != null
                                ? backendModule.rootDirectoryId(session.organization.id)
                                : backendModule.DirectoryId('')
                        )
                        break
                    }
                }
            }
        },
        [backend.type, logger, session.accessToken, session.organization, setBackend]
    )

    const doCreateProject = React.useCallback(
        (
            templateId: string | null,
            onSpinnerStateChange?: (state: spinner.SpinnerState) => void
        ) => {
            dispatchAssetListEvent({
                type: assetListEventModule.AssetListEventType.createProject,
                parentId: directoryId,
                templateId: templateId ?? null,
                onSpinnerStateChange: onSpinnerStateChange ?? null,
            })
        },
        [directoryId, /* should never change */ dispatchAssetListEvent]
    )

    const openEditor = React.useCallback(
        async (newProject: backendModule.ProjectAsset) => {
            setPage(pageSwitcher.Page.editor)
            if (project?.projectId !== newProject.id) {
                setProject(await backend.getProjectDetails(newProject.id, newProject.title))
            }
        },
        [backend, project?.projectId, setPage]
    )

    const closeEditor = React.useCallback(() => {
        setProject(null)
    }, [])

    const closeModalIfExists = React.useCallback(() => {
        if (getSelection()?.type !== 'Range') {
            unsetModal()
        }
    }, [/* should never change */ unsetModal])

    return (
        <div
            className={`flex flex-col gap-2 relative select-none text-primary text-xs h-screen pb-2 ${
                page === pageSwitcher.Page.drive ? '' : 'hidden'
            }`}
            onContextMenu={event => {
                event.preventDefault()
                unsetModal()
            }}
            onClick={closeModalIfExists}
        >
            <TopBar
                supportsLocalBackend={supportsLocalBackend}
                projectName={project?.name ?? null}
                page={page}
                setPage={setPage}
                asset={null}
                isEditorDisabled={project == null}
                isHelpChatOpen={isHelpChatOpen}
                setIsHelpChatOpen={setIsHelpChatOpen}
                setBackendType={setBackendType}
                query={query}
                setQuery={setQuery}
            />
            {isListingRemoteDirectoryWhileOffline ? (
                <div className="grow grid place-items-center mx-2">
                    <div className="flex flex-col gap-4">
                        <div className="text-base text-center">You are not signed in.</div>
                        <button
                            className="text-base text-white bg-help rounded-full self-center leading-170 h-8 py-px w-16"
                            onClick={() => {
                                navigate(app.LOGIN_PATH)
                            }}
                        >
                            Login
                        </button>
                    </div>
                </div>
            ) : isListingLocalDirectoryAndWillFail ? (
                <div className="grow grid place-items-center mx-2">
                    <div className="text-base text-center">
                        Could not connect to the Project Manager. Please try restarting{' '}
                        {common.PRODUCT_NAME}, or manually launching the Project Manager.
                    </div>
                </div>
            ) : isListingRemoteDirectoryAndWillFail ? (
                <div className="grow grid place-items-center mx-2">
                    <div className="text-base text-center">
                        We will review your user details and enable the cloud experience for you
                        shortly.
                    </div>
                </div>
            ) : (
                <>
                    <Templates onTemplateClick={doCreateProject} />
                    <DriveView
                        page={page}
                        initialProjectName={initialProjectName}
                        directoryId={directoryId}
                        assetListEvents={assetListEvents}
                        dispatchAssetListEvent={dispatchAssetListEvent}
                        query={query}
                        doCreateProject={doCreateProject}
                        doOpenEditor={openEditor}
                        doCloseEditor={closeEditor}
                        appRunner={appRunner}
                        loadingProjectManagerDidFail={loadingProjectManagerDidFail}
                        isListingRemoteDirectoryWhileOffline={isListingRemoteDirectoryWhileOffline}
                        isListingLocalDirectoryAndWillFail={isListingLocalDirectoryAndWillFail}
                        isListingRemoteDirectoryAndWillFail={isListingRemoteDirectoryAndWillFail}
                    />
                </>
            )}
            <TheModal />
            <Editor
                visible={page === pageSwitcher.Page.editor}
                project={project}
                appRunner={appRunner}
            />
            {/* `session.accessToken` MUST be present in order for the `Chat` component to work. */}
            {isHelpChatVisible && session.accessToken != null && (
                <Chat
                    isOpen={isHelpChatOpen}
                    doClose={() => {
                        setIsHelpChatOpen(false)
                    }}
                />
            )}
        </div>
    )
}
