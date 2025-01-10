/** @file Types related to the `NotificationTray`. */

/** Information required to display a notification. */
export interface NotificationInfo {
  readonly id: string
  readonly message: string
  readonly icon: string
  readonly colorClassName?: string
}
