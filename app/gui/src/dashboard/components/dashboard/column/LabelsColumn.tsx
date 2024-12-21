/** @file A column listing the labels on this asset. */
import { useMemo } from 'react'

import { COLORS } from '@common/services/Backend'

import Plus2Icon from '#/assets/plus2.svg'
import { Button, DialogTrigger } from '#/components/AriaComponents'
import ContextMenu from '#/components/ContextMenu'
import type { AssetColumnProps } from '#/components/dashboard/column'
import Label from '#/components/dashboard/Label'
import MenuEntry from '#/components/MenuEntry'
import { useBackendQuery } from '#/hooks/backendHooks'
import ManageLabelsModal from '#/modals/ManageLabelsModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import { PermissionAction, tryFindSelfPermission } from '#/utilities/permissions'

/** A column listing the labels on this asset. */
export default function LabelsColumn(props: AssetColumnProps) {
  const { item, state, rowState } = props
  const { backend, category, setQuery } = state
  const { temporarilyAddedLabels, temporarilyRemovedLabels } = rowState
  const { user } = useFullUserSession()
  const { setModal, unsetModal } = useSetModal()
  const { getText } = useText()
  const { data: labels } = useBackendQuery(backend, 'listTags', [])
  const labelsByName = useMemo(() => {
    return new Map(labels?.map((label) => [label.value, label]))
  }, [labels])
  const self = tryFindSelfPermission(user, item.permissions)
  const managesThisAsset =
    category.type !== 'trash' &&
    (self?.permission === PermissionAction.own || self?.permission === PermissionAction.admin)

  return (
    <div className="group flex items-center gap-column-items contain-strict [contain-intrinsic-size:37px] [content-visibility:auto]">
      {(item.labels ?? [])
        .filter((label) => labelsByName.has(label))
        .map((label) => (
          <Label
            key={label}
            data-testid="asset-label"
            title={getText('rightClickToRemoveLabel')}
            color={labelsByName.get(label)?.color ?? COLORS[0]}
            active={!temporarilyRemovedLabels.has(label)}
            isDisabled={temporarilyRemovedLabels.has(label)}
            negated={temporarilyRemovedLabels.has(label)}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const doDelete = () => {
                unsetModal()
                const newLabels = item.labels?.filter((oldLabel) => oldLabel !== label) ?? []
                void backend.associateTag(item.id, newLabels, item.title)
              }
              setModal(
                <ContextMenu aria-label={getText('labelContextMenuLabel')} event={event}>
                  <MenuEntry
                    action="delete"
                    label={getText('deleteLabelShortcut')}
                    doAction={doDelete}
                  />
                </ContextMenu>,
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
        .filter((label) => item.labels?.includes(label) !== true)
        .map((label) => (
          <Label isDisabled key={label} color={labelsByName.get(label)?.color ?? COLORS[0]}>
            {label}
          </Label>
        ))}
      {managesThisAsset && (
        <DialogTrigger>
          <Button variant="ghost" showIconOnHover icon={Plus2Icon} />
          <ManageLabelsModal backend={backend} item={item} />
        </DialogTrigger>
      )}
    </div>
  )
}
