/**
 * @file
 *
 * Close button for a dialog.
 */

import invariant from 'tiny-invariant'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { type ButtonProps, Button } from '../Button'
import * as dialogProvider from './DialogProvider'

/** Props for {@link Close} component. */
export type CloseProps = ButtonProps & {
  readonly onClose?: () => void
  readonly hideOutsideOfDialog?: boolean
}

/** Close button for a dialog. */
export function Close(props: CloseProps) {
  const { hideOutsideOfDialog = false, onClose } = props
  const dialogContext = dialogProvider.useDialogContext()

  const onPressCallback = useEventCallback<NonNullable<ButtonProps['onPress']>>((event) => {
    dialogContext?.close()
    onClose?.()
    return props.onPress?.(event)
  })

  if (hideOutsideOfDialog && !dialogContext) {
    return null
  }

  invariant(dialogContext, 'Close must be used inside a DialogProvider')

  return <Button {...props} onPress={onPressCallback} />
}
