/** @file A list of previous versions of an asset. */
import * as reactQuery from '@tanstack/react-query'

import AssetProjectSession from '#/layouts/AssetProjectSession'

import type Backend from '#/services/Backend'

import { Result } from '#/components/Result'
import { useText } from '#/providers/TextProvider'
import { AssetType, BackendType, type AnyAsset, type ProjectAsset } from '#/services/Backend'

// ============================
// === AssetProjectSessions ===
// ============================

/** Props for a {@link AssetProjectSessions}. */
export interface AssetProjectSessionsProps {
  readonly backend: Backend
  readonly item: AnyAsset | null
}

/** A list of previous versions of an asset. */
export default function AssetProjectSessions(props: AssetProjectSessionsProps) {
  const { backend, item } = props

  const { getText } = useText()

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

// ====================================
// === AssetProjectSessionsInternal ===
// ====================================

/** Props for a {@link AssetProjectSessionsInternal}. */
interface AssetProjectSessionsInternalProps extends AssetProjectSessionsProps {
  readonly item: ProjectAsset
}

/** A list of previous versions of an asset. */
function AssetProjectSessionsInternal(props: AssetProjectSessionsInternalProps) {
  const { backend, item } = props

  const projectSessionsQuery = reactQuery.useSuspenseQuery({
    queryKey: ['getProjectSessions', item.id, item.title],
    queryFn: async () => {
      const sessions = await backend.listProjectSessions(item.id, item.title)
      return [...sessions].reverse()
    },
  })

  return (
    <div className="flex flex-col items-center">
      {projectSessionsQuery.data.map((session) => (
        <AssetProjectSession
          key={session.projectSessionId}
          backend={backend}
          project={item}
          projectSession={session}
        />
      ))}
    </div>
  )
}
