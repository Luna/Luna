/** @file The directory header bar and directory item listing. */
import * as React from 'react'

import * as common from 'enso-common'

import * as appUtils from '#/appUtils'

import * as navigateHooks from '#/hooks/navigateHooks'
import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'
import * as localStorageProvider from '#/providers/LocalStorageProvider'

import type * as assetEvent from '#/events/assetEvent'
import AssetEventType from '#/events/AssetEventType'
import type * as assetListEvent from '#/events/assetListEvent'
import AssetListEventType from '#/events/AssetListEventType'

import type * as assetPanel from '#/layouts/dashboard/AssetPanel'
import type * as assetSearchBar from '#/layouts/dashboard/AssetSearchBar'
import AssetsTable from '#/layouts/dashboard/AssetsTable'
import CategorySwitcher from '#/layouts/dashboard/CategorySwitcher'
import Category from '#/layouts/dashboard/CategorySwitcher/Category'
import DriveBar from '#/layouts/dashboard/DriveBar'
import Labels from '#/layouts/dashboard/Labels'

import type * as spinner from '#/components/Spinner'

import * as backendModule from '#/services/Backend'

import * as array from '#/utilities/array'
import type AssetQuery from '#/utilities/AssetQuery'
import * as github from '#/utilities/github'
import LocalStorage from '#/utilities/LocalStorage'
import * as projectManager from '#/utilities/ProjectManager'
import * as uniqueString from '#/utilities/uniqueString'

// ============================
// === Global configuration ===
// ============================

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly driveCategory: Category
  }
}

const CATEGORIES = Object.values(Category)
LocalStorage.registerKey('driveCategory', {
  tryParse: value => (array.includes(CATEGORIES, value) ? value : null),
})

// ===================
// === DriveStatus ===
// ===================

/** The predicted status of project listing. This is used to avoid sending requests to the backend
 * if it is already known that the request will fail. */
enum DriveStatus {
  /** No errors predicted. The request may still error because of an issue in the backend. */
  ok = 'ok',
  /** Trying to use the remote backend when offline. The network request will fail. */
  offline = 'offline',
  /** The user does not have an active plan, and therefore has no access to the remote backend. */
  notEnabled = 'not-enabled',
  /** The connection to the Project Manager timed out. This may happen if the Project Manager
   * crashed, or was never run in the first place. */
  noProjectManager = 'no-project-manager',
}

// =============
// === Drive ===
// =============

/** Props for a {@link Drive}. */
export interface DriveProps {
  readonly supportsLocalBackend: boolean
  readonly hidden: boolean
  readonly initialProjectName: string | null
  /** These events will be dispatched the next time the assets list is refreshed, rather than
   * immediately. */
  readonly queuedAssetEvents: assetEvent.AssetEvent[]
  readonly assetListEvents: assetListEvent.AssetListEvent[]
  readonly dispatchAssetListEvent: (directoryEvent: assetListEvent.AssetListEvent) => void
  readonly assetEvents: assetEvent.AssetEvent[]
  readonly dispatchAssetEvent: (directoryEvent: assetEvent.AssetEvent) => void
  readonly query: AssetQuery
  readonly setQuery: React.Dispatch<React.SetStateAction<AssetQuery>>
  readonly labels: backendModule.Label[]
  readonly setLabels: React.Dispatch<React.SetStateAction<backendModule.Label[]>>
  readonly setSuggestions: (suggestions: assetSearchBar.Suggestion[]) => void
  readonly projectStartupInfo: backendModule.ProjectStartupInfo | null
  readonly setAssetPanelProps: React.Dispatch<
    React.SetStateAction<assetPanel.AssetPanelRequiredProps | null>
  >
  readonly doCreateProject: (templateId: string | null) => void
  readonly doOpenEditor: (
    project: backendModule.ProjectAsset,
    setProject: React.Dispatch<React.SetStateAction<backendModule.ProjectAsset>>,
    switchPage: boolean
  ) => void
  readonly doCloseEditor: (project: backendModule.ProjectAsset) => void
}

