/** @file Modal for confirming delete of any type of asset. */
import * as React from 'react'

import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as modalProvider from '#/providers/ModalProvider'

import Modal from '#/components/Modal'

import type * as backend from '#/services/Backend'

// =========================
// === UpsertSecretModal ===
// =========================

/** Props for a {@link UpsertSecretModal}. */
export interface UpsertSecretModalProps {
  readonly id: backend.SecretId | null
  readonly name: string | null
  readonly doCreate: (name: string, value: string) => void
}

/** A modal for creating and editing a secret. */
export default function UpsertSecretModal(props: UpsertSecretModalProps) {
  const { id, name: nameRaw, doCreate } = props
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const { unsetModal } = modalProvider.useSetModal()

  const [name, setName] = React.useState(nameRaw ?? '')
  const [value, setValue] = React.useState('')
  const isCreatingSecret = id == null
  const isNameEditable = nameRaw == null
  const canSubmit = Boolean(name && value)

  const onSubmit = () => {
    unsetModal()
    try {
      doCreate(name, value)
    } catch (error) {
      toastAndLog(null, error)
    }
  }

  return (
    <Modal centered className="bg-dim">
      <form
        data-testid="upsert-secret-modal"
        tabIndex={-1}
        className="relative flex flex-col gap-2 rounded-default w-96 p-4 pt-2 pointer-events-auto before:inset before:absolute before:rounded-default before:bg-selected-frame before:backdrop-blur-default before:w-full before:h-full"
        onKeyDown={event => {
          if (event.key !== 'Escape') {
            event.stopPropagation()
          }
        }}
        onClick={event => {
          event.stopPropagation()
        }}
        onSubmit={event => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <h1 className="relative text-sm font-semibold">
          {isCreatingSecret ? 'New Secret' : 'Edit Secret'}
        </h1>
        <label className="relative flex">
          <div className="w-12 h-6 py-1">Name</div>
          <input
            autoFocus
            disabled={!isNameEditable}
            placeholder="Enter the name of the secret"
            className="grow bg-transparent border border-black/10 rounded-full leading-cozy h-6 px-4 py-px disabled:opacity-disabled"
            value={name}
            onInput={event => {
              setName(event.currentTarget.value)
            }}
          />
        </label>
        <label className="relative flex">
          <div className="w-12 h-6 py-1">Value</div>
          <input
            autoFocus={!isNameEditable}
            placeholder="Enter the value of the secret"
            className="grow bg-transparent border border-black/10 rounded-full leading-cozy h-6 px-4 py-px"
            onInput={event => {
              setValue(event.currentTarget.value)
            }}
          />
        </label>
        <div className="relative flex gap-2">
          <button disabled={!canSubmit} type="submit" className="button text-white bg-invite">
            {isCreatingSecret ? 'Create' : 'Update'}
          </button>
          <button type="button" className="button bg-selected-frame" onClick={unsetModal}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
