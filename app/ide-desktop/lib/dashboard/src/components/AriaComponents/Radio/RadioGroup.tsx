/**
 * @file
 *
 * A radio group component.
 */
import * as React from 'react'

import * as aria from '#/components/aria'

import * as mergeRefs from '#/utilities/mergeRefs'
import * as twv from '#/utilities/tailwindVariants'

import * as formComponent from '../Form'
import * as radioGroupContext from './RadioGroupContext'

/**
 * Props for {@link RadioGroup}.
 */
export interface RadioGroupProps<
  Schema extends formComponent.TSchema,
  TFieldValues extends formComponent.FieldValues<Schema>,
  TFieldName extends formComponent.FieldPath<Schema, TFieldValues>,
  // eslint-disable-next-line no-restricted-syntax
  TTransformedValues extends formComponent.FieldValues<Schema> | undefined = undefined,
> extends formComponent.FieldStateProps<
      Omit<aria.AriaRadioGroupProps, 'description' | 'label'>,
      Schema,
      TFieldValues,
      TFieldName,
      TTransformedValues
    >,
    twv.VariantProps<typeof RADIO_GROUP_STYLES>,
    formComponent.FieldProps {
  readonly children?: React.ReactNode
  readonly className?: string
}

export const RADIO_GROUP_STYLES = twv.tv({
  base: 'flex flex-col gap-0.5 items-start',
  variants: { fullWidth: { true: 'w-full' } },
})

/**
 * A radio group component.
 */
// eslint-disable-next-line no-restricted-syntax
export const RadioGroup = React.forwardRef(function RadioGroup<
  Schema extends formComponent.TSchema,
  TFieldName extends formComponent.FieldPath<Schema, TFieldValues>,
  TFieldValues extends formComponent.FieldValues<Schema> = formComponent.FieldValues<Schema>,
  // eslint-disable-next-line no-restricted-syntax
  TTransformedValues extends formComponent.FieldValues<Schema> | undefined = undefined,
>(
  props: RadioGroupProps<Schema, TFieldValues, TFieldName, TTransformedValues>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
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
    ...radioGroupProps
  } = props

  const { field, fieldState, formInstance } = formComponent.Form.useField({
    name,
    isDisabled,
    form,
    defaultValue,
  })

  const invalid = isInvalid || fieldState.invalid

  const base = RADIO_GROUP_STYLES({ fullWidth, className })

  return (
    <aria.RadioGroup
      ref={mergeRefs.mergeRefs(ref, field.ref)}
      {...radioGroupProps}
      className={base}
      name={field.name}
      value={field.value}
      isDisabled={field.disabled ?? isDisabled}
      isRequired={isRequired}
      isReadOnly={isReadOnly}
      isInvalid={invalid}
      onChange={field.onChange}
      onBlur={field.onBlur}
    >
      <radioGroupContext.RadioGroupProvider>
        <formComponent.Form.Field
          name={field.name}
          form={formInstance}
          label={label}
          description={description}
          fullWidth={fullWidth}
          isInvalid={invalid}
          {...radioGroupProps}
        >
          {children}
        </formComponent.Form.Field>
      </radioGroupContext.RadioGroupProvider>
    </aria.RadioGroup>
  )
}) as <
  Schema extends formComponent.TSchema,
  TFieldName extends formComponent.FieldPath<Schema, TFieldValues>,
  TFieldValues extends formComponent.FieldValues<Schema> = formComponent.FieldValues<Schema>,
  // eslint-disable-next-line no-restricted-syntax
  TTransformedValues extends formComponent.FieldValues<Schema> | undefined = undefined,
>(
  props: RadioGroupProps<Schema, TFieldValues, TFieldName, TTransformedValues> &
    React.RefAttributes<HTMLFormElement>
) => React.JSX.Element
