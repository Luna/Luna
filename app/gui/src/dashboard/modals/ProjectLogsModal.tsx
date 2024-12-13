/** @file A modal for showing logs for a project. */
import { useSuspenseQuery } from '@tanstack/react-query'

import type { Backend, ProjectSessionId } from 'enso-common/src/services/Backend'

import ReloadIcon from '#/assets/reload.svg'
import { Button, Dialog } from '#/components/AriaComponents'
import { useText } from '#/providers/TextProvider'

/** Props for a {@link ProjectLogsModal}. */
export interface ProjectLogsModalProps {
  readonly backend: Backend
  readonly projectSessionId: ProjectSessionId
  readonly projectTitle: string
}

/** A modal for showing logs for a project. */
export default function ProjectLogsModal(props: ProjectLogsModalProps) {
  const { getText } = useText()

  return (
    <Dialog title={getText('logs')} type="fullscreen">
      {() => <ProjectLogsModalInternal {...props} />}
    </Dialog>
  )
}

/** A modal for showing logs for a project. */
function ProjectLogsModalInternal(props: ProjectLogsModalProps) {
  const { backend, projectSessionId, projectTitle } = props
  const { getText } = useText()

  const logsQuery = useSuspenseQuery({
    queryKey: ['projectLogs', { projectSessionId, projectTitle }],
    queryFn: async () => {
      const logs = await backend.getProjectSessionLogs(projectSessionId, projectTitle)
      return logs.join('\n')
    },
  })

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 self-start rounded-full border-0.5 border-primary/20 px-[11px] py-2">
        <Button
          size="medium"
          variant="icon"
          icon={ReloadIcon}
          aria-label={getText('reload')}
          onPress={async () => {
            await logsQuery.refetch()
          }}
        />
      </div>
      <pre className="relative overflow-auto whitespace-pre-wrap">
        <code>{logsQuery.data}</code>
      </pre>
    </div>
  )
}
