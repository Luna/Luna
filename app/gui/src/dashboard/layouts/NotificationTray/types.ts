/** @file Types related to the `NotificationTray`. */
import type { ButtonProps } from '#/components/AriaComponents'

/** Information required to display a notification. */
export interface NotificationInfo {
  readonly id: string
  readonly message: string
  readonly icon: string
  readonly color?: ButtonProps['color']
}
