/** @file A column listing the labels on this asset. */
import * as React from 'react'

import Plus2Icon from '#/assets/plus2.svg'

import * as backendHooks from '#/hooks/backendHooks'
import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as authProvider from '#/providers/AuthProvider'
import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import Category from '#/layouts/CategorySwitcher/Category'

import * as ariaComponents from '#/components/AriaComponents'
import ContextMenu from '#/components/ContextMenu'
import ContextMenus from '#/components/ContextMenus'
import type * as column from '#/components/dashboard/column'
import Label from '#/components/dashboard/Label'
import MenuEntry from '#/components/MenuEntry'

import ManageLabelsModal from '#/modals/ManageLabelsModal'

import * as backendModule from '#/services/Backend'

import * as object from '#/utilities/object'
import * as permissions from '#/utilities/permissions'
import * as uniqueString from '#/utilities/uniqueString'

// ====================
// === LabelsColumn ===
// ====================

/** A column listing the labels on this asset. */
export default function LabelsColumn(props: column.AssetColumnProps) {
  const { item, setItem, state, rowState } = props
  const { backend, category, setQuery } = state
  const { temporarilyAddedLabels, temporarilyRemovedLabels } = rowState
  const asset = item.item
  const { user } = authProvider.useNonPartialUserSession()
  const { setModal, unsetModal } = modalProvider.useSetModal()
  const { getText } = textProvider.useText()
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const labels = backendHooks.useBackendListTags(backend)
  const labelsByName = React.useMemo(() => {
    return new Map(labels?.map((label) => [label.value, label]))
  }, [labels])
  const plusButtonRef = React.useRef<HTMLButtonElement>(null)
  const self = asset.permissions?.find(
    backendModule.isUserPermissionAnd((permission) => permission.user.userId === user.userId),
  )
  const managesThisAsset =
    category !== Category.trash &&
    (self?.permission === permissions.PermissionAction.own ||
      self?.permission === permissions.PermissionAction.admin)
  const setAsset = React.useCallback(
    (valueOrUpdater: React.SetStateAction<backendModule.AnyAsset>) => {
      setItem((oldItem) =>
        oldItem.with({
          item:
            typeof valueOrUpdater !== 'function' ? valueOrUpdater : valueOrUpdater(oldItem.item),
        }),
      )
    },
    [setItem],
  )

  return (
    <div className="group flex items-center gap-column-items">
      {(asset.labels ?? [])
        .filter((label) => labelsByName.has(label))
        .map((label) => (
          <Label
            key={label}
            data-testid="asset-label"
            title={getText('rightClickToRemoveLabel')}
            color={labelsByName.get(label)?.color ?? backendModule.COLORS[0]}
            active={!temporarilyRemovedLabels.has(label)}
            isDisabled={temporarilyRemovedLabels.has(label)}
            negated={temporarilyRemovedLabels.has(label)}
            className={
              temporarilyRemovedLabels.has(label) ?
                'relative before:absolute before:inset before:h-full before:w-full before:rounded-full before:border-2 before:border-delete'
              : ''
            }
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const doDelete = () => {
                unsetModal()
                setAsset((oldAsset) => {
                  const newLabels = oldAsset.labels?.filter((oldLabel) => oldLabel !== label) ?? []
                  void backend
                    .associateTag(asset.id, newLabels, asset.title)
                    .catch((error: unknown) => {
                      toastAndLog(null, error)
                      setAsset((oldAsset2) =>
                        oldAsset2.labels?.some((oldLabel) => oldLabel === label) === true ?
                          oldAsset2
                        : object.merge(oldAsset2, {
                            labels: [...(oldAsset2.labels ?? []), label],
                          }),
                      )
                    })
                  return object.merge(oldAsset, { labels: newLabels })
                })
              }
              setModal(
                <ContextMenus key={`label-${label}`} event={event}>
                  <ContextMenu aria-label={getText('labelContextMenuLabel')}>
                    <MenuEntry
                      action="delete"
                      label={getText('deleteLabelShortcut')}
                      doAction={doDelete}
                    />
                  </ContextMenu>
                </ContextMenus>,
              )
            }}
            onPress={(event) => {
              setQuery((oldQuery) =>
                oldQuery.withToggled('labels', 'negativeLabels', label, event.shiftKey),
              )
            }}
          >
            {label}
          </Label>
        ))}
      {...[...temporarilyAddedLabels]
        .filter((label) => asset.labels?.includes(label) !== true)
        .map((label) => (
          <Label
            isDisabled
            key={label}
            color={labelsByName.get(label)?.color ?? backendModule.COLORS[0]}
            className="pointer-events-none"
            onPress={() => {}}
          >
            {label}
          </Label>
        ))}
      {managesThisAsset && (
        <ariaComponents.Button
          ref={plusButtonRef}
          size="medium"
          variant="ghost"
          showIconOnHover
          icon={Plus2Icon}
          onPress={() => {
            setModal(
              <ManageLabelsModal
                key={uniqueString.uniqueString()}
                backend={backend}
                item={asset}
                setItem={setAsset}
                eventTarget={plusButtonRef.current}
              />,
            )
          }}
        />
      )}
    </div>
  )
}
