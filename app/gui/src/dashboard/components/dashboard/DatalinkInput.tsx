/** @file A dynamic wizard for creating an arbitrary type of Datalink. */
import { assert } from 'enso-common/src/utilities/error'

import { FieldError } from '#/components/aria'
import type { FieldPath, FormInstance, TSchema } from '#/components/AriaComponents'
import { Form } from '#/components/AriaComponents'
import type * as jsonSchemaInput from '#/components/JSONSchemaInput'
import JSONSchemaInput from '#/components/JSONSchemaInput'
import SCHEMA from '#/data/datalinkSchema.json' with { type: 'json' }
import * as datalinkValidator from '#/data/datalinkValidator'

const DEFS: Record<string, object> = SCHEMA.$defs

/**
 * Get a known schema using a path.
 * @throws {Error} when there is no schema present at the given path.
 */
function getValidator(path: string) {
  return assert<(value: unknown) => boolean>(() => datalinkValidator.AJV.getSchema(path))
}

/** Props for a {@link DatalinkInput}. */
export type DatalinkInputProps = Omit<
  jsonSchemaInput.JSONSchemaInputProps,
  'defs' | 'getValidator' | 'path' | 'schema'
>

/** A dynamic wizard for creating an arbitrary type of Datalink. */
export default function DatalinkInput(props: DatalinkInputProps) {
  return (
    <JSONSchemaInput
      defs={DEFS}
      schema={SCHEMA.$defs.DataLink}
      path={'#/$defs/DataLink'}
      getValidator={getValidator}
      {...props}
    />
  )
}

/** Props for a {@link DatalinkFormInput}. */
export interface DatalinkFormInputProps<Schema extends TSchema>
  extends Omit<DatalinkInputProps, 'onChange' | 'value'> {
  readonly form?: FormInstance<Schema>
  readonly name: FieldPath<Schema>
}

/** A dynamic wizard for creating an arbitrary type of Datalink. */
export function DatalinkFormInput<Schema extends TSchema>(props: DatalinkFormInputProps<Schema>) {
  const { name, ...inputProps } = props

  const form = Form.useFormContext(props.form)

  return (
    <Form.Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const { value, onChange } = field
        return (
          <>
            <DatalinkInput {...inputProps} value={value} onChange={onChange} />
            <FieldError>{fieldState.error?.message}</FieldError>
          </>
        )
      }}
    />
  )
}
