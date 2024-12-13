/** @file Displays a non-interactable icon for an asset based on its type and name. */
import { AssetType, type AnyAsset } from 'enso-common/src/services/Backend'

import BlankIcon from '#/assets/blank.svg'
import DatalinkIcon from '#/assets/datalink.svg'
import FolderIcon from '#/assets/folder.svg'
import KeyIcon from '#/assets/key.svg'
import NetworkIcon from '#/assets/network.svg'
import SvgMask from '#/components/SvgMask'
import { fileIcon } from '#/utilities/fileIcon'

/** Props for an {@link AssetIcon}. */
export interface AssetIconProps {
  readonly asset: AnyAsset
  readonly className?: string
}

/** Displays a few details of an asset. */
export default function AssetIcon(props: AssetIconProps) {
  const { asset, className } = props
  switch (asset.type) {
    case AssetType.directory: {
      return <SvgMask src={FolderIcon} className={className} />
    }
    case AssetType.project: {
      return <SvgMask src={NetworkIcon} className={className} />
    }
    case AssetType.file: {
      return <SvgMask src={fileIcon()} className={className} />
    }
    case AssetType.datalink: {
      return <SvgMask src={DatalinkIcon} className={className} />
    }
    case AssetType.secret: {
      return <SvgMask src={KeyIcon} className={className} />
    }
    case AssetType.specialLoading:
    case AssetType.specialEmpty:
    case AssetType.specialError: {
      // It should not be possible for these to be displayed, but return something anyway.
      return <SvgMask src={BlankIcon} className={className} />
    }
  }
}
