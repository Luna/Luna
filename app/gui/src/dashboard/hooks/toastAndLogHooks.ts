/** @file */
import { toast, type Id } from 'react-toastify'

import type { Replacements, TextId } from '@common/text'

import { useLogger } from '#/providers/LoggerProvider'
import { useText } from '#/providers/TextProvider'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { getMessageOrToString, type MustNotBeKnown } from '@common/utilities/error'

/** The type of the `toastAndLog` function returned by {@link useToastAndLog}. */
export type ToastAndLogCallback = ReturnType<typeof useToastAndLog>

/**
 * Return a function to send a toast with rendered error message. The same message is also logged
 * as an error.
 */
export function useToastAndLogWithId() {
  const { getText } = useText()
  const logger = useLogger()

  return useEventCallback(
    <K extends TextId, T>(
      toastId: Id,
      textId: K | null,
      ...[error, ...replacements]: Replacements[K] extends readonly [] ?
        [error?: Error | MustNotBeKnown<T>]
      : [error: Error | MustNotBeKnown<T> | null, ...replacements: Replacements[K]]
    ) => {
      const messagePrefix =
        textId == null ? null
          // This is SAFE, as `replacements` is only `[]` if it was already `[]`.
          // See the above conditional type.
          // eslint-disable-next-line no-restricted-syntax
        : getText(textId, ...(replacements as Replacements[K]))
      const message =
        error == null ?
          `${messagePrefix ?? ''}.`
          // DO NOT explicitly pass the generic parameter anywhere else.
          // It is only being used here because this function also checks for
          // `MustNotBeKnown<T>`.
        : `${
            messagePrefix != null ? messagePrefix + ': ' : ''
          }${getMessageOrToString<unknown>(error)}`
      toast.update(toastId, {
        type: 'error',
        render: message,
        isLoading: false,
        autoClose: null,
      })
      logger.error(message)
    },
  )
}

/**
 * Return a function to send a toast with rendered error message. The same message is also logged
 * as an error.
 */
export function useToastAndLog() {
  const { getText } = useText()
  const logger = useLogger()

  return useEventCallback(
    <K extends TextId, T>(
      textId: K | null,
      ...[error, ...replacements]: Replacements[K] extends readonly [] ?
        [error?: Error | MustNotBeKnown<T>]
      : [error: Error | MustNotBeKnown<T> | null, ...replacements: Replacements[K]]
    ) => {
      const messagePrefix =
        textId == null ? null
          // This is SAFE, as `replacements` is only `[]` if it was already `[]`.
          // See the above conditional type.
          // eslint-disable-next-line no-restricted-syntax
        : getText(textId, ...(replacements as Replacements[K]))
      const message =
        error == null ?
          `${messagePrefix ?? ''}.`
          // DO NOT explicitly pass the generic parameter anywhere else.
          // It is only being used here because this function also checks for
          // `MustNotBeKnown<T>`.
        : `${
            messagePrefix != null ? messagePrefix + ': ' : ''
          }${getMessageOrToString<unknown>(error)}`
      const id = toast.error(message)
      logger.error(message)
      return id
    },
  )
}
