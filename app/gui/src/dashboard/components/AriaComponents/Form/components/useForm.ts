/** @file A hook that returns a form instance. */
import * as sentry from '@sentry/react'
import * as React from 'react'

import * as zodResolver from '@hookform/resolvers/zod'
import * as reactHookForm from 'react-hook-form'
import invariant from 'tiny-invariant'

import { mergeProps } from '#/components/aria'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useOffline, useOfflineChange } from '#/hooks/offlineHooks'
import { useText } from '#/providers/TextProvider'
import * as errorUtils from '#/utilities/error'
import { unsafeMutable } from '#/utilities/object'
import { useMutation } from '@tanstack/react-query'
import * as schemaModule from './schema'
import type * as types from './types'

/** Maps the value to the event object. */
function mapValueOnEvent(value: unknown) {
  if (typeof value === 'object' && value != null && 'target' in value && 'type' in value) {
    return value
  } else {
    return { target: { value } }
  }
}

export function useForm<Schema extends types.TSchema, SubmitResult>(
  form: types.UseFormReturn<Schema, SubmitResult>,
  formInstanceCallbacks?: types.OnSubmitCallbacks<Schema, SubmitResult>,
): types.UseFormReturn<Schema, SubmitResult>

export function useForm<Schema extends types.TSchema, SubmitResult>(
  options: types.UseFormOptions<Schema, SubmitResult>,
): types.UseFormReturn<Schema, SubmitResult>

/**
 * A hook that returns a form instance.
 * @param optionsOrFormInstance - Either form options or a form instance
 *
 * If form instance is passed, it will be returned as is.
 *
 * If form options are passed, a form instance will be created and returned.
 *
 * ***Note:*** This hook accepts either a form instance(If form is created outside)
 * or form options(and creates a form instance).
 * This is useful when you want to create a form instance outside the component
 * and pass it to the component.
 * But be careful, You should not switch between the two types of arguments.
 * Otherwise you'll be fired
 */
export function useForm<Schema extends types.TSchema, SubmitResult = void>(
  optionsOrFormInstance:
    | types.UseFormOptions<Schema, SubmitResult>
    | types.UseFormReturn<Schema, SubmitResult>,
  formInstanceCallbacks?: types.OnSubmitCallbacks<Schema, SubmitResult>,
): types.UseFormReturn<Schema, SubmitResult> {
  const [initialTypePassed] = React.useState(() => getArgsType(optionsOrFormInstance))

  const argsType = getArgsType(optionsOrFormInstance)

  invariant(
    initialTypePassed === argsType,
    `
    Found a switch between form options and form instance. This is not allowed. Please use either form options or form instance and stick to it.\n\n
    Initially passed: ${initialTypePassed}, Currently passed: ${argsType}.
    `,
  )

  /* eslint-disable react-compiler/react-compiler, react-hooks/rules-of-hooks */
  if (isFormInstance(optionsOrFormInstance)) {
    return useFormInstance(optionsOrFormInstance, formInstanceCallbacks)
  }

  return useCreateFormProps(optionsOrFormInstance)
  /* eslint-enable react-hooks/rules-of-hooks, react-compiler/react-compiler */
}

/** Checks if the argument is a form instance */
function isFormInstance<Schema extends types.TSchema, SubmitResult>(
  args: types.UseFormOptions<Schema, SubmitResult> | types.UseFormReturn<Schema, SubmitResult>,
): args is types.UseFormReturn<Schema, SubmitResult> {
  return 'formState' in args
}

/** Get the type of arguments passed to the useForm hook */
function getArgsType<Schema extends types.TSchema, SubmitResult = void>(
  args: types.UseFormOptions<Schema, SubmitResult>,
): 'formInstance' | 'formOptions' {
  return isFormInstance(args) ? 'formInstance' : 'formOptions'
}

/**
 * Returns form instance with merged callbacks
 * @internal
 */
function useFormInstance<Schema extends types.TSchema, SubmitResult>(
  form: types.UseFormReturn<Schema, SubmitResult>,
  formInstanceCallbacks: types.OnSubmitCallbacks<Schema, SubmitResult> = {},
): types.UseFormReturn<Schema, SubmitResult> {
  // mutations here are necessary, because we want to mutate the form instance,
  // instead of creating a new one, to make callbacks work
  const props = mergeProps<types.OnSubmitCallbacks<Schema, SubmitResult>>()(
    {
      onSubmit: form.onSubmit,
      onSubmitSuccess: form.onSubmitSuccess,
      onSubmitFailed: form.onSubmitFailed,
      onSubmitted: form.onSubmitted,
    },
    {
      onSubmit: formInstanceCallbacks.onSubmit,
      onSubmitSuccess: formInstanceCallbacks.onSubmitSuccess,
      onSubmitFailed: formInstanceCallbacks.onSubmitFailed,
      onSubmitted: formInstanceCallbacks.onSubmitted,
    },
  )

  // down there we're mutating the form instance, and merging the callbacks.
  // The readonly modifier is only for external usage
  unsafeMutable(form).onSubmit = props.onSubmit
  unsafeMutable(form).onSubmitFailed = props.onSubmitFailed
  unsafeMutable(form).onSubmitSuccess = props.onSubmitSuccess
  unsafeMutable(form).onSubmitted = props.onSubmitted

  return form
}

