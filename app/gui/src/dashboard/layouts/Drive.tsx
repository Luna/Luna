/** @file The directory header bar and directory item listing. */
import { useCallback, useState, type Ref } from 'react'

import { SUBSCRIBE_PATH } from '#/appUtils'
import { Button, ButtonGroup } from '#/components/AriaComponents'
import { Result } from '#/components/Result'
import AssetListEventType from '#/events/AssetListEventType'
import { useOffline } from '#/hooks/offlineHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { AssetPanel } from '#/layouts/AssetPanel'
import AssetsTable, { type AssetManagementApi } from '#/layouts/AssetsTable'
import { useDispatchAssetListEvent } from '#/layouts/AssetsTable/EventListProvider'
import CategorySwitcher from '#/layouts/CategorySwitcher'
import { isCloudCategory, type Category } from '#/layouts/CategorySwitcher/Category'
import DriveBar from '#/layouts/DriveBar'
import Labels from '#/layouts/Labels'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useBackend, useLocalBackend } from '#/providers/BackendProvider'
import { useText } from '#/providers/TextProvider'
import AssetQuery from '#/utilities/AssetQuery'
import { download } from '#/utilities/download'
import { getDownloadUrl } from '#/utilities/github'
import { twMerge } from '#/utilities/tailwindMerge'

/** Props for a {@link Drive}. */
export interface DriveProps {
  readonly category: Category
  readonly setCategory: (category: Category) => void
  readonly hidden: boolean
  readonly initialProjectName: string | null
  readonly assetsManagementApiRef: Ref<AssetManagementApi>
}

/** Contains directory path and directory contents (projects, folders, secrets and files). */
export default function Drive(props: DriveProps) {
  const { category, setCategory, hidden, initialProjectName, assetsManagementApiRef } = props

  const { isOffline } = useOffline()
  const toastAndLog = useToastAndLog()
  const { user } = useFullUserSession()
  const localBackend = useLocalBackend()
  const backend = useBackend(category)
  const { getText } = useText()
  const dispatchAssetListEvent = useDispatchAssetListEvent()
  const [query, setQuery] = useState(() => AssetQuery.fromString(''))
  const isCloud = isCloudCategory(category)
  const supportLocalBackend = localBackend != null

  const status =
    isCloud && isOffline ? 'offline'
    : isCloud && !user.isEnabled ? 'not-enabled'
    : 'ok'

  const doEmptyTrash = useCallback(() => {
    dispatchAssetListEvent({ type: AssetListEventType.emptyTrash })
  }, [dispatchAssetListEvent])

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
        <div className={twMerge('relative flex grow', hidden && 'hidden')}>
          <div
            data-testid="drive-view"
            className="mt-4 flex flex-1 flex-col gap-4 overflow-visible px-page-x"
          >
            <DriveBar
              backend={backend}
              query={query}
              setQuery={setQuery}
              category={category}
              doEmptyTrash={doEmptyTrash}
            />

            <div className="flex flex-1 gap-drive overflow-hidden">
              <div className="flex w-36 flex-col gap-drive-sidebar overflow-y-auto py-drive-sidebar-y">
                <CategorySwitcher category={category} setCategory={setCategory} />
                {isCloud && (
                  <Labels
                    backend={backend}
                    draggable={category.type !== 'trash'}
                    query={query}
                    setQuery={setQuery}
                  />
                )}
              </div>
              {status === 'offline' ?
                <Result
                  status="info"
                  className="my-12"
                  centered="horizontal"
                  title={getText('cloudUnavailableOffline')}
                  subtitle={`${getText('cloudUnavailableOfflineDescription')} ${supportLocalBackend ? getText('cloudUnavailableOfflineDescriptionOfferLocal') : ''}`}
                >
                  {supportLocalBackend && (
                    <Button
                      variant="primary"
                      size="small"
                      className="mx-auto"
                      onPress={() => {
                        setCategory({ type: 'local' })
                      }}
                    >
                      {getText('switchToLocal')}
                    </Button>
                  )}
                </Result>
              : <AssetsTable
                  assetManagementApiRef={assetsManagementApiRef}
                  hidden={hidden}
                  query={query}
                  setQuery={setQuery}
                  category={category}
                  initialProjectName={initialProjectName}
                />
              }
            </div>
          </div>
          <AssetPanel backendType={backend.type} category={category} />
        </div>
      )
    }
  }
}
