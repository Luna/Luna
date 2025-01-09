/** @file Functions related to comparing assets. */
import { Column, type SortableColumn } from '#/components/dashboard/column/columnUtils'
import type { AnyAssetTreeNode } from '#/utilities/AssetTreeNode'
import { SortDirection, type SortInfo } from '#/utilities/sorting'

/** Return a function to compare two assets. */
export function assetCompareFunction(
  sortInfo: SortInfo<SortableColumn>,
  locale: string | undefined,
) {
  const multiplier = sortInfo.direction === SortDirection.ascending ? 1 : -1
  let compare: (a: AnyAssetTreeNode, b: AnyAssetTreeNode) => number
  switch (sortInfo.field) {
    case Column.name: {
      compare = (a, b) =>
        multiplier * a.item.title.localeCompare(b.item.title, locale, { numeric: true })
      break
    }
    case Column.modified: {
      compare = (a, b) => {
        const aOrder = Number(new Date(a.item.modifiedAt))
        const bOrder = Number(new Date(b.item.modifiedAt))
        return multiplier * (aOrder - bOrder)
      }
      break
    }
  }
  return compare
}
