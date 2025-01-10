/** @file A tray for displaying notifications. */
import InboxIcon from '#/assets/inbox.svg'
import { Button, Popover, Text } from '#/components/AriaComponents'
import { Result } from '#/components/Result'
import { DialogTrigger, GridList } from '#/components/aria'
import { NotificationItem } from '#/layouts/NotificationTray/components/NotificationItem'
import { useTransientNotifications } from '#/layouts/NotificationTray/transientNotificationHooks'
import { useText } from '#/providers/TextProvider'

const DIALOG_OFFSET = 16
const DIALOG_CROSS_OFFSET = 16

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
  const { getText } = useText()
  const transientNotifications = useTransientNotifications()
  const hasNotifications = transientNotifications.length > 0

  return (
    <Popover placement="bottom right" offset={DIALOG_OFFSET} crossOffset={DIALOG_CROSS_OFFSET}>
      <div className="flex max-h-[90vh] flex-col overflow-y-auto">
        <Text.Heading level={3} variant="subtitle">
          {getText('notifications')}
        </Text.Heading>
        {!hasNotifications && (
          <Result centered className="min-h-10" title={getText('youAreAllCaughtUp')} />
        )}
        {hasNotifications && (
          <GridList selectionMode="none" items={transientNotifications}>
            {(info) => <NotificationItem {...info} />}
          </GridList>
        )}
      </div>
    </Popover>
  )
}
