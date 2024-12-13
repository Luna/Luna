/** @file A list of previous versions of an asset. */
import { useState } from 'react'

import { useMutation, useSuspenseQuery } from '@tanstack/react-query'

import {
  AssetType,
  BackendType,
  S3ObjectVersionId,
  type AnyAsset,
  type Backend,
  type S3ObjectVersion,
} from 'enso-common/src/services/Backend'
import { toRfc3339 } from 'enso-common/src/utilities/data/dateTime'
import { noop } from 'enso-common/src/utilities/functions'
import { uniqueString } from 'enso-common/src/utilities/uniqueString'

import { Result } from '#/components/Result'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { assetPanelStore } from '#/layouts/AssetPanel/AssetPanelState'
import AssetVersion from '#/layouts/AssetVersions/AssetVersion'
import { useText } from '#/providers/TextProvider'
import { useStore } from '#/utilities/zustand'
import { assetVersionsQueryOptions } from './useAssetVersions'

/** Variables for the "add new version" mutation. */
interface AddNewVersionVariables {
  readonly versionId: S3ObjectVersionId
  readonly placeholderId: S3ObjectVersionId
}

/** Props for a {@link AssetVersions}. */
export interface AssetVersionsProps {
  readonly backend: Backend
}

/** Display a list of previous versions of an asset. */
export default function AssetVersions(props: AssetVersionsProps) {
  const { backend } = props

  const { item } = useStore(assetPanelStore, (state) => ({ item: state.assetPanelProps.item }), {
    unsafeEnableTransition: true,
  })

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

  const versionsQuery = useSuspenseQuery(assetVersionsQueryOptions({ assetId: item.id, backend }))

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
        <div>{getText('fetchLatestVersionError')}</div>
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
              doRestore={noop}
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
