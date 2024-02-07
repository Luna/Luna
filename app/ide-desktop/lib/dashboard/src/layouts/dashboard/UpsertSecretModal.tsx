/** @file Modal for confirming delete of any type of asset. */
import * as React from 'react'

import * as toastify from 'react-toastify'

import * as loggerProvider from '#/providers/LoggerProvider'
import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import Modal from '#/components/Modal'

import type * as backend from '#/services/Backend'

import * as errorModule from '#/utilities/error'

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
  const logger = loggerProvider.useLogger()
  const { unsetModal } = modalProvider.useSetModal()
  const { getText } = textProvider.useText()

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
      const message = errorModule.getMessageOrToString(error)
      toastify.toast.error(message)
      logger.error(message)
    }
  }

  return (
    <Modal centered className="bg-dim">
      <form
        data-testid="upsert-secret-modal"
        tabIndex={-1}
        className="relative flex flex-col gap-2 rounded-2xl w-96 p-4 pt-2 pointer-events-auto before:inset-0 before:absolute before:rounded-2xl before:bg-frame-selected before:backdrop-blur-3xl before:w-full before:h-full"
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
          // Consider not calling `onSubmit()` here to make it harder to accidentally
          // delete an important asset.
          onSubmit()
        }}
      >
        <h1 className="relative text-sm font-semibold">
          {isCreatingSecret ? getText('newSecret') : getText('editSecret')}
        </h1>
        <label className="relative flex">
          <div className="w-12 h-6 py-1">{getText('name')}</div>
          <input
            autoFocus
            disabled={!isNameEditable}
            placeholder={getText('secretNamePlaceholder')}
            className="grow bg-transparent border border-black/10 rounded-full leading-170 h-6 px-4 py-px disabled:opacity-50"
            value={name}
            onInput={event => {
              setName(event.currentTarget.value)
            }}
          />
        </label>
        <label className="relative flex">
          <div className="w-12 h-6 py-1">{getText('value')}</div>
          <input
            placeholder={getText('secretValuePlaceholder')}
            className="grow bg-transparent border border-black/10 rounded-full leading-170 h-6 px-4 py-px"
            onInput={event => {
              setValue(event.currentTarget.value)
            }}
          />
        </label>
        <div className="relative flex gap-2">
          <button
            disabled={!canSubmit}
            type="submit"
            className="hover:cursor-pointer inline-block text-white bg-invite rounded-full px-4 py-1 disabled:opacity-50 disabled:cursor-default"
          >
            {isCreatingSecret ? getText('create') : getText('update')}
          </button>
          <button
            type="button"
            className="hover:cursor-pointer inline-block bg-frame-selected rounded-full px-4 py-1"
            onClick={unsetModal}
          >
            {getText('cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
