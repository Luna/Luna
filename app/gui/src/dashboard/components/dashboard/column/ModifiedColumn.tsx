/** @file A column displaying the time at which the asset was last modified. */
import { Text } from '#/components/AriaComponents'
import type { AssetColumnProps } from '#/components/dashboard/column'
import { formatDateTime } from '#/utilities/dateTime'

/** A column displaying the time at which the asset was last modified. */
export default function ModifiedColumn(props: AssetColumnProps) {
  const { item } = props

  return (
    <Text className="contain-strict [contain-intrinsic-size:37px] [content-visibility:auto]">
      {formatDateTime(new Date(item.modifiedAt))}
    </Text>
  )
}
