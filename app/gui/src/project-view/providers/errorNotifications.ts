import { createContextStore } from '@/providers/index'
import { identity } from '@vueuse/core'

type UserActionFailed = (message: string) => void

export const [provideErrorNotifications, useErrorNotifications] = createContextStore(
  'Error notifications',
  identity<UserActionFailed>,
)
