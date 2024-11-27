/**
 * @file
 *
 * A hook for getting the form state.
 */
import * as reactHookForm from 'react-hook-form'

import * as formContext from './FormProvider'
import type * as types from './types'
import type { FormInstanceValidated } from './types'

/** Options for {@link useFormState} hook. */
export interface UseFormStateOptions<Schema extends types.TSchema> {
  readonly form?: FormInstanceValidated<Schema> | undefined
}

/**
 * A hook for getting the form state.
 */
export function useFormState<Schema extends types.TSchema>(options: UseFormStateOptions<Schema>) {
  const formInstance = formContext.useFormContext(options.form)
  return reactHookForm.useFormState({ control: formInstance.control })
}
