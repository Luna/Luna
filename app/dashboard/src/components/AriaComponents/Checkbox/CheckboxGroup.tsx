/**
 * @file
 *
 * A CheckboxGroup allows users to select one or more items from a list of choices.
 */
import type { CheckboxGroupProps as AriaCheckboxGroupProps } from '#/components/aria'
import { CheckboxGroup as AriaCheckboxGroup, mergeProps } from '#/components/aria'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { mergeRefs } from '#/utilities/mergeRefs'
import { omit } from '#/utilities/object'
import { forwardRef } from '#/utilities/react'
import type { VariantProps } from '#/utilities/tailwindVariants'
import { tv } from '#/utilities/tailwindVariants'
import type { CSSProperties, ForwardedRef, ReactElement } from 'react'
import type { FieldVariantProps } from '../Form'
import { Form, type FieldPath, type FieldProps, type FieldStateProps, type TSchema } from '../Form'
import type { TestIdProps } from '../types'
import { CheckboxGroupProvider } from './CheckboxContext'

/**
 * Props for the {@link CheckboxGroupProps} component.
 */
export interface CheckboxGroupProps<Schema extends TSchema, TFieldName extends FieldPath<Schema>>
  extends FieldStateProps<AriaCheckboxGroupProps, Schema, TFieldName>,
    FieldProps,
    FieldVariantProps,
    Omit<VariantProps<typeof CHECKBOX_GROUP_STYLES>, 'disabled' | 'invalid'>,
    TestIdProps {
  readonly className?: string
  readonly style?: CSSProperties
  readonly checkboxRef?: ForwardedRef<HTMLInputElement>
  readonly children: ReactElement | ((props: AriaCheckboxGroupProps) => ReactElement)
}

const CHECKBOX_GROUP_STYLES = tv({
  base: 'flex flex-col gap-0.5 items-start',
  variants: { fullWidth: { true: 'w-full' } },
})

/**
 * A CheckboxGroup allows users to select one or more items from a list of choices.
 */
// eslint-disable-next-line no-restricted-syntax
export const CheckboxGroup = forwardRef(
  <Schema extends TSchema, TFieldName extends FieldPath<Schema>>(
    props: CheckboxGroupProps<Schema, TFieldName>,
    ref: ForwardedRef<HTMLFieldSetElement>,
  ): ReactElement => {
    const {
      children,
      className,
      variants = CHECKBOX_GROUP_STYLES,
      form,
      defaultValue,
      isDisabled = false,
      isRequired = false,
      isInvalid = false,
      isReadOnly = false,
      label,
      name,
      description,
      fullWidth = false,
      fieldVariants,
      ...checkboxGroupProps
    } = props

    const { fieldState, formInstance } = Form.useField({
      name,
      isDisabled,
      form,
      defaultValue,
    })

    const field = formInstance.register(name, { disabled: isDisabled, required: isRequired })

    const invalid = isInvalid || fieldState.invalid

    const styles = variants({ fullWidth, className })
    const testId = props['data-testid'] ?? props.testId ?? 'CheckboxGroup'

    return (
      <CheckboxGroupProvider
        name={name}
        field={field}
        onChange={useEventCallback(
          (selected) =>
            void field
              .onChange({ target: { name, value: selected } })
              .then(() => formInstance.trigger(name)),
        )}
      >
        <AriaCheckboxGroup
          {...mergeProps<AriaCheckboxGroupProps>()(omit(checkboxGroupProps, 'validate'), {
            className: styles,
            isInvalid,
            isDisabled,
            isReadOnly,
            name,
          })}
          ref={mergeRefs(ref, field.ref)}
          data-testid={testId}
        >
          {(renderProps) => (
            <Form.Field
              name={name}
              form={formInstance}
              label={label}
              description={description}
              isRequired={isRequired}
              fullWidth={fullWidth}
              isInvalid={invalid}
              variants={fieldVariants}
              {...checkboxGroupProps}
            >
              {typeof children === 'function' ? children(renderProps) : children}
            </Form.Field>
          )}
        </AriaCheckboxGroup>
      </CheckboxGroupProvider>
    )
  },
)
