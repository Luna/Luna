/** @file An item in the notification tray. */
import { Text } from '#/components/AriaComponents'
import SvgMask from '#/components/SvgMask'
import { GridListItem } from '#/components/aria'
import type { NotificationInfo } from '#/layouts/NotificationTray/types'

/** An item in the notification tray. */
export function NotificationItem(props: NotificationInfo) {
  const { message, icon } = props

  return (
    <GridListItem>
      <div className="flex items-center">
        <SvgMask src={icon} />
        <Text>{message}</Text>
      </div>
    </GridListItem>
  )
}
