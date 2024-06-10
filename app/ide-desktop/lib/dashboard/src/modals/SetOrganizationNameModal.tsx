/**
 * @file
 *
 * Modal for setting the organization name.
 */
import * as React from 'react'

import * as reactQuery from '@tanstack/react-query'
import clsx from 'clsx'
import * as router from 'react-router'

import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'

import * as backendModule from '#/services/Backend'

const PLANS_TO_SPECIFY_ORG_NAME = [backendModule.Plan.team, backendModule.Plan.enterprise]

/**
 * Modal for setting the organization name.
 * Shows up when the user is on the team plan and the organization name is the default.
 */
export function SetOrganizationNameModal() {
  const { getText } = textProvider.useText()

  const { backend } = backendProvider.useStrictBackend()
  const { session } = authProvider.useAuth()

  const userId = session && 'user' in session && session.user?.userId ? session.user.userId : null
  const userPlan =
    session && 'user' in session && session.user?.plan != null ? session.user.plan : null

  const { data: organizationName } = reactQuery.useSuspenseQuery({
    queryKey: ['organization', userId],
    queryFn: () => {
      if (backend.type === backendModule.BackendType.remote) {
        return backend.getOrganization().catch(() => null)
      } else {
        return null
      }
    },
    staleTime: Infinity,
    select: data => data?.name ?? '',
  })

  const submit = reactQuery.useMutation({
    mutationKey: ['organization', userId],
    mutationFn: (name: string) => backend.updateOrganization({ name }),
    meta: { invalidates: [['organization', userId]], awaitInvalidates: true },
  })

  const shouldShowModal =
    userPlan != null && PLANS_TO_SPECIFY_ORG_NAME.includes(userPlan) && organizationName === ''

  return (
    <>
      <ariaComponents.Dialog
        title={getText('setOrgNameTitle')}
        isDismissable={false}
        isKeyboardDismissDisabled
        hideCloseButton
        modalProps={{ isOpen: shouldShowModal }}
      >
        <ariaComponents.Form
          gap="medium"
          defaultValues={{ organization: '' }}
          schema={ariaComponents.Form.useFormSchema(z =>
            z.object({
              organization: z
                .string()
                .min(1, getText('arbitraryFieldRequired'))
                // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                .max(255, getText('arbitraryFieldTooLong')),
            })
          )}
          onSubmit={({ organization }) => submit.mutateAsync(organization)}
        >
          {({ register, formState }) => {
            return (
              <>
                <aria.TextField
                  autoFocus
                  inputMode="text"
                  autoComplete="off"
                  className="flex w-full flex-col"
                  {...register('organization')}
                >
                  <aria.Label className="mb-1 ml-0.5 block text-sm">
                    {getText('organization')}
                  </aria.Label>

                  <aria.Input
                    className={values =>
                      clsx('rounded-md border border-gray-300 p-1.5 text-sm transition-[outline]', {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'outline outline-2 outline-primary':
                          values.isFocused || values.isFocusVisible,
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'border-red-500 outline-red-500': values.isInvalid,
                      })
                    }
                  />

                  <aria.FieldError className="text-sm text-red-500">
                    {formState.errors.organization?.message}
                  </aria.FieldError>
                </aria.TextField>

                <ariaComponents.Form.FormError />

                <ariaComponents.Form.Submit />
              </>
            )
          }}
        </ariaComponents.Form>
      </ariaComponents.Dialog>

      <router.Outlet context={session} />
    </>
  )
}
