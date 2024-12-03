import { useEvent } from '@/composables/events'
import { type ProjectStore } from '@/stores/project'
import { useToast } from '@/util/toast'

/**
 * A composable which sets up several toasts for project management, and creates one for message
 * about user's action error.
 */
export function useGraphEditorToasts(projectStore: ProjectStore) {
  const toastStartup = useToast.info({ autoClose: false })
  const toastConnectionLost = useToast.error({ autoClose: false })
  const toastLspError = useToast.error()
  const toastExecutionFailed = useToast.error()
  const toastUserActionFailed = useToast.error()

  toastStartup.show('Initializing the project. This can take up to one minute.')
  projectStore.firstExecution.then(toastStartup.dismiss)

  projectStore.lsRpcConnection.on('transport/closed', () =>
    toastConnectionLost.show('Lost connection to Language Server.'),
  )
  projectStore.lsRpcConnection.on('transport/connected', () => toastConnectionLost.dismiss())

  projectStore.lsRpcConnection.client.onError((e) =>
    toastLspError.show(`Language server error: ${e}`),
  )
  projectStore.executionContext.on('executionComplete', () => toastExecutionFailed.dismiss())
  projectStore.executionContext.on('executionFailed', (e) =>
    toastExecutionFailed.show(`Execution Failed: ${JSON.stringify(e)}`),
  )

  return { userActionFailed: toastUserActionFailed }
}
