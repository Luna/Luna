/** @file The directory header bar and directory item listing. */
import { memo, useDeferredValue, useEffect, useState, type Ref } from 'react'

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'

import { SUBSCRIBE_PATH } from '#/appUtils'
import OfflineIcon from '#/assets/offline_filled.svg'
import * as ariaComponents from '#/components/AriaComponents'
import { Button, ButtonGroup } from '#/components/AriaComponents'
import { ErrorBoundary, useErrorBoundary } from '#/components/ErrorBoundary'
import * as result from '#/components/Result'
import { Result } from '#/components/Result'
import SvgMask from '#/components/SvgMask'
import AssetListEventType from '#/events/AssetListEventType'
import { listDirectoryQueryOptions } from '#/hooks/backendHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useOffline } from '#/hooks/offlineHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { AssetPanel } from '#/layouts/AssetPanel'
import AssetsTable, {
  AssetsTableAssetsUnselector,
  type AssetManagementApi,
} from '#/layouts/AssetsTable'
import CategorySwitcher from '#/layouts/CategorySwitcher'
import * as categoryModule from '#/layouts/CategorySwitcher/Category'
import { isCloudCategory, type Category } from '#/layouts/CategorySwitcher/Category'
import DriveBar from '#/layouts/DriveBar'
import Labels from '#/layouts/Labels'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useBackend, useLocalBackend } from '#/providers/BackendProvider'
import { useTargetDirectory } from '#/providers/DriveProvider'
import { useText } from '#/providers/TextProvider'
import { DirectoryDoesNotExistError, Plan } from '#/services/Backend'
import AssetQuery from '#/utilities/AssetQuery'
import { download } from '#/utilities/download'
import { getDownloadUrl } from '#/utilities/github'
import { OfflineError } from '#/utilities/HttpClient'
import { tryFindSelfPermission } from '#/utilities/permissions'
import * as tailwindMerge from '#/utilities/tailwindMerge'
import { Suspense } from '../components/Suspense'
import { useCategoriesAPI } from './Drive/Categories/categoriesHooks'
import { useDirectoryIds } from './Drive/directoryIdsHooks'
import { useDispatchAssetListEvent } from './Drive/EventListProvider'

/** Props for a {@link Drive}. */
export interface DriveProps {
  readonly hidden: boolean
  readonly initialProjectName: string | null
  readonly assetsManagementApiRef: Ref<AssetManagementApi>
}

const CATEGORIES_TO_DISPLAY_START_MODAL = ['cloud', 'local', 'local-directory']

/** Contains directory path and directory contents (projects, folders, secrets and files). */
function Drive(props: DriveProps) {
  const { isOffline } = useOffline()
  const toastAndLog = useToastAndLog()
  const { user } = useFullUserSession()
  const localBackend = useLocalBackend()
  const { getText } = useText()
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
        <Result
          status="error"
          title={getText('notEnabledTitle')}
          testId="not-enabled-stub"
          subtitle={`${getText('notEnabledSubtitle')}${localBackend == null ? ' ' + getText('downloadFreeEditionMessage') : ''}`}
        >
          <ButtonGroup align="center">
            <Button variant="primary" size="medium" href={SUBSCRIBE_PATH}>
              {getText('upgrade')}
            </Button>

            {!supportLocalBackend && (
              <Button
                data-testid="download-free-edition"
                size="medium"
                variant="accent"
                onPress={async () => {
                  const downloadUrl = await getDownloadUrl()
                  if (downloadUrl == null) {
                    toastAndLog('noAppDownloadError')
                  } else {
                    download(downloadUrl)
                  }
                }}
              >
                {getText('downloadFreeEdition')}
              </Button>
            )}
          </ButtonGroup>
        </Result>
      )
    }
    case 'offline':
    case 'ok': {
      return (
        <ErrorBoundary
          onBeforeFallbackShown={({ resetErrorBoundary, error, resetQueries }) => {
            if (error instanceof DirectoryDoesNotExistError) {
              toast.error(getText('directoryDoesNotExistError'), {
                toastId: 'directory-does-not-exist-error',
              })
              resetCategory()
              resetQueries()
              resetErrorBoundary()
            }

            if (error instanceof OfflineError) {
              return (
                <OfflineMessage
                  supportLocalBackend={supportLocalBackend}
                  setCategory={(nextCategory) => {
                    setCategory(nextCategory)
                    resetErrorBoundary()
                  }}
                />
              )
            }
          }}
        >
          <Suspense>
            <DriveAssetsView {...props} category={category} setCategory={setCategory} />
          </Suspense>
        </ErrorBoundary>
      )
    }
  }
}

