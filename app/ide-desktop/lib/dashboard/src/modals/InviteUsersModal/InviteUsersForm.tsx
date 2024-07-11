/** @file A modal with inputs for user email and permission level. */
import * as React from 'react'

import * as reactQuery from '@tanstack/react-query'
import isEmail from 'validator/es/lib/isEmail'

import * as backendHooks from '#/hooks/backendHooks'
import * as billingHooks from '#/hooks/billing'
import * as eventCallbackHooks from '#/hooks/eventCallbackHooks'

import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'
import * as textProvider from '#/providers/TextProvider'

import * as ariaComponents from '#/components/AriaComponents'
import * as paywallComponents from '#/components/Paywall'

import type * as backendModule from '#/services/Backend'

import * as parserUserEmails from '#/utilities/parseUserEmails'

// =======================
// === InviteUsersForm ===
// =======================

/** Props for an {@link InviteUsersForm}. */
export interface InviteUsersFormProps {
  readonly onSubmitted: (emails: backendModule.EmailAddress[]) => void
  readonly organizationId: backendModule.OrganizationId
}

/** A modal with inputs for user email and permission level. */
export function InviteUsersForm(props: InviteUsersFormProps) {
  const { onSubmitted, organizationId } = props
  const { getText } = textProvider.useText()
  const backend = backendProvider.useRemoteBackendStrict()
  const inputRef = React.useRef<HTMLDivElement>(null)

  const { user } = authProvider.useFullUserSession()
  const { isFeatureUnderPaywall, getFeature } = billingHooks.usePaywall({ plan: user.plan })

  const inviteUserMutation = backendHooks.useBackendMutation(backend, 'inviteUser', {
    meta: { invalidates: [['listInvitations']], awaitInvalidates: true },
  })

  const [{ data: usersCount }, { data: invitationsCount }] = reactQuery.useSuspenseQueries({
    queries: [
      {
        queryKey: ['listInvitations'],
        queryFn: async () => backend.listInvitations(),
        select: (invitations: readonly backendModule.Invitation[]) => invitations.length,
      },
      {
        queryKey: ['listUsers'],
        queryFn: async () => backend.listUsers(),
        select: (users: readonly backendModule.User[]) => users.length,
      },
    ],
  })

  const isUnderPaywall = isFeatureUnderPaywall('inviteUserFull')
  const feature = getFeature('inviteUser')

  const seatsLeft = isUnderPaywall
    ? Math.max(feature.meta.maxSeats - (usersCount + invitationsCount), 0)
    : Infinity

  const getEmailsFromInput = eventCallbackHooks.useEventCallback((value: string) =>
    parserUserEmails.parseUserEmails(value)
  )

  const highlightEmails = eventCallbackHooks.useEventCallback((value: string): void => {
    if (inputRef.current?.firstChild != null) {
      const trimValue = value.trim()
      const { entries } = getEmailsFromInput(value)

      // We wrap the code in a try-catch block to prevent the app from crashing
      // if the browser does not support the CSS.highlights API.
      // Currently, only Firefox doesn't support it.
      try {
        CSS.highlights.delete('field-wrong-email')

        let offset = 0

        const wrongEmailsRanges: Range[] = []

        for (const entry of entries) {
          const emailIndex = trimValue.indexOf(entry.email, offset)

          const range = new Range()
          range.setStart(inputRef.current.firstChild, emailIndex)
          range.setEnd(inputRef.current.firstChild, emailIndex + entry.email.length)

          if (!isEmail(entry.email)) {
            wrongEmailsRanges.push(range)
          }

          offset = emailIndex + entry.email.length
        }

        CSS.highlights.set('field-wrong-email', new Highlight(...wrongEmailsRanges))
      } catch (error) {
        // ignore error
      }
    }
  })

  const validateEmailField = eventCallbackHooks.useEventCallback((value: string): string | null => {
    const { entries } = getEmailsFromInput(value)

    if (entries.length > seatsLeft) {
      return getText('inviteFormSeatsLeftError', entries.length - seatsLeft)
    } else {
      for (const entry of entries) {
        if (!isEmail(entry.email)) {
          // eslint-disable-next-line no-restricted-syntax
          return getText('emailIsInvalid')
        }
      }

      return null
    }
  })

  return (
    <ariaComponents.Form
      formOptions={{ mode: 'onSubmit' }}
      schema={ariaComponents.Form.schema.object({
        emails: ariaComponents.Form.schema
          .string()
          .min(1, { message: getText('emailIsRequired') })
          .refine(
            value => {
              const result = validateEmailField(value)

              if (result != null) {
                highlightEmails(value)
              }

              return result == null
            },
            { message: getText('emailIsInvalid') }
          ),
      })}
      defaultValues={{ emails: '' }}
      onSubmit={async ({ emails }) => {
        // Add the email from the input field to the list of emails.
        const emailsToSubmit = Array.from(new Set(getEmailsFromInput(emails).entries))
          .map(({ email }) => email)
          .filter((value): value is backendModule.EmailAddress => isEmail(value))

        await Promise.all(
          emailsToSubmit.map(userEmail =>
            inviteUserMutation.mutateAsync([{ userEmail, organizationId }])
          )
        ).then(() => {
          onSubmitted(emailsToSubmit)
        })
      }}
    >
      <ariaComponents.Text disableLineHeightCompensation>
        {getText('inviteFormDescription')}
      </ariaComponents.Text>

      <ariaComponents.ResizableContentEditableInput
        ref={inputRef}
        name="emails"
        aria-label={getText('inviteEmailFieldLabel')}
        placeholder={getText('inviteEmailFieldPlaceholder')}
        description={getText('inviteEmailFieldDescription')}
      />

      {isUnderPaywall && (
        <paywallComponents.PaywallAlert
          feature="inviteUserFull"
          label={getText('inviteFormSeatsLeft', seatsLeft)}
        />
      )}

      <ariaComponents.Form.Submit variant="tertiary" rounded="medium" size="medium" fullWidth>
        {getText('inviteSubmit')}
      </ariaComponents.Form.Submit>

      <ariaComponents.Form.FormError />
    </ariaComponents.Form>
  )
}
