/** @file A list of previous versions of an asset. */
import { useSuspenseQuery } from '@tanstack/react-query'

import type Backend from 'enso-common/src/services/Backend'
import { AssetType, BackendType, type ProjectAsset } from 'enso-common/src/services/Backend'

import { Result } from '#/components/Result'
import AssetProjectSession from '#/layouts/AssetProjectSession'
import { useText } from '#/providers/TextProvider'
import { useStore } from '#/utilities/zustand'
import { assetPanelStore } from './AssetPanel'

/** Props for a {@link AssetProjectSessions}. */
export interface AssetProjectSessionsProps {
  readonly backend: Backend
}

/** A list of previous versions of an asset. */
export default function AssetProjectSessions(props: AssetProjectSessionsProps) {
  const { backend } = props

  const { getText } = useText()

  const { item } = useStore(assetPanelStore, (state) => ({ item: state.assetPanelProps.item }), {
    unsafeEnableTransition: true,
  })

  if (backend.type === BackendType.local) {
    return <Result status="info" centered title={getText('assetProjectSessions.localBackend')} />
  }

  if (item == null) {
    return <Result status="info" centered title={getText('assetProjectSessions.notSelected')} />
  }

  if (item.type !== AssetType.project) {
    return <Result status="info" centered title={getText('assetProjectSessions.notProjectAsset')} />
  }

  return <AssetProjectSessionsInternal {...props} item={item} />
}

/** Props for a {@link AssetProjectSessionsInternal}. */
interface AssetProjectSessionsInternalProps extends AssetProjectSessionsProps {
  readonly item: ProjectAsset
}

/** A list of previous versions of an asset. */
function AssetProjectSessionsInternal(props: AssetProjectSessionsInternalProps) {
  const { backend, item } = props
  const { getText } = useText()

  const projectSessionsQuery = useSuspenseQuery({
    queryKey: ['getProjectSessions', item.id, item.title],
    queryFn: async () => {
      const sessions = await backend.listProjectSessions(item.id, item.title)
      return [...sessions].reverse()
    },
  })

  return projectSessionsQuery.data.length === 0 ?
      <Result status="info" centered title={getText('assetProjectSessions.noSessions')} />
    : <div className="flex w-full flex-col justify-start">
        {projectSessionsQuery.data.map((session, i) => (
          <AssetProjectSession
            key={session.projectSessionId}
            backend={backend}
            project={item}
            projectSession={session}
            index={projectSessionsQuery.data.length - i}
          />
        ))}
      </div>
}
