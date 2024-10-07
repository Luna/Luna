/** @file A modal to select labels for an asset. */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import { useMutation } from '@tanstack/react-query'

import { Heading, Text } from '#/components/aria'
import { Button, ButtonGroup, Input } from '#/components/AriaComponents'
import ColorPicker from '#/components/ColorPicker'
import Label from '#/components/dashboard/Label'
import Modal from '#/components/Modal'
import FocusArea from '#/components/styled/FocusArea'
import FocusRing from '#/components/styled/FocusRing'
import { backendMutationOptions, useBackendQuery } from '#/hooks/backendHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import {
  findLeastUsedColor,
  LabelName,
  lChColorToCssColor,
  type AnyAsset,
  type LChColor,
} from '#/services/Backend'
import { submitForm } from '#/utilities/event'
import { merge } from '#/utilities/object'
import { regexEscape } from '#/utilities/string'
import { twMerge } from '#/utilities/tailwindMerge'

// =================
// === Constants ===
// =================

/** The maximum lightness at which a color is still considered dark. */
const MAXIMUM_DARK_LIGHTNESS = 50

// =========================
// === ManageLabelsModal ===
// =========================

/** Props for a {@link ManageLabelsModal}. */
export interface ManageLabelsModalProps<Asset extends AnyAsset = AnyAsset> {
  readonly backend: Backend
  readonly item: Asset
  readonly setItem: Dispatch<SetStateAction<Asset>>
  /** If this is `null`, this modal will be centered. */
  readonly eventTarget: HTMLElement | null
}

/** A modal to select labels for an asset.
 * @throws {Error} when the current backend is the local backend, or when the user is offline.
 * This should never happen, as this modal should not be accessible in either case. */
export default function ManageLabelsModal<Asset extends AnyAsset = AnyAsset>(
  props: ManageLabelsModalProps<Asset>,
) {
  const { backend, item, setItem, eventTarget } = props
  const { unsetModal } = useSetModal()
  const { getText } = useText()
  const toastAndLog = useToastAndLog()
  const { data: allLabels } = useBackendQuery(backend, 'listTags', [])
  const [labels, setLabelsRaw] = useState(item.labels ?? [])
  const [query, setQuery] = useState('')
  const [color, setColor] = useState<LChColor | null>(null)
  const leastUsedColor = useMemo(() => findLeastUsedColor(allLabels ?? []), [allLabels])
  const position = useMemo(() => eventTarget?.getBoundingClientRect(), [eventTarget])
  const labelNames = useMemo(() => new Set(labels), [labels])
  const regex = useMemo(() => new RegExp(regexEscape(query), 'i'), [query])
  const canSelectColor = useMemo(
    () => query !== '' && (allLabels ?? []).filter((label) => regex.test(label.value)).length === 0,
    [allLabels, query, regex],
  )
  const canCreateNewLabel = canSelectColor

  const createTag = useMutation(backendMutationOptions(backend, 'createTag')).mutateAsync
  const associateTag = useMutation(backendMutationOptions(backend, 'associateTag')).mutateAsync

  const setLabels = useCallback(
    (valueOrUpdater: SetStateAction<readonly LabelName[]>) => {
      setLabelsRaw(valueOrUpdater)
      setItem((oldItem) =>
        // This is SAFE, as the type of asset is not being changed.
        // eslint-disable-next-line no-restricted-syntax
        merge(oldItem, {
          labels:
            typeof valueOrUpdater !== 'function' ? valueOrUpdater : (
              valueOrUpdater(oldItem.labels ?? [])
            ),
        } as Partial<Asset>),
      )
    },
    [setItem],
  )

  const doToggleLabel = async (name: LabelName) => {
    const newLabels =
      labelNames.has(name) ? labels.filter((label) => label !== name) : [...labels, name]
    setLabels(newLabels)
    try {
      await associateTag([item.id, newLabels, item.title])
    } catch (error) {
      toastAndLog(null, error)
      setLabels(labels)
    }
  }

  const doSubmit = async () => {
    unsetModal()
    const labelName = LabelName(query)
    setLabels((oldLabels) => [...oldLabels, labelName])
    try {
      await createTag([{ value: labelName, color: color ?? leastUsedColor }])
      setLabels((newLabels) => {
        void associateTag([item.id, newLabels, item.title])
        return newLabels
      })
    } catch (error) {
      toastAndLog(null, error)
      setLabels((oldLabels) => oldLabels.filter((oldLabel) => oldLabel !== query))
    }
  }

  return (
    <Modal
      centered={eventTarget == null}
      className="absolute left top z-1 size-full overflow-hidden bg-dim"
    >
      <div
        tabIndex={-1}
        style={
          position != null ?
            {
              left: position.left + window.scrollX,
              top: position.top + window.scrollY,
            }
          : {}
        }
        className="sticky w-manage-labels-modal"
        onClick={(mouseEvent) => {
          mouseEvent.stopPropagation()
        }}
        onContextMenu={(mouseEvent) => {
          mouseEvent.stopPropagation()
          mouseEvent.preventDefault()
        }}
      >
        <div className="absolute h-full w-full rounded-default bg-selected-frame backdrop-blur-default" />
        <form
          className="relative flex flex-col gap-modal rounded-default p-modal"
          onSubmit={(event) => {
            event.preventDefault()
            void doSubmit()
          }}
        >
          <Heading level={2} className="flex h-row items-center gap-modal-tabs px-modal-tab-bar-x">
            <Text className="text text-sm font-bold">{getText('labels')}</Text>
          </Heading>
          {
            <FocusArea direction="horizontal">
              {(innerProps) => (
                <ButtonGroup className="relative" {...innerProps}>
                  <FocusRing within>
                    <div
                      className={twMerge(
                        'flex grow items-center rounded-full border border-primary/10 px-input-x',
                        (
                          canSelectColor &&
                            color != null &&
                            color.lightness <= MAXIMUM_DARK_LIGHTNESS
                        ) ?
                          'text-tag-text placeholder-tag-text'
                        : 'text-primary',
                      )}
                      style={
                        !canSelectColor || color == null ?
                          {}
                        : {
                            backgroundColor: lChColorToCssColor(color),
                          }
                      }
                    >
                      <Input
                        name="search-labels"
                        autoFocus
                        type="text"
                        size="custom"
                        placeholder={getText('labelSearchPlaceholder')}
                        className="text grow bg-transparent"
                        onChange={(event) => {
                          setQuery(event.currentTarget.value)
                        }}
                      />
                    </div>
                  </FocusRing>
                  <Button variant="submit" isDisabled={!canCreateNewLabel} onPress={submitForm}>
                    {getText('create')}
                  </Button>
                </ButtonGroup>
              )}
            </FocusArea>
          }
          {canSelectColor && (
            <div className="mx-auto">
              <ColorPicker setColor={setColor} />
            </div>
          )}
          <FocusArea direction="vertical">
            {(innerProps) => (
              <div className="max-h-manage-labels-list overflow-auto" {...innerProps}>
                {(allLabels ?? [])
                  .filter((label) => regex.test(label.value))
                  .map((label) => (
                    <div key={label.id} className="flex h-row items-center">
                      <Label
                        active={labels.includes(label.value)}
                        color={label.color}
                        onPress={() => {
                          void doToggleLabel(label.value)
                        }}
                      >
                        {label.value}
                      </Label>
                    </div>
                  ))}
              </div>
            )}
          </FocusArea>
        </form>
      </div>
    </Modal>
  )
}
