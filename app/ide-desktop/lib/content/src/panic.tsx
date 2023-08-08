/** @file This file defines a component that is responsible for displaying a user-facing message
 * about an application crash (panic). The component is used as a body of a Toastify toast. */

import * as React from 'react'
import * as toastify from 'react-toastify'

/** Props for `PanicMessage` component. */
export interface PanicMessageProps {
    /** The panic message with stack trace. Usually big multiline text. */
    message: string
    /** A callback to trigger application restart. */
    restart: () => void
}

/** A component displaying panic message inside a toast. */
export function PanicMessage(props: PanicMessageProps) {
    const reportUrl =
        'https://github.com/enso-org/enso/issues/new' +
        '?labels=--bug%2Ctriage' +
        '&template=bug-report.yml'
    return (
        <div className="flex flex-col">
            <h1 className="text-xl font-semibold">Enso has crashed.</h1>
            <p className="mt-3">
                Enso has encountered a critical error and needs to be restarted. This is a bug, and
                we would appreciate it if you could report it to us.
            </p>
            <p>Please include following panic message in your report:</p>
            <pre
                className={
                    'overflow-auto mt-2 p-2 bg-gray-200 text-gray-800 border rounded ' +
                    'border-gray-400'
                }
                style={{ maxHeight: '50vh' }}
            >
                {props.message}
            </pre>
            <div className="flex flex-row mt-2 gap-2 justify-end">
                <button
                    className={
                        'text-sm border text-gray-800 bg-gray-100 hover:bg-gray-200 rounded p-2 ' +
                        'transition'
                    }
                    type="submit"
                    onClick={props.restart}
                >
                    Restart
                </button>
                <a
                    target="_blank"
                    rel="noreferrer"
                    href={reportUrl}
                    className={
                        'text-sm border text-white bg-indigo-600 hover:bg-indigo-700 rounded p-2 ' +
                        'transition'
                    }
                >
                    Report
                </a>
            </div>
        </div>
    )
}

/** Display a toast with panic message. */
export function displayPanicMessageToast(message: string, restartApp: () => void) {
    const restart = () => {
        restartApp()
        toastify.toast.dismiss(toastId)
    }
    const element = <PanicMessage message={message} restart={restart} />
    const toastId = toastify.toast.error(element, {
        closeButton: false,
        autoClose: false,
        style: {
            // Allow the toast to fill the screen almost completely, leaving a small margin.
            width: 'calc(min(100vw - 2rem, 1200px))',
            left: '50%',
            transform: 'translateX(-50%)',
            maxHeight: 'calc(100vh - 4rem)',
        },
        bodyStyle: {
            alignItems: 'flex-start',
            overflow: 'hidden',
        },
    })
}
