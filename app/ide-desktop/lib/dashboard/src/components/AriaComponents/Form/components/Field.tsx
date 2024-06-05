/**
 * @file
 *
 * Field component
 */

import * as React from 'react'

import * as twv from 'tailwind-variants'

import * as aria from '#/components/aria'

import * as text from '../../Text'
import type * as types from './types'
import * as formContext from './useFormContext'

/**
 * Props for Field component
 */
export interface FieldComponentProps
  extends twv.VariantProps<typeof FIELD_STYLES>,
    types.FieldProps,
    React.PropsWithChildren {
  readonly name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form?: types.FormInstance<any, any, any>
  readonly isInvalid?: boolean
  readonly className?: string
}

export const FIELD_STYLES = twv.tv({
  base: 'flex flex-col gap-0.5 items-start',
  variants: {
    fullWidth: { true: 'w-full' },
    isInvalid: {
      true: { label: 'text-danger' },
    },
  },
  slots: {
    label: text.TEXT_STYLE({ variant: 'subtitle' }),
    content: 'flex flex-col items-start w-full',
    description: text.TEXT_STYLE({ variant: 'body', color: 'disabled' }),
    error: text.TEXT_STYLE({ variant: 'body', color: 'danger' }),
  },
})

/**
 * Field component
 */
export const Field = React.forwardRef(function Field(
  props: FieldComponentProps,
  ref: React.ForwardedRef<HTMLFieldSetElement>
) {
  const {
    form = formContext.useFormContext(),
    isInvalid,
    children,
    className,
    label,
    description,
    fullWidth,
    error,
    name,
    isRequired = false,
  } = props

  const fieldState = form.getFieldState(name)

  const labelId = React.useId()
  const descriptionId = React.useId()
  const errorId = React.useId()

  const invalid = isInvalid === true || fieldState.invalid

  const classes = FIELD_STYLES({
    fullWidth,
    isInvalid: invalid,
  })

  const hasError = (error ?? fieldState.error?.message) != null

  return (
    <fieldset
      ref={ref}
      className={classes.base({ className })}
      aria-invalid={invalid}
      aria-label={props['aria-label']}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      aria-details={props['aria-details']}
      aria-errormessage={hasError ? errorId : ''}
      aria-required={isRequired}
    >
      {label != null && (
        <aria.Label id={labelId} className={classes.label()}>
          {label}
        </aria.Label>
      )}

      <div className={classes.content()}>{children}</div>

      {description != null && (
        <span id={descriptionId} className={classes.description()}>
          {description}
        </span>
      )}

      {hasError && (
        <span id={errorId} className={classes.error()}>
          {error ?? fieldState.error?.message}
        </span>
      )}
    </fieldset>
  )
})
