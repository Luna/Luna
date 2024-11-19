/** @file A calendar showing executions of a project. */
import { useSuspenseQuery } from '@tanstack/react-query'

import { Button, ButtonGroup, DialogTrigger, Text } from '#/components/AriaComponents'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { Result } from '#/components/Result'
import { Suspense } from '#/components/Suspense'
import { NewProjectExecutionModal } from '#/layouts/NewProjectExecutionModal'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import { AssetType, BackendType, type AnyAsset, type ProjectAsset } from '#/services/Backend'
import ProjectExecution from './ProjectExecution'

/** Props for a {@link ProjectExecutionsCalendar}. */
export interface ProjectExecutionsCalendarProps {
  readonly backend: Backend
  readonly item: AnyAsset | null
}

/** A calendar showing executions of a project. */
export function ProjectExecutionsCalendar(props: ProjectExecutionsCalendarProps) {
  const { backend, item } = props

  const { getText } = useText()

  if (backend.type === BackendType.local) {
    return <Result status="info" centered title={getText('assetProjectExecutions.localBackend')} />
  }

  if (item == null) {
    return <Result status="info" centered title={getText('assetProjectExecutions.notSelected')} />
  }

  if (item.type !== AssetType.project) {
    return (
      <Result status="info" centered title={getText('assetProjectExecutions.notProjectAsset')} />
    )
  }

  return (
    <ErrorBoundary>
      <Suspense>
        <ProjectExecutionsCalendarInternal {...props} item={item} />
      </Suspense>
    </ErrorBoundary>
  )
}

/** Props for a {@link ProjectExecutionsCalendarInternal}. */
interface ProjectExecutionsCalendarInternalProps extends ProjectExecutionsCalendarProps {
  readonly item: ProjectAsset
}

/** A calendar showing executions of a project. */
function ProjectExecutionsCalendarInternal(props: ProjectExecutionsCalendarInternalProps) {
  const { backend, item } = props
  const { getText } = useText()

  const projectExecutionsQuery = useSuspenseQuery({
    queryKey: [backend.type, 'listProjectExecutions', item.id, item.title],
    queryFn: async () => {
      const executions = await backend.listProjectExecutions(item.id, item.title)
      return [...executions].reverse()
    },
  })
  const projectExecutions = projectExecutionsQuery.data

  return (
    <div className="pointer-events-auto flex w-full flex-col items-center gap-2 self-start overflow-y-auto overflow-x-hidden">
      <ButtonGroup>
        <DialogTrigger>
          <Button variant="outline">{getText('newProjectExecution')}</Button>
          <NewProjectExecutionModal backend={backend} item={item} />
        </DialogTrigger>
      </ButtonGroup>
      {projectExecutions.length === 0 ?
        <Text color="disabled">{getText('noProjectExecutions')}</Text>
      : projectExecutions.map((execution) => (
          <ProjectExecution
            key={execution.projectExecutionId}
            item={item}
            backend={backend}
            projectExecution={execution}
          />
        ))
      }
    </div>
  )
}
