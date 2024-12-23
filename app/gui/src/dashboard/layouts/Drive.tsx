/** @file The directory header bar and directory item listing. */
import * as React from 'react'

import * as appUtils from '#/appUtils'
import Offline from '#/assets/offline_filled.svg'

import * as offlineHooks from '#/hooks/offlineHooks'
import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'
import * as textProvider from '#/providers/TextProvider'

import AssetListEventType from '#/events/AssetListEventType'

import { AssetPanel } from '#/layouts/AssetPanel'
import type * as assetsTable from '#/layouts/AssetsTable'
import AssetsTable from '#/layouts/AssetsTable'
import CategorySwitcher from '#/layouts/CategorySwitcher'
import * as categoryModule from '#/layouts/CategorySwitcher/Category'
import * as eventListProvider from '#/layouts/Drive/EventListProvider'
import DriveBar from '#/layouts/DriveBar'
import Labels from '#/layouts/Labels'

import * as ariaComponents from '#/components/AriaComponents'
import * as result from '#/components/Result'

import SvgMask from '#/components/SvgMask'
import { listDirectoryQueryOptions } from '#/hooks/backendHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import type { Category } from '#/layouts/CategorySwitcher/Category'
import { useTargetDirectory } from '#/providers/DriveProvider'
import { DirectoryDoesNotExistError, Plan } from '#/services/Backend'
import AssetQuery from '#/utilities/AssetQuery'
import * as download from '#/utilities/download'
import * as github from '#/utilities/github'
import { OfflineError } from '#/utilities/HttpClient'
import { tryFindSelfPermission } from '#/utilities/permissions'
import * as tailwindMerge from '#/utilities/tailwindMerge'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Await } from '../components/Await'
import { useCategoriesAPI } from './Drive/Categories/categoriesHooks'
import { useDirectoryIds } from './Drive/directoryIdsHooks'

// =============
// === Drive ===
// =============

/** Props for a {@link Drive}. */
export interface DriveProps {
  readonly hidden: boolean
  readonly initialProjectName: string | null
  readonly assetsManagementApiRef: React.Ref<assetsTable.AssetManagementApi>
}

const CATEGORIES_TO_DISPLAY_START_MODAL = ['cloud', 'local', 'local-directory']

/** Contains directory path and directory contents (projects, folders, secrets and files). */
function Drive(props: DriveProps) {
  const { isOffline } = offlineHooks.useOffline()
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const { user } = authProvider.useFullUserSession()
  const localBackend = backendProvider.useLocalBackend()
  const { getText } = textProvider.useText()
  const categoriesAPI = useCategoriesAPI()
  const { category, resetCategory, setCategory } = categoriesAPI

  const isCloud = categoryModule.isCloudCategory(category)

  const supportLocalBackend = localBackend != null

  const status =
    isCloud && isOffline ? 'offline'
    : isCloud && !user.isEnabled ? 'not-enabled'
    : 'ok'

  switch (status) {
    case 'not-enabled': {
      return (
        <result.Result
          status="error"
          title={getText('notEnabledTitle')}
          testId="not-enabled-stub"
          subtitle={`${getText('notEnabledSubtitle')}${localBackend == null ? ' ' + getText('downloadFreeEditionMessage') : ''}`}
        >
          <ariaComponents.ButtonGroup align="center">
            <ariaComponents.Button variant="primary" size="medium" href={appUtils.SUBSCRIBE_PATH}>
              {getText('upgrade')}
            </ariaComponents.Button>

            {!supportLocalBackend && (
              <ariaComponents.Button
                data-testid="download-free-edition"
                size="medium"
                variant="accent"
                onPress={async () => {
                  const downloadUrl = await github.getDownloadUrl()
                  if (downloadUrl == null) {
                    toastAndLog('noAppDownloadError')
                  } else {
                    download.download(downloadUrl)
                  }
                }}
              >
                {getText('downloadFreeEdition')}
              </ariaComponents.Button>
            )}
          </ariaComponents.ButtonGroup>
        </result.Result>
      )
    }
    case 'offline':
    case 'ok': {
      return (
        <DriveAssetsView
          {...props}
          category={category}
          setCategory={setCategory}
          resetCategory={resetCategory}
        />
      )
    }
  }
}

/**
 * Props for a {@link DriveAssetsView}.
 */
interface DriveAssetsViewProps extends DriveProps {
  readonly category: Category
  readonly setCategory: (categoryId: Category['id']) => void
  readonly resetCategory: () => void
}

/**
 * The assets view of the Drive.
 */
