/**
 * @file
 * Types for the Form component.
 */

import type * as React from 'react'

import type * as reactHookForm from 'react-hook-form'

import type { DeepPartialSkipArrayKey } from 'react-hook-form'
import type * as components from './components'
import type * as styles from './styles'

export type * from './components'

/**
 * Props for the Form component
 */
export type FormProps<
  Schema extends components.TSchema,
  SubmitResult = void,
> = BaseFormProps<Schema> &
  (FormPropsWithOptions<Schema, SubmitResult> | FormPropsWithParentForm<Schema>)

/**
 * Base props for the Form component.
 */
interface BaseFormProps<Schema extends components.TSchema>
  extends Omit<
      React.HTMLProps<HTMLFormElement>,
      'children' | 'className' | 'form' | 'onSubmit' | 'onSubmitCapture' | 'style'
    >,
    Omit<styles.FormStyleProps, 'class' | 'className'> {
  /**
   * The default values for the form fields
   *
   * __Note:__ Even though this is optional,
   * it is recommended to provide default values and specify all fields defined in the schema.
   * Otherwise Typescript fails to infer the correct type for the form values.
   * This is a known limitation and we are working on a solution.
   */
  readonly defaultValues?: components.UseFormProps<Schema>['defaultValues']
  readonly style?:
    | React.CSSProperties
    | ((props: components.UseFormReturn<Schema>) => React.CSSProperties)
  readonly children:
    | React.ReactNode
    | ((
        props: components.UseFormReturn<Schema> & {
          readonly form: components.UseFormReturn<Schema>
          readonly values: DeepPartialSkipArrayKey<components.FieldValues<Schema>>
        },
      ) => React.ReactNode)
  readonly formRef?: React.MutableRefObject<components.UseFormReturn<Schema>>

  readonly className?: string | ((props: components.UseFormReturn<Schema>) => string)

  readonly testId?: string
  /**
   * When set to `dialog`, form submission will close the parent dialog on successful submission.
   */
  // eslint-disable-next-line @typescript-eslint/ban-types,no-restricted-syntax
  readonly method?: 'dialog' | (string & {})

  readonly canSubmitOffline?: boolean
}

/**
 * Props for the Form component with parent form
 * or if form is passed as a prop.
 */
interface FormPropsWithParentForm<Schema extends components.TSchema> {
  readonly form: components.UseFormReturn<Schema>
  readonly schema?: never
  readonly formOptions?: never
  readonly onSubmit?: never
  readonly onSubmitSuccess?: never
  readonly onSubmitFailed?: never
  readonly onSubmitted?: never
}

/**
 * Props for the Form component with schema and form options.
 * Creates a new form instance. This is the default way to use the form.
 */
interface FormPropsWithOptions<Schema extends components.TSchema, SubmitResult = void>
  extends components.OnSubmitCallbacks<Schema, SubmitResult> {
  readonly schema: Schema | ((schema: typeof components.schema) => Schema)
  readonly formOptions?: Omit<
    components.UseFormProps<Schema>,
    'handleSubmit' | 'resolver' | 'schema'
  >
  readonly form?: never
}

/**
 * Register function for a form field.
 */
export type UseFormRegister<Schema extends components.TSchema> = <
  TFieldName extends components.FieldPath<Schema> = components.FieldPath<Schema>,
>(
  name: TFieldName,
  options?: reactHookForm.RegisterOptions<components.FieldValues<Schema>, TFieldName>,
) => UseFormRegisterReturn<Schema, TFieldName>

/**
 * UseFormRegister return type.
 */
export interface UseFormRegisterReturn<
  Schema extends components.TSchema,
  TFieldName extends components.FieldPath<Schema> = components.FieldPath<Schema>,
> extends Omit<reactHookForm.UseFormRegisterReturn<TFieldName>, 'onBlur' | 'onChange'> {
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  readonly onChange: <Value>(value: Value) => Promise<boolean | void> | void
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  readonly onBlur: <Value>(value: Value) => Promise<boolean | void> | void
  readonly isDisabled?: boolean
  readonly isRequired?: boolean
  readonly isInvalid?: boolean
}

/**
 * Form Render Props.
 */
export type FormStateRenderProps<Schema extends components.TSchema> = Pick<
  components.FormInstance<Schema>,
  | 'clearErrors'
  | 'control'
  | 'formState'
  | 'getValues'
  | 'reset'
  | 'setError'
  | 'setFocus'
  | 'setValue'
  | 'unregister'
> & {
  /** The form register function. Adds a field to the form state. */
  readonly register: UseFormRegister<Schema>
  /** The form instance. */
  readonly form: components.FormInstance<Schema>
}
