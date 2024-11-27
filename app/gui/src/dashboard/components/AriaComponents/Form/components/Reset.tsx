/** @file Reset button for forms. */
import * as ariaComponents from '#/components/AriaComponents'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useText } from '#/providers/TextProvider'
import { memo, type JSX } from 'react'
import * as formContext from './FormProvider'
import type * as types from './types'

/** Props for the Reset component. */
export interface ResetProps extends Omit<ariaComponents.ButtonProps, 'loading'> {
  /**
   * Connects the reset button to a form.
   * If not provided, the button will use the nearest form context.
   *
   * This field is helpful when you need to use the reset button outside of a form.
   */
  readonly form?: types.AnyFormInstance
}

/** Reset button for forms. */

export const Reset = memo(function Reset(props: ResetProps): JSX.Element {
  const { getText } = useText()
  const {
    variant = 'outline',
    size = 'medium',
    testId = 'form-reset-button',
    children = getText('reset'),
    ...buttonProps
  } = props

  const form = formContext.useFormContext(props.form)
  const { formState } = form

  const onReset = useEventCallback(() => {
    form.reset()
  })

  return (
    <ariaComponents.Button
      variant={variant}
      size={size}
      isDisabled={formState.isSubmitting || !formState.isDirty}
      testId={testId}
      children={children}
      onPress={onReset}
      /* This is safe because we are passing all props to the button */
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any,no-restricted-syntax */
      {...(buttonProps as any)}
    />
  )
})
