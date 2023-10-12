/** @file Modal for confirming delete of any type of asset. */
import * as React from 'react'

import * as toastify from 'react-toastify'

import * as errorModule from '../../error'
import * as loggerProvider from '../../providers/logger'
import * as modalProvider from '../../providers/modal'
import Modal from './modal'

// ==========================
// === ConfirmDeleteModal ===
// ==========================

/** Props for a {@link ConfirmDeleteModal}. */
export interface ConfirmDeleteModalProps {
    /** Must fit in the sentence "Are you sure you want to delete <description>?". */
    description: string
    doDelete: () => void
}

/** A modal for confirming the deletion of an asset. */
export default function ConfirmDeleteModal(props: ConfirmDeleteModalProps) {
    const { description, doDelete } = props
    const logger = loggerProvider.useLogger()
    const { unsetModal } = modalProvider.useSetModal()

    const onSubmit = () => {
        unsetModal()
        try {
            doDelete()
        } catch (error) {
            const message = errorModule.getMessageOrToString(error)
            toastify.toast.error(message)
            logger.error(message)
        }
    }

    return (
        <Modal centered className="bg-dim">
            <div
                data-testid="confirm-delete-modal"
                ref={element => {
                    element?.focus()
                }}
                tabIndex={-1}
                className="pointer-events-auto relative rounded-2xl"
                onKeyDown={event => {
                    if (event.key !== 'Escape') {
                        event.stopPropagation()
                    }
                }}
            >
                <div className="absolute h-full w-full rounded-2xl bg-frame-selected backdrop-blur-3xl" />
                <form
                    onClick={event => {
                        event.stopPropagation()
                    }}
                    onSubmit={event => {
                        event.preventDefault()
                        // Consider not calling `onSubmit()` here to make it harder to accidentally
                        // delete an important asset.
                        onSubmit()
                    }}
                    className="relative flex w-96 flex-col gap-2 rounded-2xl p-2 px-4"
                >
                    <div>Are you sure you want to delete {description}?</div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="inline-block rounded-full bg-delete px-4 py-1 text-white hover:cursor-pointer"
                        >
                            Delete
                        </button>
                        <button
                            type="button"
                            className="inline-block rounded-full bg-frame-selected px-4 py-1 hover:cursor-pointer"
                            onClick={unsetModal}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    )
}
