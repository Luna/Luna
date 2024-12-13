/** @file Displays a few details of an asset. */
import type { AnyAsset } from 'enso-common/src/services/Backend'
import { formatDateTime } from 'enso-common/src/utilities/data/dateTime'

import BreadcrumbArrowIcon from '#/assets/breadcrumb_arrow.svg'
import { Text } from '#/components/aria'
import AssetIcon from '#/components/dashboard/AssetIcon'
import { useText } from '#/providers/TextProvider'
import { twMerge } from '#/utilities/tailwindMerge'

/** Props for an {@link AssetSummary}. */
export interface AssetSummaryProps {
  readonly asset: AnyAsset
  /** If `true`, `lastModified` will be hidden, as it is not relevant. */
  readonly new?: boolean
  readonly newName?: string
  readonly className?: string
}

/** Displays a few details of an asset. */
export default function AssetSummary(props: AssetSummaryProps) {
  const { asset, new: isNew = false, newName, className } = props
  const { getText } = useText()
  return (
    <div
      className={twMerge(
        'flex min-h-row items-center gap-icon-with-text rounded-default bg-frame px-button-x',
        className,
      )}
    >
      <div className="grid size-4 place-items-center">
        <AssetIcon asset={asset} />
      </div>
      <div className="flex flex-col">
        <Text className="flex items-center gap-icon-with-text font-semibold">
          {asset.title}
          {newName != null && (
            <>
              <img src={BreadcrumbArrowIcon} />
              {newName}
            </>
          )}
        </Text>
        {!isNew && (
          <Text>{getText('lastModifiedOn', formatDateTime(new Date(asset.modifiedAt)))}</Text>
        )}
        <Text>{asset.labels}</Text>
      </div>
    </div>
  )
}