/** Contains directory path and directory contents (projects, folders, secrets and files). */
export default function Drive(props: DriveProps) {
  const { supportsLocalBackend, hidden, initialProjectName, queuedAssetEvents } = props
  const { query, setQuery, labels, setLabels, setSuggestions, projectStartupInfo } = props
  const { assetListEvents, dispatchAssetListEvent, assetEvents, dispatchAssetEvent } = props
  const { setAssetPanelProps, doOpenEditor, doCloseEditor } = props

  const navigate = navigateHooks.useNavigate()
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const { type: sessionType, user } = authProvider.useNonPartialUserSession()
  const { backend } = backendProvider.useBackend()
  const { localStorage } = localStorageProvider.useLocalStorage()
  const [canDownloadFiles, setCanDownloadFiles] = React.useState(false)
  const [didLoadingProjectManagerFail, setDidLoadingProjectManagerFail] = React.useState(false)
  const [category, setCategory] = React.useState(
    () => localStorage.get('driveCategory') ?? Category.home
  )
  const [newLabelNames, setNewLabelNames] = React.useState(new Set<backendModule.LabelName>())
  const [deletedLabelNames, setDeletedLabelNames] = React.useState(
    new Set<backendModule.LabelName>()
  )
  const allLabels = React.useMemo(
    () => new Map(labels.map(label => [label.value, label])),
    [labels]
  )
  const rootDirectoryId = React.useMemo(
    () => user?.rootDirectoryId ?? backendModule.DirectoryId(''),
    [user]
  )
  const isCloud = backend.type === backendModule.BackendType.remote
  const status =
    !isCloud && didLoadingProjectManagerFail
      ? DriveStatus.noProjectManager
      : isCloud && sessionType === authProvider.UserSessionType.offline
      ? DriveStatus.offline
      : isCloud && user?.isEnabled !== true
      ? DriveStatus.notEnabled
      : DriveStatus.ok

  React.useEffect(() => {
    const onProjectManagerLoadingFailed = () => {
      setDidLoadingProjectManagerFail(true)
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
    void (async () => {
      if (backend.type !== backendModule.BackendType.local && user?.isEnabled === true) {
        setLabels(await backend.listTags())
      }
    })()
  }, [backend, user?.isEnabled, /* should never change */ setLabels])

  const doUploadFiles = React.useCallback(
    (files: File[]) => {
      if (backend.type !== backendModule.BackendType.local && user == null) {
        // This should never happen, however display a nice error message in case it does.
        toastAndLog('Files cannot be uploaded while offline')
      } else {
        dispatchAssetListEvent({
          type: AssetListEventType.uploadFiles,
          parentKey: rootDirectoryId,
          parentId: rootDirectoryId,
          files,
        })
      }
    },
    [backend, user, rootDirectoryId, toastAndLog, /* should never change */ dispatchAssetListEvent]
  )

  const doCreateProject = React.useCallback(
    (
      templateId: string | null = null,
      templateName: string | null = null,
      onSpinnerStateChange: ((state: spinner.SpinnerState) => void) | null = null
    ) => {
      dispatchAssetListEvent({
        type: AssetListEventType.newProject,
        parentKey: rootDirectoryId,
        parentId: rootDirectoryId,
        templateId,
        templateName,
        onSpinnerStateChange,
      })
    },
    [rootDirectoryId, /* should never change */ dispatchAssetListEvent]
  )

  const doCreateDirectory = React.useCallback(() => {
    dispatchAssetListEvent({
      type: AssetListEventType.newFolder,
      parentKey: rootDirectoryId,
      parentId: rootDirectoryId,
    })
  }, [rootDirectoryId, /* should never change */ dispatchAssetListEvent])

  const doCreateLabel = React.useCallback(
    async (value: string, color: backendModule.LChColor) => {
      const newLabelName = backendModule.LabelName(value)
      const placeholderLabel: backendModule.Label = {
        id: backendModule.TagId(uniqueString.uniqueString()),
        value: newLabelName,
        color,
      }
      setNewLabelNames(labelNames => new Set([...labelNames, newLabelName]))
      setLabels(oldLabels => [...oldLabels, placeholderLabel])
      try {
        const newLabel = await backend.createTag({ value, color })
        setLabels(oldLabels =>
          oldLabels.map(oldLabel => (oldLabel.id === placeholderLabel.id ? newLabel : oldLabel))
        )
      } catch (error) {
        toastAndLog(null, error)
        setLabels(oldLabels => oldLabels.filter(oldLabel => oldLabel.id !== placeholderLabel.id))
      }
      setNewLabelNames(
        labelNames => new Set([...labelNames].filter(labelName => labelName !== newLabelName))
      )
    },
    [backend, /* should never change */ toastAndLog, /* should never change */ setLabels]
  )

  const doDeleteLabel = React.useCallback(
    async (id: backendModule.TagId, value: backendModule.LabelName) => {
      setDeletedLabelNames(oldNames => new Set([...oldNames, value]))
      setQuery(oldQuery => oldQuery.deleteFromEveryTerm({ labels: [value] }))
      try {
        await backend.deleteTag(id, value)
        dispatchAssetEvent({
          type: AssetEventType.deleteLabel,
          labelName: value,
        })
        setLabels(oldLabels => oldLabels.filter(oldLabel => oldLabel.id !== id))
      } catch (error) {
        toastAndLog(null, error)
      }
      setDeletedLabelNames(
        oldNames => new Set([...oldNames].filter(oldValue => oldValue !== value))
      )
    },
    [
      backend,
      /* should never change */ setQuery,
      /* should never change */ dispatchAssetEvent,
      /* should never change */ toastAndLog,
      /* should never change */ setLabels,
    ]
  )

  const doCreateSecret = React.useCallback(
    (name: string, value: string) => {
      dispatchAssetListEvent({
        type: AssetListEventType.newSecret,
        parentKey: rootDirectoryId,
        parentId: rootDirectoryId,
        name,
        value,
      })
    },
    [rootDirectoryId, /* should never change */ dispatchAssetListEvent]
  )

  const doCreateDataLink = React.useCallback(
    (name: string, value: unknown) => {
      dispatchAssetListEvent({
        type: AssetListEventType.newDataLink,
        parentKey: rootDirectoryId,
        parentId: rootDirectoryId,
        name,
        value,
      })
    },
    [rootDirectoryId, /* should never change */ dispatchAssetListEvent]
  )

  switch (status) {
    case DriveStatus.offline: {
      return (
        <div className={`grow grid place-items-center mx-2 ${hidden ? 'hidden' : ''}`}>
          <div className="flex flex-col gap-4">
            <div className="text-base text-center">You are not logged in.</div>
            <button
              className="text-base text-white bg-help rounded-full self-center leading-170 h-8 py-px w-16"
              onClick={() => {
                navigate(appUtils.LOGIN_PATH)
              }}
            >
              Login
            </button>
          </div>
        </div>
      )
    }
    case DriveStatus.noProjectManager: {
      return (
        <div className={`grow grid place-items-center mx-2 ${hidden ? 'hidden' : ''}`}>
          <div className="text-base text-center">
            Could not connect to the Project Manager. Please try restarting {common.PRODUCT_NAME},
            or manually launching the Project Manager.
          </div>
        </div>
      )
    }
    case DriveStatus.notEnabled: {
      return (
        <div className={`grow grid place-items-center mx-2 ${hidden ? 'hidden' : ''}`}>
          <div className="flex flex-col gap-4 text-base text-center">
            Upgrade your plan to use {common.PRODUCT_NAME} Cloud.
            <a
              className="block self-center whitespace-nowrap text-base text-white bg-help rounded-full leading-170 h-8 py-px px-2 w-min"
              href="https://enso.org/pricing"
            >
              Upgrade
            </a>
            {!supportsLocalBackend && (
              <button
                className="block self-center whitespace-nowrap text-base text-white bg-help rounded-full leading-170 h-8 py-px px-2 w-min"
                onClick={async () => {
                  const downloadUrl = await github.getDownloadUrl()
                  if (downloadUrl == null) {
                    toastAndLog('Could not find a download link for the current OS')
                  } else {
                    window.open(downloadUrl, '_blank')
                  }
                }}
              >
                Download Free Edition
              </button>
            )}
          </div>
        </div>
      )
    }
    case DriveStatus.ok: {
      return (
        <div
          data-testid="drive-view"
          className={`flex flex-col flex-1 overflow-hidden gap-2.5 px-3.25 mt-8 ${
            hidden ? 'hidden' : ''
          }`}
        >
          <div className="flex flex-col self-start gap-3">
            <h1 className="text-xl font-bold h-9.5 pl-1.5">
              {backend.type === backendModule.BackendType.remote ? 'Cloud Drive' : 'Local Drive'}
            </h1>
            <DriveBar
              category={category}
              canDownloadFiles={canDownloadFiles}
              doCreateProject={doCreateProject}
              doUploadFiles={doUploadFiles}
              doCreateDirectory={doCreateDirectory}
              doCreateSecret={doCreateSecret}
              doCreateDataLink={doCreateDataLink}
              dispatchAssetEvent={dispatchAssetEvent}
            />
          </div>
          <div className="flex flex-1 gap-3 overflow-hidden">
            {backend.type === backendModule.BackendType.remote && (
              <div className="flex flex-col gap-4 py-1">
                <CategorySwitcher
                  category={category}
                  setCategory={setCategory}
                  dispatchAssetEvent={dispatchAssetEvent}
                />
                <Labels
                  labels={labels}
                  query={query}
                  setQuery={setQuery}
                  doCreateLabel={doCreateLabel}
                  doDeleteLabel={doDeleteLabel}
                  newLabelNames={newLabelNames}
                  deletedLabelNames={deletedLabelNames}
                />
              </div>
            )}
            <AssetsTable
              query={query}
              setQuery={setQuery}
              setCanDownloadFiles={setCanDownloadFiles}
              category={category}
              allLabels={allLabels}
              setSuggestions={setSuggestions}
              initialProjectName={initialProjectName}
              projectStartupInfo={projectStartupInfo}
              deletedLabelNames={deletedLabelNames}
              queuedAssetEvents={queuedAssetEvents}
              assetEvents={assetEvents}
              dispatchAssetEvent={dispatchAssetEvent}
              assetListEvents={assetListEvents}
              dispatchAssetListEvent={dispatchAssetListEvent}
              setAssetPanelProps={setAssetPanelProps}
              doOpenIde={doOpenEditor}
              doCloseIde={doCloseEditor}
              doCreateLabel={doCreateLabel}
            />
          </div>
        </div>
      )
    }
  }
}
