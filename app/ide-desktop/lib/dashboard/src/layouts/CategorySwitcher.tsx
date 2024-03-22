/** @file Switcher to choose the currently visible assets table category. */
import * as React from 'react'

import Home2Icon from 'enso-assets/home2.svg'
import RecentIcon from 'enso-assets/recent.svg'
import Trash2Icon from 'enso-assets/trash2.svg'

import * as localStorageProvider from '#/providers/LocalStorageProvider'
import * as modalProvider from '#/providers/ModalProvider'

import type * as assetEvent from '#/events/assetEvent'
import AssetEventType from '#/events/AssetEventType'

import Category from '#/layouts/CategorySwitcher/Category'

import * as aria from '#/components/aria'
import FocusArea from '#/components/styled/FocusArea'
import FocusRing from '#/components/styled/FocusRing'
import SvgMask from '#/components/SvgMask'

import * as drag from '#/utilities/drag'

// =============
// === Types ===
// =============

/** Metadata for a category. */
interface CategoryMetadata {
  readonly category: Category
  readonly icon: string
}

// =================
// === Constants ===
// =================

/** Sentinel object indicating that the header should be rendered. */
const HEADER_OBJECT = { isHeader: true }
const CATEGORIES: CategoryMetadata[] = [
  { category: Category.recent, icon: RecentIcon },
  { category: Category.home, icon: Home2Icon },
  { category: Category.trash, icon: Trash2Icon },
]

// ============================
// === CategorySwitcherItem ===
// ============================

/** Props for a {@link CategorySwitcherItem}. */
interface InternalCategorySwitcherItemProps {
  readonly id: string
  readonly data: CategoryMetadata
  readonly isCurrent: boolean
  readonly onPress: (event: aria.PressEvent) => void
  readonly onDragOver: (event: React.DragEvent) => void
  readonly onDrop: (event: React.DragEvent) => void
}

/** An entry in a {@link CategorySwitcher}. */
function CategorySwitcherItem(props: InternalCategorySwitcherItemProps) {
  const { data, isCurrent, onPress, onDragOver, onDrop } = props
  const { category, icon } = data

  return (
    <FocusRing within placement="after">
      <aria.MenuItem className="relative after:pointer-events-none after:absolute after:inset after:rounded-full after:transition-all">
        <aria.Button onPress={onPress}>
          <div
            title={`Go To ${category}`}
            className={`selectable ${
              isCurrent ? 'disabled bg-selected-frame active' : ''
            } group flex h-row items-center gap-icon-with-text rounded-full px-button-x hover:bg-selected-frame`}
            // Required because `dragover` does not fire on `mouseenter`.
            onDragEnter={onDragOver}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <SvgMask
              src={icon}
              className={
                // This explicit class is a special-case due to the unusual shape of the "Recent" icon.
                // eslint-disable-next-line no-restricted-syntax
                category === Category.recent ? '-ml-0.5' : ''
              }
            />
            <aria.Text slot="label">{category}</aria.Text>
          </div>
        </aria.Button>
      </aria.MenuItem>
    </FocusRing>
  )
}

// ========================
// === CategorySwitcher ===
// ========================

/** Props for a {@link CategorySwitcher}. */
export interface CategorySwitcherProps {
  readonly category: Category
  readonly setCategory: (category: Category) => void
  readonly dispatchAssetEvent: (directoryEvent: assetEvent.AssetEvent) => void
}

/** A switcher to choose the currently visible assets table category. */
export default function CategorySwitcher(props: CategorySwitcherProps) {
  const { category, setCategory, dispatchAssetEvent } = props
  const { unsetModal } = modalProvider.useSetModal()
  const { localStorage } = localStorageProvider.useLocalStorage()

  React.useEffect(() => {
    localStorage.set('driveCategory', category)
  }, [category, /* should never change */ localStorage])

  return (
    <FocusArea direction="vertical">
      {(ref, innerProps) => (
        <aria.Menu
          ref={ref}
          aria-label="Category switcher"
          className="flex w-full flex-col items-start"
          {...innerProps}
        >
          <aria.Section dependencies={[category]} items={[HEADER_OBJECT, ...CATEGORIES]}>
            {data =>
              'isHeader' in data ? (
                <aria.Header
                  id="header"
                  className="text-header mb-sidebar-section-heading-b px-sidebar-section-heading-x text-sm font-bold"
                >
                  Category
                </aria.Header>
              ) : (
                <CategorySwitcherItem
                  id={data.category}
                  data={data}
                  isCurrent={category === data.category}
                  onPress={() => {
                    setCategory(data.category)
                  }}
                  onDragOver={event => {
                    if (
                      (category === Category.trash && data.category === Category.home) ||
                      (category !== Category.trash && data.category === Category.trash)
                    ) {
                      event.preventDefault()
                    }
                  }}
                  onDrop={event => {
                    if (
                      (category === Category.trash && data.category === Category.home) ||
                      (category !== Category.trash && data.category === Category.trash)
                    ) {
                      event.preventDefault()
                      event.stopPropagation()
                      unsetModal()
                      const payload = drag.ASSET_ROWS.lookup(event)
                      if (payload != null) {
                        dispatchAssetEvent({
                          type:
                            category === Category.trash
                              ? AssetEventType.restore
                              : AssetEventType.delete,
                          ids: new Set(payload.map(item => item.key)),
                        })
                      }
                    }
                  }}
                />
              )
            }
          </aria.Section>
        </aria.Menu>
      )}
    </FocusArea>
  )
}
