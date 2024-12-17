/** @file Events related to changes in the asset list. */
import type AssetListEventType from '#/events/AssetListEventType'
import { useCopyAssetsMutation } from '#/hooks/backendHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useTransferBetweenCategories, type Category } from '#/layouts/CategorySwitcher/Category'
import type { DrivePastePayload } from '#/providers/DriveProvider'

import type * as backendModule from '#/services/Backend'
import type Backend from '#/services/Backend'
import type { AnyAssetTreeNode } from '#/utilities/AssetTreeNode'
import { isTeamPath, isUserPath } from '#/utilities/permissions'

/** Properties common to all asset list events. */
interface AssetListBaseEvent<Type extends AssetListEventType> {
  readonly type: Type
}

/** All possible events. */
interface AssetListEvents {
  readonly duplicateProject: AssetListDuplicateProjectEvent
}

/** A type to ensure that {@link AssetListEvents} contains every {@link AssetListEventType}. */
// This is meant only as a sanity check, so it is allowed to break lint rules.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type SanityCheck<
  T extends {
    readonly [Type in keyof typeof AssetListEventType]: AssetListBaseEvent<
      (typeof AssetListEventType)[Type]
    >
  } = AssetListEvents,
> = [T]

/** A signal to duplicate a project. */
interface AssetListDuplicateProjectEvent
  extends AssetListBaseEvent<AssetListEventType.duplicateProject> {
  readonly parentKey: backendModule.DirectoryId
  readonly parentId: backendModule.DirectoryId
  readonly original: backendModule.ProjectAsset
  readonly versionId: backendModule.S3ObjectVersionId
}

/** Every possible type of asset list event. */
export type AssetListEvent = AssetListEvents[keyof AssetListEvents]

/**
 * A hook to copy or move assets as appropriate. Assets are moved, except when performing
 * a cut and paste between the Team Space and the User Space, in which case the asset is copied.
 */
export function useCutAndPaste(backend: Backend, category: Category) {
  const copyAssetsMutation = useCopyAssetsMutation(backend)
  const transferBetweenCategories = useTransferBetweenCategories(category)

  return useEventCallback(
    (
      newParentKey: backendModule.DirectoryId,
      newParentId: backendModule.DirectoryId,
      pasteData: DrivePastePayload,
      nodeMap: ReadonlyMap<backendModule.AssetId, AnyAssetTreeNode>,
    ) => {
      const ids = Array.from(pasteData.ids)
      const nodes = ids.flatMap((id) => {
        const item = nodeMap.get(id)
        return item == null ? [] : [item]
      })
      const newParent = nodeMap.get(newParentKey)
      const isMovingToUserSpace = newParent?.path != null && isUserPath(newParent.path)
      const teamToUserItems =
        isMovingToUserSpace ?
          nodes.filter((node) => isTeamPath(node.path)).map((otherItem) => otherItem.item)
        : []
      const nonTeamToUserIds =
        isMovingToUserSpace ?
          nodes.filter((node) => !isTeamPath(node.path)).map((otherItem) => otherItem.item.id)
        : ids
      if (teamToUserItems.length !== 0) {
        copyAssetsMutation.mutate([teamToUserItems.map((item) => item.id), newParentId])
      }
      if (nonTeamToUserIds.length !== 0) {
        transferBetweenCategories(pasteData.category, category, pasteData.ids, newParentId)
      }
    },
  )
}
