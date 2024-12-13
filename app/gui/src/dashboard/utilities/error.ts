/** @file Contains useful error types common across the module. */
import isNetworkErrorLib from 'is-network-error'
import type * as toastify from 'react-toastify'

import { getMessageOrToString } from 'enso-common/src/utilities/error'

/** Return a toastify option object that renders an error message. */
export function render(f: (message: string) => string): toastify.UpdateOptions {
  return { render: ({ data }) => f(getMessageOrToString(data)) }
}

/**
 * Checks if the given error is a network error.
 * Wraps the `is-network-error` library to add additional network errors to the check.
 */
export function isNetworkError(error: unknown): boolean {
  const customNetworkErrors = new Set([
    // aws amplify network error
    'Network error',
  ])

  if (error instanceof Error) {
    if (customNetworkErrors.has(error.message)) {
      return true
    } else {
      return isNetworkErrorLib(error)
    }
  } else {
    return false
  }
}
