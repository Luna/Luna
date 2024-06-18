/** @file Modal for confirming delete of any type of asset. */
import * as React from 'react'

import * as tailwindMerge from 'tailwind-merge'

import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import Modal from '#/components/Modal'
import ButtonRow from '#/components/styled/ButtonRow'

// ==========================
// === ConfirmDeleteModal ===
// ==========================

/** Props for a {@link ConfirmDeleteModal}. */
export interface ConfirmDeleteModalProps {
  readonly event?: Pick<React.MouseEvent, 'pageX' | 'pageY'>
  /** Must fit in the sentence "Are you sure you want to <action>?". */
  readonly actionText: string
  /** The label shown on the colored confirmation button. "Delete" by default. */
  readonly actionButtonLabel?: string
  readonly doDelete: () => void
}

/** A modal for confirming the deletion of an asset. */
export default function ConfirmDeleteModal(props: ConfirmDeleteModalProps) {
  const { actionText, actionButtonLabel = 'Delete', event: positionEvent, doDelete } = props
  const { getText } = textProvider.useText()
  const { unsetModal } = modalProvider.useSetModal()
  const toastAndLog = toastAndLogHooks.useToastAndLog()

  const doSubmit = () => {
    unsetModal()
    try {
      doDelete()
    } catch (error) {
      toastAndLog(null, error)
    }
  }

  return (
    <Modal
      centered={positionEvent == null}
      className={tailwindMerge.twMerge(
        'bg-dim',
        positionEvent != null && 'absolute size-full overflow-hidden'
      )}
    >
      <form
        data-testid="confirm-delete-modal"
        ref={element => {
          element?.focus()
        }}
        tabIndex={-1}
        className="pointer-events-auto relative flex w-confirm-delete-modal flex-col gap-modal rounded-default p-modal-wide py-modal before:absolute before:inset before:h-full before:w-full before:rounded-default before:bg-selected-frame before:backdrop-blur-default"
        style={positionEvent == null ? {} : { left: positionEvent.pageX, top: positionEvent.pageY }}
        onClick={event => {
          event.stopPropagation()
        }}
        onSubmit={event => {
          event.preventDefault()
          doSubmit()
        }}
      >
        <aria.Text className="relative">{getText('confirmPrompt', actionText)}</aria.Text>
        <ButtonRow>
          <ariaComponents.Button
            size="custom"
            variant="custom"
            className="button bg-delete text-white active"
            onPress={doSubmit}
          >
            {actionButtonLabel}
          </ariaComponents.Button>
          <ariaComponents.Button
            size="custom"
            variant="custom"
            autoFocus
            className="button bg-selected-frame active"
            onPress={unsetModal}
          >
            {getText('cancel')}
          </ariaComponents.Button>
        </ButtonRow>
      </form>
    </Modal>
  )
}
