/** @file A list of selectable labels. */
import type { Dispatch, SetStateAction } from 'react'

import { useMutation } from '@tanstack/react-query'

import type { Backend } from 'enso-common/src/services/Backend'
import { shallowEqual } from 'enso-common/src/utilities/data/array'

import PlusIcon from '#/assets/plus.svg'
import Trash2Icon from '#/assets/trash2.svg'
import { Button, DialogTrigger, Text } from '#/components/AriaComponents'
import Label from '#/components/dashboard/Label'
import FocusArea from '#/components/styled/FocusArea'
import FocusRing from '#/components/styled/FocusRing'
import { backendMutationOptions, useBackendQuery } from '#/hooks/backendHooks'
import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'
import DragModal from '#/modals/DragModal'
import NewLabelModal from '#/modals/NewLabelModal'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import type AssetQuery from '#/utilities/AssetQuery'
import { LABELS, setDragImageToBlank, type LabelsDragPayload } from '#/utilities/drag'

/** Props for a {@link Labels}. */
export interface LabelsProps {
  readonly backend: Backend
  readonly draggable: boolean
  readonly query: AssetQuery
  readonly setQuery: Dispatch<SetStateAction<AssetQuery>>
}

/** A list of selectable labels. */
export default function Labels(props: LabelsProps) {
  const { backend, query, setQuery, draggable = true } = props
  const currentLabels = query.labels
  const currentNegativeLabels = query.negativeLabels
  const { setModal } = useSetModal()
  const { getText } = useText()
  const labels = useBackendQuery(backend, 'listTags', []).data ?? []
  const deleteTag = useMutation(backendMutationOptions(backend, 'deleteTag')).mutate

  return (
    <FocusArea direction="vertical">
      {(innerProps) => (
        <div className="flex flex-1 flex-col overflow-auto">
          <div
            data-testid="labels"
            className="flex flex-col items-start gap-4 overflow-auto"
            {...innerProps}
          >
            <Text variant="subtitle" className="px-2 font-bold">
              {getText('labels')}
            </Text>
            <div
              data-testid="labels-list"
              aria-label={getText('labelsListLabel')}
              className="flex flex-1 flex-col items-start gap-labels overflow-auto"
            >
              {labels.map((label) => {
                const negated = currentNegativeLabels.some((term) =>
                  shallowEqual(term, [label.value]),
                )
                return (
                  <div key={label.id} className="group relative flex items-center gap-label-icons">
                    <Label
                      draggable={draggable}
                      color={label.color}
                      active={
                        negated || currentLabels.some((term) => shallowEqual(term, [label.value]))
                      }
                      negated={negated}
                      onPress={(event) => {
                        setQuery((oldQuery) =>
                          oldQuery.withToggled(
                            'labels',
                            'negativeLabels',
                            label.value,
                            event.shiftKey,
                          ),
                        )
                      }}
                      onDragStart={(event) => {
                        setDragImageToBlank(event)
                        const payload: LabelsDragPayload = new Set([label.value])
                        LABELS.bind(event, payload)
                        setModal(
                          <DragModal
                            event={event}
                            onDragEnd={() => {
                              LABELS.unbind(payload)
                            }}
                          >
                            <Label active color={label.color} onPress={() => {}}>
                              {label.value}
                            </Label>
                          </DragModal>,
                        )
                      }}
                    >
                      {label.value}
                    </Label>
                    <FocusRing placement="after">
                      <DialogTrigger>
                        <Button
                          variant="icon"
                          icon={Trash2Icon}
                          extraClickZone={false}
                          aria-label={getText('delete')}
                          tooltipPlacement="right"
                          className="relative flex size-4 text-delete opacity-0 transition-all after:absolute after:-inset-1 after:rounded-button-focus-ring group-has-[[data-focus-visible]]:active group-hover:active"
                        />
                        <ConfirmDeleteModal
                          actionText={getText('deleteLabelActionText', label.value)}
                          doDelete={() => {
                            deleteTag([label.id, label.value])
                          }}
                        />
                      </DialogTrigger>
                    </FocusRing>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogTrigger>
            <Button
              size="xsmall"
              variant="outline"
              className="mt-1 self-start pl-1 pr-2"
              icon={PlusIcon}
            >
              {getText('newLabelButtonLabel')}
            </Button>
            <NewLabelModal backend={backend} />
          </DialogTrigger>
        </div>
      )}
    </FocusArea>
  )
}
