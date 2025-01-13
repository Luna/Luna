/** @file A modal with inputs for user email and permission level. */
import type { Category } from '#/layouts/CategorySwitcher/Category'
import type Backend from '#/services/Backend'
import { type AnyAsset, type AssetPermission } from '#/services/Backend'

/** Props for a {@link ManagePermissionsModal}. */
export interface ManagePermissionsModalProps<Asset extends AnyAsset = AnyAsset> {
  readonly backend: Backend
  readonly category: Category
  readonly item: Pick<Asset, 'id' | 'parentId' | 'permissions' | 'type'>
  readonly self: AssetPermission
  /**
   * Remove the current user's permissions from this asset. This MUST be a prop because it should
   * change the assets list.
   */
  readonly doRemoveSelf: () => void
  /** If this is `null`, this modal will be centered. */
  readonly eventTarget: HTMLElement | null
}

/**
 * Not implemented yet.
 */
export default function ManagePermissionsModal<Asset extends AnyAsset = AnyAsset>() {
  return null
}
