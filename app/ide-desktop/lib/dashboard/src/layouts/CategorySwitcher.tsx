/** @file Switcher to choose the currently visible assets table category. */
import * as React from 'react'

import * as tailwindMerge from 'tailwind-merge'

import CloudIcon from 'enso-assets/cloud.svg'
import NotCloudIcon from 'enso-assets/not_cloud.svg'
import RecentIcon from 'enso-assets/recent.svg'
import Trash2Icon from 'enso-assets/trash2.svg'

import type * as text from '#/text'

import * as mimeTypes from '#/data/mimeTypes'

import * as backendProvider from '#/providers/BackendProvider'
import * as localStorageProvider from '#/providers/LocalStorageProvider'
import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import type * as assetEvent from '#/events/assetEvent'
import AssetEventType from '#/events/AssetEventType'

import Category from '#/layouts/CategorySwitcher/Category'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import FocusArea from '#/components/styled/FocusArea'
import SvgMask from '#/components/SvgMask'

import type * as backend from '#/services/Backend'

// =============
// === Types ===
// =============

/** Metadata for a category. */
interface CategoryMetadata {
  readonly category: Category
  readonly icon: string
  readonly textId: Extract<text.TextId, `${Category}Category`>
  readonly buttonTextId: Extract<text.TextId, `${Category}CategoryButtonLabel`>
  readonly dropZoneTextId: Extract<text.TextId, `${Category}CategoryDropZoneLabel`>
}

// =================
// === Constants ===
// =================

const CATEGORY_DATA: readonly CategoryMetadata[] = [
  {
    category: Category.cloud,
    icon: CloudIcon,
    textId: 'cloudCategory',
    buttonTextId: 'cloudCategoryButtonLabel',
    dropZoneTextId: 'cloudCategoryDropZoneLabel',
  },
  {
    category: Category.local,
    icon: NotCloudIcon,
    textId: 'localCategory',
    buttonTextId: 'localCategoryButtonLabel',
    dropZoneTextId: 'localCategoryDropZoneLabel',
  },
  {
    category: Category.recent,
    icon: RecentIcon,
    textId: 'recentCategory',
    buttonTextId: 'recentCategoryButtonLabel',
    dropZoneTextId: 'recentCategoryDropZoneLabel',
  },
  {
    category: Category.trash,
    icon: Trash2Icon,
    textId: 'trashCategory',
    buttonTextId: 'trashCategoryButtonLabel',
    dropZoneTextId: 'trashCategoryDropZoneLabel',
  },
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
  readonly acceptedDragTypes: string[]
  readonly onDrop: (event: aria.DropEvent) => void
}

/** An entry in a {@link CategorySwitcher}. */
function CategorySwitcherItem(props: InternalCategorySwitcherItemProps) {
  const { data, isCurrent, onPress, acceptedDragTypes, onDrop } = props
  const { category, icon, textId, buttonTextId, dropZoneTextId } = data
  const { getText } = textProvider.useText()

  return (
    <aria.DropZone
      aria-label={getText(dropZoneTextId)}
      getDropOperation={types =>
        acceptedDragTypes.some(type => types.has(type)) ? 'move' : 'cancel'
      }
      className="group relative flex items-center rounded-full drop-target-after"
      onDrop={onDrop}
    >
      <ariaComponents.Button
        size="custom"
        variant="custom"
        tooltip={false}
        className={tailwindMerge.twMerge('rounded-full', isCurrent && 'focus-default')}
        aria-label={getText(buttonTextId)}
        onPress={onPress}
      >
        <div
          className={tailwindMerge.twMerge(
            'group flex h-row items-center gap-icon-with-text rounded-full px-button-x selectable',
            isCurrent ? 'disabled active' : 'hover:bg-selected-frame'
          )}
        >
          <SvgMask
            src={icon}
            className={
              // This explicit class is a special-case due to the unusual shape of the "Recent" icon.
              // eslint-disable-next-line no-restricted-syntax
              category === Category.recent ? '-ml-0.5' : ''
            }
          />
          <aria.Text slot="description">{getText(textId)}</aria.Text>
        </div>
      </ariaComponents.Button>
      <div className="absolute left-full ml-2 hidden group-focus-visible:block">
        {getText('drop')}
      </div>
    </aria.DropZone>
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
  const { category, setCategory } = props
  const { dispatchAssetEvent } = props
  const { unsetModal } = modalProvider.useSetModal()
  const { localStorage } = localStorageProvider.useLocalStorage()
  const { getText } = textProvider.useText()
  const remoteBackend = backendProvider.useRemoteBackend()
  const localBackend = backendProvider.useLocalBackend()
  const categoryData = React.useMemo(
    () =>
      CATEGORY_DATA.filter(data => {
        switch (data.category) {
          case Category.local: {
            return localBackend != null
          }
          default: {
            return remoteBackend != null
          }
        }
      }),
    [remoteBackend, localBackend]
  )

  React.useEffect(() => {
    localStorage.set('driveCategory', category)
  }, [category, /* should never change */ localStorage])

  return (
    <FocusArea direction="vertical">
      {innerProps => (
        <div className="flex w-full flex-col" {...innerProps}>
          <aria.Header
            id="header"
            className="text-header mb-sidebar-section-heading-b px-sidebar-section-heading-x text-sm font-bold"
          >
            {getText('category')}
          </aria.Header>
          <div
            aria-label={getText('categorySwitcherMenuLabel')}
            role="grid"
            className="flex flex-col items-start"
          >
            {categoryData.map(data => (
              <CategorySwitcherItem
                key={data.category}
                id={data.category}
                data={data}
                isCurrent={category === data.category}
                onPress={() => {
                  setCategory(data.category)
                }}
                acceptedDragTypes={
                  (category === Category.trash &&
                    (data.category === Category.cloud || data.category === Category.local)) ||
                  (category !== Category.trash && data.category === Category.trash)
                    ? [mimeTypes.ASSETS_MIME_TYPE]
                    : []
                }
                onDrop={event => {
                  unsetModal()
                  void Promise.all(
                    event.items.flatMap(async item => {
                      if (item.kind === 'text') {
                        const text = await item.getText(mimeTypes.ASSETS_MIME_TYPE)
                        const payload: unknown = JSON.parse(text)
                        return Array.isArray(payload)
                          ? payload.flatMap(key =>
                              // This is SAFE, assuming only this app creates payloads with
                              // the specific mimetype above.
                              // eslint-disable-next-line no-restricted-syntax
                              typeof key === 'string' ? [key as backend.AssetId] : []
                            )
                          : []
                      } else {
                        return []
                      }
                    })
                  ).then(keys => {
                    dispatchAssetEvent({
                      type:
                        category === Category.trash
                          ? AssetEventType.restore
                          : AssetEventType.delete,
                      ids: new Set(keys.flat(1)),
                    })
                  })
                }}
              />
            ))}
          </div>
        </div>
      )}
    </FocusArea>
  )
}
