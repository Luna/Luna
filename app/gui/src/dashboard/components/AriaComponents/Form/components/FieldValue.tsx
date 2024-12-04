/**
 * @file
 *
 * Component that passes the value of a field to its children.
 */
import { memo, useDeferredValue } from 'react'
import { useWatch } from 'react-hook-form'
import { useFormContext } from './FormProvider'
import type { FieldPath, FieldValues, FormInstanceValidated, TSchema } from './types'

/**
 *
 */
export interface FieldValueProps<Schema extends TSchema, TFieldName extends FieldPath<Schema>> {
  readonly form?: FormInstanceValidated<Schema>
  readonly name: TFieldName
  readonly children: (value: FieldValues<Schema>[TFieldName]) => React.ReactNode
}

/**
 * Component that passes the value of a field to its children.
 */
export function FieldValue<Schema extends TSchema, TFieldName extends FieldPath<Schema>>(
  props: FieldValueProps<Schema, TFieldName>,
) {
  const { form, name, children } = props

  const formInstance = useFormContext(form)
  const value = useWatch({ control: formInstance.control, name })
  const deferredValue = useDeferredValue(value)

  return <MemoChildren children={children} value={deferredValue} />
}

// Wrap the childer to make the deferredValue to work
// see: https://react.dev/reference/react/useDeferredValue#deferring-re-rendering-for-a-part-of-the-ui
// eslint-disable-next-line no-restricted-syntax
const MemoChildren = memo(function MemoChildren<T>(props: {
  children: (value: T) => React.ReactNode
  value: T
}) {
  return props.children(props.value)
}) as unknown as <T>(props: {
  children: (value: T) => React.ReactNode
  value: T
}) => React.ReactNode
