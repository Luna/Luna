/** @file Main dashboard component, responsible for listing user's projects as well as other
 * interactive components. */
import * as React from 'react'

import * as common from 'enso-common'

import * as backendModule from '../backend'
import * as directoryEventModule from '../events/directoryEvent'
import * as hooks from '../../hooks'
import * as http from '../../http'
import * as localBackend from '../localBackend'
import * as projectManager from '../projectManager'
import * as remoteBackendModule from '../remoteBackend'
import * as toastPromiseMultiple from '../../toastPromiseMultiple'

import * as authProvider from '../../authentication/providers/auth'
import * as backendProvider from '../../providers/backend'
import * as loggerProvider from '../../providers/logger'
import * as modalProvider from '../../providers/modal'

import DirectoryView from './directoryView'
import Ide from './ide'
import Templates from './templates'
import TheModal from './theModal'
import TopBar from './topBar'

// =================
// === Constants ===
// =================

/** The `id` attribute of the element into which the IDE will be rendered. */
const IDE_ELEMENT_ID = 'root'

/** Feature flags to enable or disable experimental features. */
const EXPERIMENTAL = {
    /** A selector that lets the user choose between pre-defined sets of visible columns. */
    columnDisplayModeSwitcher: false,
}

/** Messages to be passed to {@link toastPromiseMultiple.toastPromiseMultiple}. */
const UPLOAD_MULTIPLE_FILES_TOAST_PROMISE_MULTIPLE_MESSAGES: toastPromiseMultiple.ToastPromiseMultipleMessages<File> =
    {
        begin: expectedCount =>
            `Uploading ${expectedCount} ${expectedCount === 1 ? 'file' : 'files'}...`,
        inProgress: (successCount, expectedCount) =>
            `Uploaded ${successCount}/${expectedCount} ${expectedCount === 1 ? 'file' : 'files'}.`,
        end: (successCount, expectedCount) =>
            `Uploaded ${successCount}/${expectedCount} ${expectedCount === 1 ? 'file' : 'files'}.`,
        error: file => `Could not delete file '${file.name}'.`,
    }

// =============
// === Types ===
// =============

/** Main content of the screen. Only one should be visible at a time. */
export enum Tab {
    dashboard = 'dashboard',
    ide = 'ide',
}

/** Values provided to form creation dialogs. */
export interface CreateFormProps {
    left: number
    top: number
    directoryId: backendModule.DirectoryId
    getNewProjectName: (templateId: string | null) => string
    onSuccess: () => void
}

// =================
// === Dashboard ===
// =================

/** Props for {@link Dashboard}s that are common to all platforms. */
export interface DashboardProps {
    supportsLocalBackend: boolean
    appRunner: AppRunner
    initialProjectName: string | null
}

// TODO[sb]: Implement rename when clicking name of a selected row.
// There is currently no way to tell whether a row is selected from a column.

