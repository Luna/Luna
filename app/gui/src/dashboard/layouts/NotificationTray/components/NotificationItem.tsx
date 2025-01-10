/** @file An item in the notification tray. */
import { Button, Text } from '#/components/AriaComponents'
import SvgMask from '#/components/SvgMask'
import { GridListItem } from '#/components/aria'
import type { NotificationInfo } from '#/layouts/NotificationTray/types'

/** An item in the notification tray. */
export function NotificationItem(props: NotificationInfo) {
  const { message, icon } = props

  return (
    <GridListItem>
      <div className="flex min-h-12 items-center gap-2 p-2 text-primary">
        <Button isDisabled variant="icon" icon={icon} />
        <Text>{message}</Text>
      </div>
    </GridListItem>
  )
}
