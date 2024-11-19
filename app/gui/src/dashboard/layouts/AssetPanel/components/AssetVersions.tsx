/** @file A list of previous versions of an asset. */
import { useState } from 'react'

import { Text } from '#/components/AriaComponents'
import { Result } from '#/components/Result'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import type { AnyAsset } from '#/services/Backend'
import { AssetType, BackendType, type S3ObjectVersion, S3ObjectVersionId } from '#/services/Backend'
import { toRfc3339 } from '#/utilities/dateTime'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { uniqueString } from 'enso-common/src/utilities/uniqueString'
import { AssetVersion } from './AssetVersion'
import { assetVersionsQueryOptions } from './useAssetVersions.ts'

/** Variables for the "add new version" mutation. */
interface AddNewVersionVariables {
  readonly versionId: S3ObjectVersionId
  readonly placeholderId: S3ObjectVersionId
}

/** Props for a {@link AssetVersions}. */
export interface AssetVersionsProps {
  readonly backend: Backend
  readonly item: AnyAsset | null
}

/** Display a list of previous versions of an asset. */
export function AssetVersions(props: AssetVersionsProps) {
  const { item, backend } = props

  const { getText } = useText()

  if (backend.type === BackendType.local) {
    return (
      <Result
        status="info"
        centered
        title={getText('assetVersions.localAssetsDoNotHaveVersions')}
      />
    )
  }

  if (item == null) {
    return <Result status="info" centered title={getText('assetVersions.notSelected')} />
  }

  return <AssetVersionsInternal {...props} item={item} />
}

/** Props for an {@link AssetVersionsInternal}. */
interface AssetVersionsInternalProps extends AssetVersionsProps {
  readonly item: AnyAsset
}

/** Internal implementation of {@link AssetVersions}. */
function AssetVersionsInternal(props: AssetVersionsInternalProps) {
  const { backend, item } = props

  const { getText } = useText()
  const toastAndLog = useToastAndLog()

  const [placeholderVersions, setPlaceholderVersions] = useState<readonly S3ObjectVersion[]>([])

  const versionsQuery = useSuspenseQuery(
    assetVersionsQueryOptions({
      assetId: item.id,
      backend,
      onError: (backendError) => toastAndLog('listVersionsError', backendError),
    }),
  )

  const latestVersion = versionsQuery.data.find((version) => version.isLatest)

  const restoreMutation = useMutation({
    mutationFn: async (variables: AddNewVersionVariables) => {
      if (item.type === AssetType.project) {
        await backend.restoreProject(item.id, variables.versionId, item.title)
      }
    },
    onMutate: (variables) => {
      setPlaceholderVersions((oldVersions) => [
        {
          isLatest: false,
          key: uniqueString(),
          lastModified: toRfc3339(new Date()),
          versionId: variables.placeholderId,
        },
        ...oldVersions,
      ])
    },
    onSuccess: async () => {
      // `backend.restoreProject` does not return the ID of the new version, so a full refetch is
      // necessary.
      await versionsQuery.refetch()
    },
    onError: (error: unknown) => {
      toastAndLog('restoreProjectError', error, item.title)
    },
    onSettled: (_data, _error, variables) => {
      setPlaceholderVersions((oldVersions) =>
        oldVersions.filter((version) => version.versionId !== variables.placeholderId),
      )
    },
  })

  return (
    <div className="pointer-events-auto flex flex-1 shrink-0 flex-col items-center overflow-y-auto overflow-x-hidden">
      {versionsQuery.data.length === 0 ?
        <div>{getText('noVersionsFound')}</div>
      : latestVersion == null ?
        <Text color="danger">{getText('fetchLatestVersionError')}</Text>
      : [
          ...placeholderVersions.map((version, i) => (
            <AssetVersion
              key={version.versionId}
              placeholder
              number={versionsQuery.data.length + placeholderVersions.length - i}
              version={version}
              item={item}
              backend={backend}
              latestVersion={latestVersion}
              doRestore={() => {}}
            />
          )),
          ...versionsQuery.data.map((version, i) => (
            <AssetVersion
              key={version.versionId}
              number={versionsQuery.data.length - i}
              version={version}
              item={item}
              backend={backend}
              latestVersion={latestVersion}
              doRestore={() =>
                restoreMutation.mutateAsync({
                  versionId: version.versionId,
                  placeholderId: S3ObjectVersionId(uniqueString()),
                })
              }
            />
          )),
        ]
      }
    </div>
  )
}