/** The component that contains the entire UI. */
function Dashboard(props: DashboardProps) {
    const { supportsLocalBackend, appRunner, initialProjectName } = props

    const logger = loggerProvider.useLogger()
    const session = authProvider.useNonPartialUserSession()
    const { backend } = backendProvider.useBackend()
    const { setBackend } = backendProvider.useSetBackend()
    const { unsetModal } = modalProvider.useSetModal()

    const [refresh, doRefresh] = hooks.useRefresh()

    const [directoryId, setDirectoryId] = React.useState(
        session.organization != null ? backendModule.rootDirectoryId(session.organization.id) : null
    )
    const [query, setQuery] = React.useState('')
    const [loadingProjectManagerDidFail, setLoadingProjectManagerDidFail] = React.useState(false)
    const [tab, setTab] = React.useState(Tab.dashboard)
    const [project, setProject] = React.useState<backendModule.Project | null>(null)
    const [isFileBeingDragged, setIsFileBeingDragged] = React.useState(false)
    const [nameOfProjectToImmediatelyOpen, setNameOfProjectToImmediatelyOpen] =
        React.useState(initialProjectName)
    // This is a bad solution as it dirties the entire DOM subtree.
    const [directoryEvent, dispatchDirectoryEvent] =
        hooks.useEvent<directoryEventModule.DirectoryEvent>()

    const isListingLocalDirectoryAndWillFail =
        backend.type === backendModule.BackendType.local && loadingProjectManagerDidFail
    const isListingRemoteDirectoryAndWillFail =
        backend.type === backendModule.BackendType.remote &&
        session.organization?.isEnabled !== true
    const isListingRemoteDirectoryWhileOffline =
        session.type === authProvider.UserSessionType.offline &&
        backend.type === backendModule.BackendType.remote

    const switchToIdeTab = React.useCallback(() => {
        setTab(Tab.ide)
        doRefresh()
        const ideElement = document.getElementById(IDE_ELEMENT_ID)
        if (ideElement) {
            ideElement.style.top = ''
            ideElement.style.display = 'absolute'
        }
    }, [/* should never change */ doRefresh])

    const switchToDashboardTab = React.useCallback(() => {
        setTab(Tab.dashboard)
        doRefresh()
        const ideElement = document.getElementById(IDE_ELEMENT_ID)
        if (ideElement) {
            ideElement.style.top = '-100vh'
            ideElement.style.display = 'fixed'
        }
    }, [/* should never change */ doRefresh])

    const toggleTab = React.useCallback(() => {
        if (project != null && tab === Tab.dashboard) {
            switchToIdeTab()
        } else {
            switchToDashboardTab()
        }
    }, [
        project,
        tab,
        /* should never change */ switchToDashboardTab,
        /* should never change */ switchToIdeTab,
    ])

    React.useEffect(() => {
        if (
            supportsLocalBackend &&
            localStorage.getItem(backendProvider.BACKEND_TYPE_KEY) !==
                backendModule.BackendType.remote
        ) {
            setBackend(new localBackend.LocalBackend())
        }
    }, [/* should never change */ setBackend, /* should never change */ supportsLocalBackend])

    React.useEffect(() => {
        document.addEventListener('show-dashboard', switchToDashboardTab)
        return () => {
            document.removeEventListener('show-dashboard', switchToDashboardTab)
        }
    }, [switchToDashboardTab])

    React.useEffect(() => {
        const onBlur = () => {
            setIsFileBeingDragged(false)
        }
        window.addEventListener('blur', onBlur)
        return () => {
            window.removeEventListener('blur', onBlur)
        }
    }, [])

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

    const handleEscapeKey = React.useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (
                event.key === 'Escape' &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey &&
                !event.metaKey
            ) {
                event.preventDefault()
                unsetModal()
            }
        },
        [unsetModal]
    )

    const openDropZone = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        if (event.dataTransfer.types.includes('Files')) {
            setIsFileBeingDragged(true)
        }
    }, [])

    const setBackendType = React.useCallback(
        (newBackendType: backendModule.BackendType) => {
            if (newBackendType !== backend.type) {
                switch (newBackendType) {
                    case backendModule.BackendType.local:
                        setBackend(new localBackend.LocalBackend())
                        break
                    case backendModule.BackendType.remote: {
                        const headers = new Headers()
                        headers.append('Authorization', `Bearer ${session.accessToken ?? ''}`)
                        const client = new http.Client(headers)
                        setBackend(new remoteBackendModule.RemoteBackend(client, logger))
                        break
                    }
                }
            }
        },
        [backend.type, logger, session.accessToken, setBackend]
    )

    const doCreateProject = React.useCallback(
        (templateId?: string | null) => {
            dispatchDirectoryEvent({
                type: directoryEventModule.DirectoryEventType.createProject,
                templateId: templateId ?? null,
            })
        },
        [/* should never change */ dispatchDirectoryEvent]
    )

    const openIde = React.useCallback(
        async (newProject: backendModule.ProjectAsset) => {
            switchToIdeTab()
            if (project?.projectId !== newProject.id) {
                setProject(await backend.getProjectDetails(newProject.id, newProject.title))
            }
        },
        [backend, project?.projectId, switchToIdeTab]
    )

    const closeIde = React.useCallback(() => {
        setProject(null)
    }, [])

    const closeModalIfExists = React.useCallback(() => {
        if (getSelection()?.type !== 'Range') {
            unsetModal()
        }
    }, [/* should never change */ unsetModal])

    return (
        <div
            className={`flex flex-col relative select-none text-primary text-xs min-h-screen p-2 ${
                tab === Tab.dashboard ? '' : 'hidden'
            }`}
            onClick={closeModalIfExists}
            onKeyDown={handleEscapeKey}
            onDragEnter={openDropZone}
        >
            <TopBar
                supportsLocalBackend={supportsLocalBackend}
                projectName={project?.name ?? null}
                tab={tab}
                toggleTab={toggleTab}
                setBackendType={setBackendType}
                query={query}
                setQuery={setQuery}
            />
            {isListingRemoteDirectoryWhileOffline ? (
                <div className="grow grid place-items-center">
                    <div className="text-base text-center">
                        You are offline. Please connect to the internet and refresh to access the
                        cloud backend.
                    </div>
                </div>
            ) : isListingLocalDirectoryAndWillFail ? (
                <div className="grow grid place-items-center">
                    <div className="text-base text-center">
                        Could not connect to the Project Manager. Please try restarting{' '}
                        {common.PRODUCT_NAME}, or manually launching the Project Manager.
                    </div>
                </div>
            ) : isListingRemoteDirectoryAndWillFail ? (
                <div className="grow grid place-items-center">
                    <div className="text-base text-center">
                        We will review your user details and enable the cloud experience for you
                        shortly.
                    </div>
                </div>
            ) : (
                <>
                    <Templates onTemplateClick={doCreateProject} />
                    <DirectoryView
                        initialProjectName={initialProjectName}
                        nameOfProjectToImmediatelyOpen={nameOfProjectToImmediatelyOpen}
                        setNameOfProjectToImmediatelyOpen={setNameOfProjectToImmediatelyOpen}
                        directoryId={directoryId}
                        setDirectoryId={setDirectoryId}
                        directoryEvent={directoryEvent}
                        dispatchDirectoryEvent={dispatchDirectoryEvent}
                        query={query}
                        refresh={refresh}
                        doRefresh={doRefresh}
                        onOpenIde={openIde}
                        onCloseIde={closeIde}
                        appRunner={appRunner}
                        loadingProjectManagerDidFail={loadingProjectManagerDidFail}
                        isListingRemoteDirectoryWhileOffline={isListingRemoteDirectoryWhileOffline}
                        isListingLocalDirectoryAndWillFail={isListingLocalDirectoryAndWillFail}
                        isListingRemoteDirectoryAndWillFail={isListingRemoteDirectoryAndWillFail}
                        experimentalShowColumnDisplayModeSwitcher={
                            EXPERIMENTAL.columnDisplayModeSwitcher
                        }
                    />
                </>
            )}
            {isFileBeingDragged &&
            directoryId != null &&
            backend.type === backendModule.BackendType.remote ? (
                <div
                    className="text-white text-lg fixed w-screen h-screen inset-0 bg-primary grid place-items-center"
                    onDragLeave={() => {
                        setIsFileBeingDragged(false)
                    }}
                    onDragOver={event => {
                        event.preventDefault()
                    }}
                    onDrop={async event => {
                        event.preventDefault()
                        setIsFileBeingDragged(false)
                        await toastPromiseMultiple.toastPromiseMultiple(
                            logger,
                            Array.from(event.dataTransfer.files),
                            async file => {
                                await backend.uploadFile(
                                    {
                                        fileId: null,
                                        fileName: file.name,
                                        parentDirectoryId: directoryId,
                                    },
                                    file
                                )
                            },
                            UPLOAD_MULTIPLE_FILES_TOAST_PROMISE_MULTIPLE_MESSAGES
                        )
                        doRefresh()
                    }}
                >
                    Drop to upload files.
                </div>
            ) : null}
            <TheModal />
            {project && <Ide project={project} appRunner={appRunner} />}
        </div>
    )
}

export default Dashboard
