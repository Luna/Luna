/** @file A tray for displaying notifications. */
import InboxIcon from '#/assets/inbox.svg'
import { Button, Dialog } from '#/components/AriaComponents'
import { DialogTrigger } from '#/components/aria'
import { NotificationItem } from '#/layouts/NotificationTray/components/NotificationItem'
import { useTransientNotifications } from '#/layouts/NotificationTray/transientNotificationHooks'

/** A button to show a list of notifications. */
export function NotificationTray() {
  return (
    <DialogTrigger>
      <Button variant="icon" icon={InboxIcon} />
      <NotificationTrayDialog />
    </DialogTrigger>
  )
}

/** Dialog to display notifications for a {@link NotificationTray}. */
function NotificationTrayDialog() {
  const transientNotifications = useTransientNotifications()
  return (
    <Dialog>
      {transientNotifications.map((info, i) => (
        <NotificationItem key={i} {...info} />
      ))}
    </Dialog>
  )
}
