/** @file A list of previous versions of an asset. */
import { useSuspenseQuery } from '@tanstack/react-query'

import { Result } from '#/components/Result'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import { AssetType, BackendType, type AnyAsset, type ProjectAsset } from '#/services/Backend'
import { ProjectSession } from './ProjectSession'

/** Props for a {@link ProjectSessions}. */
export interface ProjectSessionsProps {
  readonly backend: Backend
  readonly item: AnyAsset | null
}

/** A list of previous versions of an asset. */
export function ProjectSessions(props: ProjectSessionsProps) {
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

/** Props for a {@link AssetProjectSessionsInternal}. */
interface AssetProjectSessionsInternalProps extends ProjectSessionsProps {
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
          <ProjectSession
            key={session.projectSessionId}
            backend={backend}
            project={item}
            projectSession={session}
            index={projectSessionsQuery.data.length - i}
          />
        ))}
      </div>
}