/** Props for a {@link DriveAssetsView}. */
interface DriveAssetsViewProps extends DriveProps {
  readonly category: Category
  readonly setCategory: (categoryId: Category['id']) => void
}

/** The assets view of the Drive. */
function DriveAssetsView(props: DriveAssetsViewProps) {
  const {
    category,
    setCategory,
    hidden = false,
    initialProjectName,
    assetsManagementApiRef,
  } = props

  const deferredCategory = useDeferredValue(category)
  const { showBoundary } = useErrorBoundary()

  const { isOffline } = useOffline()
  const { user } = useFullUserSession()
  const localBackend = useLocalBackend()
  const backend = useBackend(category)
  const dispatchAssetListEvent = useDispatchAssetListEvent()

  const [query, setQuery] = useState(() => AssetQuery.fromString(''))
  const [shouldForceHideStartModal, setShouldForceHideStartModal] = useState(false)

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
  } = useSuspenseQuery({
    ...rootDirectoryQuery,
    refetchOnMount: 'always',
    staleTime: ({ state }) => (state.error ? 0 : Infinity),
    select: (data) => data.length === 0,
  })

  // Show the error boundary if the query failed, but has data.
  if (error != null && !isFetching) {
    showBoundary(error)
    // Remove the query from the cache.
    // This will force the query to be refetched when the user navigates again.
    queryClient.removeQueries({ queryKey: rootDirectoryQuery.queryKey })
  }

  // When the directory is no longer empty, we need to hide the start modal.
  // This includes the cases when the directory wasn't empty before, but it's now empty
  // (e.g. when the user deletes the last asset).
  useEffect(() => {
    if (!isEmpty) {
      setShouldForceHideStartModal(true)
    }
  }, [isEmpty])

  // When the root directory changes, we need to show the start modal
  // if the directory is empty.
  useEffect(() => {
    setShouldForceHideStartModal(false)
  }, [category.type])

  const hasPermissionToCreateAssets = tryFindSelfPermission(
    user,
    targetDirectory?.item.permissions ?? [],
  )

  const shouldDisplayStartModal =
    isEmpty &&
    CATEGORIES_TO_DISPLAY_START_MODAL.includes(category.type) &&
    !shouldForceHideStartModal

  const shouldDisableActions =
    category.type === 'cloud' &&
    (user.plan === Plan.enterprise || user.plan === Plan.team) &&
    !hasPermissionToCreateAssets

  return (
    <div className={tailwindMerge.twMerge('relative flex grow', hidden && 'hidden')}>
      <div
        data-testid="drive-view"
        className="mt-4 flex flex-1 flex-col gap-4 overflow-visible px-page-x"
      >
        <DriveBar
          key={rootDirectoryId}
          backend={backend}
          query={query}
          setQuery={setQuery}
          category={category}
          doEmptyTrash={doEmptyTrash}
          isEmpty={isEmpty}
          shouldDisplayStartModal={shouldDisplayStartModal}
          isDisabled={shouldDisableActions}
        />

        <div className="flex flex-1 gap-drive overflow-hidden">
          <div className="flex w-40 flex-none flex-col gap-drive-sidebar overflow-y-auto overflow-x-hidden py-drive-sidebar-y">
            <CategorySwitcher category={category} setCategoryId={setCategory} />

            {isCloud && (
              <Labels
                backend={backend}
                draggable={category.type !== 'trash'}
                query={query}
                setQuery={setQuery}
              />
            )}

            <AssetsTableAssetsUnselector />
          </div>

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
        </div>
      </div>

      <AssetPanel backendType={backend.type} category={deferredCategory} />
    </div>
  )
}

/** Props for {@link OfflineMessage}. */
interface OfflineMessageProps {
  readonly supportLocalBackend: boolean
  readonly setCategory: (category: categoryModule.Category['id']) => void
}

/** Display info that the category selected is unavailable in offline mode. */
function OfflineMessage(props: OfflineMessageProps) {
  const { supportLocalBackend, setCategory } = props
  const { getText } = useText()

  return (
    <result.Result
      status={<SvgMask src={OfflineIcon} className="aspect-square h-6" />}
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

export default memo(Drive)
