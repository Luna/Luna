/** @file A column listing the labels on this asset. */
import * as React from 'react'

import Plus2Icon from 'enso-assets/plus2.svg'

import * as hooks from '#/hooks'
import * as categorySwitcherUtils from '#/layouts/dashboard/categorySwitcher/categorySwitcherUtils'
import ManageLabelsModal from '#/layouts/dashboard/manageLabelsModal'
import * as providers from '#/providers'
import type * as backendModule from '#/services/backend'
import * as permissions from '#/util/permissions'
import * as shortcuts from '#/util/shortcuts'
import * as uniqueString from '#/util/uniqueString'

import ContextMenu from '#/components/contextMenu'
import ContextMenus from '#/components/contextMenus'
import type * as column from '#/components/dashboard/column'
import Label from '#/components/dashboard/label'
import * as labelUtils from '#/components/dashboard/label/labelUtils'
import MenuEntry from '#/components/menuEntry'

// ====================
// === LabelsColumn ===
// ====================

/** A column listing the labels on this asset. */
export default function LabelsColumn(props: column.AssetColumnProps) {
    const {
        item: { item: asset },
        setItem,
        state: { category, labels, setQuery, deletedLabelNames, doCreateLabel },
        rowState: { temporarilyAddedLabels, temporarilyRemovedLabels },
    } = props
    const session = providers.useNonPartialUserSession()
    const { setModal, unsetModal } = providers.useSetModal()
    const { backend } = providers.useBackend()
    const toastAndLog = hooks.useToastAndLog()
    const [isHovered, setIsHovered] = React.useState(false)
    const self = asset.permissions?.find(
        permission => permission.user.user_email === session.organization?.email
    )
    const managesThisAsset =
        category !== categorySwitcherUtils.Category.trash &&
        (self?.permission === permissions.PermissionAction.own ||
            self?.permission === permissions.PermissionAction.admin)
    const setAsset = React.useCallback(
        (valueOrUpdater: React.SetStateAction<backendModule.AnyAsset>) => {
            if (typeof valueOrUpdater === 'function') {
                setItem(oldItem => ({
                    ...oldItem,
                    item: valueOrUpdater(oldItem.item),
                }))
            } else {
                setItem(oldItem => ({ ...oldItem, item: valueOrUpdater }))
            }
        },
        [/* should never change */ setItem]
    )
    return (
        <div
            className="flex items-center gap-1"
            onMouseEnter={() => {
                setIsHovered(true)
            }}
            onMouseLeave={() => {
                setIsHovered(false)
            }}
        >
            {(asset.labels ?? [])
                .filter(label => !deletedLabelNames.has(label))
                .map(label => (
                    <Label
                        key={label}
                        color={labels.get(label)?.color ?? labelUtils.DEFAULT_LABEL_COLOR}
                        active={!temporarilyRemovedLabels.has(label)}
                        disabled={temporarilyRemovedLabels.has(label)}
                        className={
                            temporarilyRemovedLabels.has(label)
                                ? 'relative before:absolute before:rounded-full before:border-2 before:border-delete before:inset-0 before:w-full before:h-full'
                                : ''
                        }
                        onContextMenu={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            const doDelete = () => {
                                unsetModal()
                                setAsset(oldAsset => {
                                    const newLabels =
                                        oldAsset.labels?.filter(oldLabel => oldLabel !== label) ??
                                        []
                                    void backend
                                        .associateTag(asset.id, newLabels, asset.title)
                                        .catch(error => {
                                            toastAndLog(null, error)
                                            setAsset(oldAsset2 =>
                                                oldAsset2.labels?.some(
                                                    oldLabel => oldLabel === label
                                                ) === true
                                                    ? oldAsset2
                                                    : {
                                                          ...oldAsset2,
                                                          labels: [
                                                              ...(oldAsset2.labels ?? []),
                                                              label,
                                                          ],
                                                      }
                                            )
                                        })
                                    return {
                                        ...oldAsset,
                                        labels: newLabels,
                                    }
                                })
                            }
                            setModal(
                                <ContextMenus key={`label-${label}`} event={event}>
                                    <ContextMenu>
                                        <MenuEntry
                                            action={shortcuts.KeyboardAction.delete}
                                            doAction={doDelete}
                                        />
                                    </ContextMenu>
                                </ContextMenus>
                            )
                        }}
                        onClick={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            setQuery(oldQuery =>
                                oldQuery.labels.includes(label)
                                    ? oldQuery.delete({ labels: [label] })
                                    : oldQuery.add({ labels: [label] })
                            )
                        }}
                    >
                        {label}
                    </Label>
                ))}
            {...[...temporarilyAddedLabels]
                .filter(label => asset.labels?.includes(label) !== true)
                .map(label => (
                    <Label
                        disabled
                        key={label}
                        color={labels.get(label)?.color ?? labelUtils.DEFAULT_LABEL_COLOR}
                        className="pointer-events-none"
                        onClick={() => {}}
                    >
                        {label}
                    </Label>
                ))}
            {managesThisAsset && (
                <button
                    className={`h-4 w-4 ${isHovered ? '' : 'invisible pointer-events-none'}`}
                    onClick={event => {
                        event.stopPropagation()
                        setModal(
                            <ManageLabelsModal
                                key={uniqueString.uniqueString()}
                                item={asset}
                                setItem={setAsset}
                                allLabels={labels}
                                doCreateLabel={doCreateLabel}
                                eventTarget={event.currentTarget}
                            />
                        )
                    }}
                >
                    <img className="w-4.5 h-4.5" src={Plus2Icon} />
                </button>
            )}
        </div>
    )
}