/**
 * Create a form instance from options
 * @internal
 */
function useCreateFormProps<Schema extends types.TSchema, SubmitResult>(
  options: types.UseFormOptions<Schema, SubmitResult>,
) {
  const {
    schema,
    onSubmit,
    canSubmitOffline = false,
    onSubmitFailed,
    onSubmitted,
    onSubmitSuccess,
    debugName,
    ...rest
  } = options

  const { getText } = useText()

  const computedSchema = typeof schema === 'function' ? schema(schemaModule.schema) : schema

  const formInstance = reactHookForm.useForm({
    ...rest,
    resolver: zodResolver.zodResolver(
      computedSchema,
      {
        async: true,
        errorMap: (issue) => {
          switch (issue.code) {
            case 'too_small':
              if (issue.minimum === 1 && issue.type === 'string') {
                return {
                  message: getText('arbitraryFieldRequired'),
                }
              } else {
                return {
                  message: getText('arbitraryFieldTooSmall', issue.minimum.toString()),
                }
              }
            case 'too_big':
              return {
                message: getText('arbitraryFieldTooLarge', issue.maximum.toString()),
              }
            case 'invalid_type':
              return {
                message: getText('arbitraryFieldInvalid'),
              }
            default:
              return {
                message: getText('arbitraryFieldInvalid'),
              }
          }
        },
      },
      { mode: 'async' },
    ),
  })

  const register: types.UseFormRegister<Schema> = (name, opts) => {
    const registered = formInstance.register(name, opts)

    const onChange: types.UseFormRegisterReturn<Schema>['onChange'] = (value) =>
      registered.onChange(mapValueOnEvent(value))

    const onBlur: types.UseFormRegisterReturn<Schema>['onBlur'] = (value) =>
      registered.onBlur(mapValueOnEvent(value))

    const result: types.UseFormRegisterReturn<Schema, typeof name> = {
      ...registered,
      disabled: registered.disabled ?? false,
      isDisabled: registered.disabled ?? false,
      invalid: !!formInstance.formState.errors[name],
      isInvalid: !!formInstance.formState.errors[name],
      required: registered.required ?? false,
      isRequired: registered.required ?? false,
      onChange,
      onBlur,
    }

    return result
  }

  // We need to disable the eslint rules here, because we call hooks conditionally
  // but it's safe to do so, because we don't switch between the two types of arguments
  // and if we do, we throw an error.

  const formMutation = useMutation({
    // We use template literals to make the mutation key more readable in the devtools
    // This mutation exists only for debug purposes - React Query dev tools record the mutation,
    // the result, and the variables(form fields).
    // In general, prefer using object literals for the mutation key.
    mutationKey: ['Form submission', `debugName: ${debugName}`],
    mutationFn: async (fieldValues: types.FieldValues<Schema>): Promise<SubmitResult> => {
      if (onSubmit == null) {
        // This is safe, because we know that the type of the result is the same as the type of the SubmitResult.
        // eslint-disable-next-line no-restricted-syntax
        return Promise.resolve() as SubmitResult
      }

      try {
        return await onSubmit(fieldValues, form)
      } catch (error) {
        const isJSError = errorUtils.isJSError(error)

        if (isJSError) {
          sentry.captureException(error, {
            contexts: { form: { values: fieldValues } },
          })
        }

        const message =
          isJSError ?
            getText('arbitraryFormErrorMessage')
          : errorUtils.tryGetMessage(error, getText('arbitraryFormErrorMessage'))

        setFormError(message)
        // We need to throw the error to make the mutation fail
        throw error
      }
    },
    onError: (error, values) => form.onSubmitFailed?.(error, values, form),
    onSuccess: (data: SubmitResult, values) => form.onSubmitSuccess?.(data, values, form),
    onSettled: (data, error, values) => form.onSubmitted?.(data, error, values, form),
  })

  // There is no way to avoid type casting here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-restricted-syntax,@typescript-eslint/no-unsafe-argument
  const formOnSubmit = formInstance.handleSubmit(formMutation.mutateAsync as any)

  const { isOffline } = useOffline()

  useOfflineChange(
    (offline) => {
      if (offline) {
        formInstance.setError('root.offline', { message: getText('unavailableOffline') })
      } else {
        formInstance.clearErrors('root.offline')
      }
    },
    { isDisabled: canSubmitOffline },
  )

  const submit = useEventCallback((event: React.FormEvent<HTMLFormElement> | null | undefined) => {
    event?.preventDefault()
    event?.stopPropagation()

    if (isOffline && !canSubmitOffline) {
      formInstance.setError('root.offline', { message: getText('unavailableOffline') })
      return Promise.resolve()
    } else {
      if (event) {
        return formOnSubmit(event)
      } else {
        return formOnSubmit()
      }
    }
  })

  const setFormError = useEventCallback((error: string) => {
    formInstance.setError('root.submit', { message: error })
  })

  const form: types.UseFormReturn<Schema, SubmitResult> = {
    ...formInstance,
    submit,
    control: { ...formInstance.control, register },
    register,
    schema: computedSchema,
    setFormError,
    handleSubmit: formInstance.handleSubmit,
    onSubmitFailed,
    onSubmitSuccess,
    onSubmitted,
    formProps: { onSubmit: submit, noValidate: true },
  }

  return form
}
