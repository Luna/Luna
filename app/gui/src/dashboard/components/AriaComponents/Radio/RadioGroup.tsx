/** @file A radio group. */
import type { ForwardedRef, ReactNode } from 'react'

import { omit } from '@common/utilities/data/object'

import {
  RadioGroup as AriaRadioGroup,
  mergeProps,
  type AriaRadioGroupProps as AriaAriaRadioGroupProps,
  type RadioGroupProps as AriaRadioGroupProps,
} from '#/components/aria'
import { mergeRefs } from '#/utilities/mergeRefs'
import { forwardRef } from '#/utilities/react'
import { tv, type VariantProps } from '#/utilities/tailwindVariants'
import type { FieldVariantProps } from '../Form'
import { Form, type FieldPath, type FieldProps, type FieldStateProps, type TSchema } from '../Form'
import { RadioGroupProvider } from './RadioGroupContext'

/** Props for {@link RadioGroup}. */
export interface RadioGroupProps<Schema extends TSchema, TFieldName extends FieldPath<Schema>>
  extends FieldStateProps<
      Omit<AriaAriaRadioGroupProps, 'description' | 'label'>,
      Schema,
      TFieldName
    >,
    VariantProps<typeof RADIO_GROUP_STYLES>,
    FieldProps,
    FieldVariantProps {
  readonly children?: ReactNode
  readonly className?: string
}

export const RADIO_GROUP_STYLES = tv({
  base: 'flex flex-col gap-0.5 items-start',
  variants: { fullWidth: { true: 'w-full' } },
})

/** A radio group component. */

export const RadioGroup = forwardRef(function RadioGroup<
  Schema extends TSchema,
  TFieldName extends FieldPath<Schema>,
>(props: RadioGroupProps<Schema, TFieldName>, ref: ForwardedRef<HTMLDivElement>) {
  const {
    children,
    isRequired = false,
    isReadOnly = false,
    isDisabled = false,
    isInvalid = false,
    name,
    className,
    form,
    defaultValue,
    label,
    description,
    fullWidth,
    variants = RADIO_GROUP_STYLES,
    fieldVariants,
    ...radioGroupProps
  } = props

  const { field, fieldState, formInstance } = Form.useField({
    name,
    isDisabled,
    form,
    defaultValue,
  })

  const invalid = isInvalid || fieldState.invalid

  const base = variants({ fullWidth, className })

  return (
    <AriaRadioGroup
      ref={(el) => {
        mergeRefs(ref, field.ref)(el)
      }}
      {...mergeProps<AriaRadioGroupProps>()(omit(radioGroupProps, 'validate'), {
        name: field.name,
        value: field.value,
        isDisabled: field.disabled ?? isDisabled,
        onChange: field.onChange,
        onBlur: field.onBlur,
        className: base,
        isRequired,
        isReadOnly,
        isInvalid: invalid,
      })}
    >
      <RadioGroupProvider>
        <Form.Field
          name={name}
          form={formInstance}
          label={label}
          description={description}
          fullWidth={fullWidth}
          isInvalid={invalid}
          variants={fieldVariants}
          {...radioGroupProps}
        >
          {children}
        </Form.Field>
      </RadioGroupProvider>
    </AriaRadioGroup>
  )
})
