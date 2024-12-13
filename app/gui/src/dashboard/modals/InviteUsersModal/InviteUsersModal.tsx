/** @file A modal with inputs for user email and permission level. */
import { useState } from 'react'

import type { EmailAddress, OrganizationId } from 'enso-common/src/services/Backend'

import { Dialog, Popover } from '#/components/AriaComponents'
import { Stepper } from '#/components/Stepper'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { InviteUsersForm } from '#/modals/InviteUsersModal/InviteUsersForm'
import { InviteUsersSuccess } from '#/modals/InviteUsersModal/InviteUsersSuccess'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useText } from '#/providers/TextProvider'

/** Props for an {@link InviteUsersModal}. */
export interface InviteUsersModalProps {
  readonly relativeToTrigger?: boolean
}

/** A modal for inviting one or more users. */
export default function InviteUsersModal(props: InviteUsersModalProps) {
  const { relativeToTrigger = false } = props
  const { getText } = useText()
  const { user } = useFullUserSession()

  if (relativeToTrigger) {
    return (
      <Popover>
        <InviteUsersModalContent organizationId={user.organizationId} />
      </Popover>
    )
  } else {
    return (
      <Dialog title={getText('invite')}>
        {({ close }) => (
          <InviteUsersModalContent organizationId={user.organizationId} onClose={close} />
        )}
      </Dialog>
    )
  }
}

/** Props for the content of an {@link InviteUsersModal}. */
interface InviteUsersModalContentProps {
  readonly onClose?: () => void
  readonly organizationId: OrganizationId
}

/** The content of an {@link InviteUsersModal}. */
function InviteUsersModalContent(props: InviteUsersModalContentProps) {
  const { organizationId } = props

  const { stepperState, nextStep } = Stepper.useStepperState({
    steps: 2,
  })

  const [submittedEmails, setSubmittedEmails] = useState<string[]>([])
  const onInviteUsersFormInviteUsersFormSubmitted = useEventCallback((emails: EmailAddress[]) => {
    nextStep()
    setSubmittedEmails(emails)
  })

  const invitationParams = new URLSearchParams({
    // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
    organization_id: organizationId,
  }).toString()
  const invitationLink = `enso://auth/registration?${invitationParams}`

  return (
    <Stepper state={stepperState} renderStep={() => null}>
      <Stepper.StepContent index={0}>
        <InviteUsersForm onSubmitted={onInviteUsersFormInviteUsersFormSubmitted} />
      </Stepper.StepContent>

      <Stepper.StepContent index={1}>
        <InviteUsersSuccess {...props} invitationLink={invitationLink} emails={submittedEmails} />
      </Stepper.StepContent>
    </Stepper>
  )
}
