/** @file A modal with inputs for user email and permission level. */
import { useRef } from 'react'

import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import isEmail from 'validator/es/lib/isEmail'

import type { EmailAddress } from 'enso-common/src/services/Backend'
import { parseUserEmails } from 'enso-common/src/utilities/data/email'

import { Form, ResizableContentEditableInput } from '#/components/AriaComponents'
import { PaywallAlert } from '#/components/Paywall'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { usePaywall } from '#/hooks/billing'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useRemoteBackend } from '#/providers/BackendProvider'
import { useText } from '#/providers/TextProvider'

/** Props for an {@link InviteUsersForm}. */
export interface InviteUsersFormProps {
  readonly onSubmitted: (emails: EmailAddress[]) => void
}

/** A modal with inputs for user email and permission level. */
export function InviteUsersForm(props: InviteUsersFormProps) {
  const { onSubmitted } = props
  const { getText } = useText()
  const backend = useRemoteBackend()
  const inputRef = useRef<HTMLDivElement>(null)

  const { user } = useFullUserSession()
  const { isFeatureUnderPaywall } = usePaywall({ plan: user.plan })

  const inviteUserMutation = useMutation(
    backendMutationOptions(backend, 'inviteUser', {
      meta: { invalidates: [['listInvitations']], awaitInvalidates: true },
    }),
  )

  const { data: invitations } = useSuspenseQuery({
    queryKey: ['listInvitations'],
    queryFn: async () => backend.listInvitations(),
    select: (data) => ({
      count: data.invitations.length,
      availableLicenses: data.availableLicenses,
    }),
  })

  const isUnderPaywall = isFeatureUnderPaywall('inviteUserFull')
  const seatsLeft = invitations.availableLicenses

  const getEmailsFromInput = useEventCallback((value: string) => parseUserEmails(value))

  const highlightEmails = useEventCallback((value: string): void => {
    if (inputRef.current?.firstChild != null) {
      const trimValue = value.trim()
      const { entries } = getEmailsFromInput(value)

      if (typeof Highlight !== 'undefined') {
        CSS.highlights.delete('field-wrong-email')
      }

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

      if (typeof Highlight !== 'undefined') {
        CSS.highlights.set('field-wrong-email', new Highlight(...wrongEmailsRanges))
      }
    }
  })

  const validateEmailField = useEventCallback((value: string): string | null => {
    const { entries } = getEmailsFromInput(value)

    if (entries.length > seatsLeft) {
      return getText('inviteFormSeatsLeftError', entries.length - seatsLeft)
    } else {
      for (const entry of entries) {
        if (!isEmail(entry.email)) {
          return getText('emailIsInvalid')
        }
      }

      return null
    }
  })

  return (
    <Form
      formOptions={{ mode: 'onSubmit' }}
      schema={Form.schema.object({
        emails: Form.schema
          .string()
          .min(1, { message: getText('emailIsRequired') })
          .refine(
            (value) => {
              const result = validateEmailField(value)

              if (result != null) {
                highlightEmails(value)
              }

              return result == null
            },
            { message: getText('emailIsInvalid') },
          ),
      })}
      defaultValues={{ emails: '' }}
      onSubmit={async ({ emails }) => {
        // Add the email from the input field to the list of emails.
        const emailsToSubmit = Array.from(new Set(getEmailsFromInput(emails).entries))
          .map(({ email }) => email)
          .filter((value): value is EmailAddress => isEmail(value))

        await Promise.all(
          emailsToSubmit.map((userEmail) => inviteUserMutation.mutateAsync([{ userEmail }])),
        ).then(() => {
          onSubmitted(emailsToSubmit)
        })
      }}
    >
      <ResizableContentEditableInput
        ref={inputRef}
        name="emails"
        label={getText('inviteEmailFieldLabel')}
        placeholder={getText('inviteEmailFieldPlaceholder')}
        description={getText('inviteEmailFieldDescription')}
      />

      {isUnderPaywall && (
        <PaywallAlert feature="inviteUserFull" label={getText('inviteFormSeatsLeft', seatsLeft)} />
      )}

      <Form.Submit variant="accent" size="medium" fullWidth isDisabled={seatsLeft <= 0}>
        {getText('inviteSubmit')}
      </Form.Submit>

      <Form.FormError />
    </Form>
  )
}
