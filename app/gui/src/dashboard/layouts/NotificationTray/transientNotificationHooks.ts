/** @file Hooks for computing temporary notifications. */

import { useIsMutating } from '@tanstack/react-query'
import { BackendType } from 'enso-common/src/services/Backend'

export function useTransientNotificationsForBackend(backendType: BackendType) {
  const what = useIsMutating({ mutationKey: [] })
}

export function useTransientNotifications() {
  const what = useIsMutating({ mutationKey: [BackendType.local, 'deleting'] })
}