function DriveAssetsView(props: DriveAssetsViewProps) {
  const {
    category,
    setCategory,
    hidden = false,
    initialProjectName,
    assetsManagementApiRef,
    resetCategory,
  } = props

  const deferredCategory = useDeferredValue(category)

  const { getText } = textProvider.useText()
  const { isOffline } = offlineHooks.useOffline()
  const { user } = authProvider.useFullUserSession()
  const localBackend = backendProvider.useLocalBackend()
  const backend = backendProvider.useBackend(category)
  const dispatchAssetListEvent = eventListProvider.useDispatchAssetListEvent()

  const [query, setQuery] = React.useState(() => AssetQuery.fromString(''))
  const [shouldForceHideStartModal, setShouldForceHideStartModal] = React.useState(false)

  const isCloud = categoryModule.isCloudCategory(category)
  const supportLocalBackend = localBackend != null

  const targetDirectory = useTargetDirectory()

  const status =
    isCloud && isOffline ? 'offline'
    : isCloud && !user.isEnabled ? 'not-enabled'
    : 'ok'

  const doEmptyTrash = useEventCallback(() => {
    dispatchAssetListEvent({ type: AssetListEventType.emptyTrash })
  })

  const { rootDirectoryId } = useDirectoryIds({ category })

  const queryClient = useQueryClient()
  const rootDirectoryQuery = listDirectoryQueryOptions({
    backend,
    category,
    parentId: rootDirectoryId,
  })

  const {
    data: isEmpty,
    error,
    isFetching,
    promise,
  } = useQuery({
    ...rootDirectoryQuery,
    refetchOnMount: 'always',
    select: (data) => data.length === 0,
  })

  // When the directory is no longer empty, we need to hide the start modal.
  // This includes the cases when the directory wasn't empty before, but it's now empty
  // (e.g. when the user deletes the last asset).
  useEffect(() => {
    if (isEmpty === false) {
      setShouldForceHideStartModal(true)
    }
  }, [isEmpty])

  // When the root directory changes, we need to show the start modal
  // if the directory is empty.
  useEffect(() => {
    setShouldForceHideStartModal(false)
  }, [category.type])

  // Show the error boundary if the query failed, but has data.
  if (error != null && !isFetching) {
    if (error instanceof DirectoryDoesNotExistError) {
      toast.error(getText('directoryDoesNotExistError'), {
        toastId: 'directory-does-not-exist-error',
      })
      resetCategory()
    }
    // Remove the query from the cache.
    // This will force the query to be refetched when the user navigates again.
    queryClient.removeQueries({ queryKey: rootDirectoryQuery.queryKey })
  }

  return (
    <div className={tailwindMerge.twMerge('relative flex grow', hidden && 'hidden')}>
      <div
        data-testid="drive-view"
        className="mt-4 flex flex-1 flex-col gap-4 overflow-visible px-page-x"
      >
        <Await promise={promise}>
          {(noFilesInDirectory) => {
            const hasPermissionToCreateAssets = tryFindSelfPermission(
              user,
              targetDirectory?.item.permissions ?? [],
            )

            const shouldDisplayStartModal =
              noFilesInDirectory &&
              CATEGORIES_TO_DISPLAY_START_MODAL.includes(category.type) &&
              !shouldForceHideStartModal

            const shouldDisableActions =
              category.type === 'cloud' &&
              (user.plan === Plan.enterprise || user.plan === Plan.team) &&
              !hasPermissionToCreateAssets

            return (
              <DriveBar
                key={rootDirectoryId}
                backend={backend}
                query={query}
                setQuery={setQuery}
                category={category}
                doEmptyTrash={doEmptyTrash}
                isEmpty={noFilesInDirectory}
                shouldDisplayStartModal={shouldDisplayStartModal}
                isDisabled={shouldDisableActions}
              />
            )
          }}
        </Await>

        <div className="flex flex-1 gap-drive overflow-hidden">
          <div className="flex w-36 flex-none flex-col gap-drive-sidebar overflow-y-auto overflow-x-hidden py-drive-sidebar-y">
            <CategorySwitcher category={category} setCategoryId={setCategory} />

            {isCloud && (
              <Labels
                backend={backend}
                draggable={category.type !== 'trash'}
                query={query}
                setQuery={setQuery}
              />
            )}
          </div>

          <Await
            promise={promise}
            onBeforeFallbackShown={() => {
              if (error instanceof OfflineError) {
                return (
                  <OfflineMessage
                    supportLocalBackend={supportLocalBackend}
                    setCategory={setCategory}
                  />
                )
              }
            }}
          >
            {status === 'offline' ?
              <OfflineMessage supportLocalBackend={supportLocalBackend} setCategory={setCategory} />
            : <AssetsTable
                assetManagementApiRef={assetsManagementApiRef}
                hidden={hidden}
                query={query}
                setQuery={setQuery}
                category={deferredCategory}
                initialProjectName={initialProjectName}
              />
            }
          </Await>
        </div>
      </div>

      <AssetPanel backendType={backend.type} category={deferredCategory} />
    </div>
  )
}

/**
 * Props for {@link OfflineMessage}
 */
interface OfflineMessageProps {
  readonly supportLocalBackend: boolean
  readonly setCategory: (category: categoryModule.Category['id']) => void
}

/**
 * Offline message component.
 * Displays info that the ctegory selected in unavailable
 * in offline mode
 */
function OfflineMessage(props: OfflineMessageProps) {
  const { supportLocalBackend, setCategory } = props
  const { getText } = textProvider.useText()

  return (
    <result.Result
      status={<SvgMask src={Offline} className="aspect-square h-6" />}
      className="my-12"
      centered="horizontal"
      title={getText('cloudUnavailableOffline')}
      subtitle={`${getText('cloudUnavailableOfflineDescription')} ${supportLocalBackend ? getText('cloudUnavailableOfflineDescriptionOfferLocal') : ''}`}
    >
      {supportLocalBackend && (
        <ariaComponents.Button
          variant="primary"
          className="mx-auto"
          onPress={() => {
            setCategory('local')
          }}
        >
          {getText('switchToLocal')}
        </ariaComponents.Button>
      )}
    </result.Result>
  )
}

export default React.memo(Drive)
