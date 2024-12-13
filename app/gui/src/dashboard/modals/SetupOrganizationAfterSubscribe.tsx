/** @file Modal for setting the organization name. */
import { useState } from 'react'

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'

import { Plan } from 'enso-common/src/services/Backend'

import { Button, Dialog, Form, Input } from '#/components/AriaComponents'
import { Result } from '#/components/Result'
import { Stepper } from '#/components/Stepper'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useAuth } from '#/providers/AuthProvider'
import { useRemoteBackend } from '#/providers/BackendProvider'
import { useText, type GetText } from '#/providers/TextProvider'

const PLANS_TO_SPECIFY_ORG_NAME = [Plan.team, Plan.enterprise]

/**
 * Modal for setting the organization name.
 * Shows up when the user is on the team plan and the organization name is the default.
 */
export function SetupOrganizationAfterSubscribe() {
  const { getText } = useText()

  const backend = useRemoteBackend()
  const { session } = useAuth()

  const user = session != null && 'user' in session ? session.user : null
  const userIsAdmin = user?.isOrganizationAdmin ?? false
  const userId = user?.userId ?? null
  const userPlan = user?.plan ?? Plan.free

  const { data: organizationName } = useSuspenseQuery({
    queryKey: ['organization', userId],
    queryFn: () => backend.getOrganization().catch(() => null),
    staleTime: Infinity,
    select: (data) => data?.name ?? '',
  })

  const { data: userGroupsCount } = useSuspenseQuery({
    queryKey: ['userGroups', userId],
    queryFn: () => backend.listUserGroups().catch(() => null),
    staleTime: Infinity,
    select: (data) => data?.length ?? 0,
  })

  const [hideModal, setHideModal] = useState(false)

  const queryClient = useQueryClient()
  const updateOrganization = useMutation(backendMutationOptions(backend, 'updateOrganization'))
  const createDefaultUserGroup = useMutation(backendMutationOptions(backend, 'createUserGroup'))

  const shouldSetOrgName = PLANS_TO_SPECIFY_ORG_NAME.includes(userPlan) && organizationName === ''
  const shouldSetDefaultUserGroup =
    PLANS_TO_SPECIFY_ORG_NAME.includes(userPlan) && userGroupsCount === 0

  const steps = [
    {
      title: getText('intro'),
      component: ({ nextStep }: { readonly nextStep: () => void }) => (
        <Result
          status="info"
          title={getText('setupOrganization')}
          subtitle={getText('setupOrganizationDescription')}
        >
          <Button onPress={nextStep} className="mx-auto">
            {getText('next')}
          </Button>
        </Result>
      ),
    } as const,
  ]

  if (shouldSetOrgName) {
    steps.push({
      title: getText('setOrgNameTitle'),
      component: ({ nextStep }) => (
        <SetOrganizationNameForm
          onSubmit={async (name) => {
            await updateOrganization.mutateAsync([{ name }])
            nextStep()
          }}
        />
      ),
    })
  }

  if (shouldSetDefaultUserGroup) {
    steps.push({
      title: getText('setDefaultUserGroup'),
      component: ({ nextStep }) => (
        <CreateUserGroupForm
          onSubmit={async (name) => {
            await createDefaultUserGroup.mutateAsync([{ name }])
            nextStep()
          }}
        />
      ),
    })
  }

  const shouldShowModal = steps.length > 1 && userIsAdmin && !hideModal

  const { stepperState } = Stepper.useStepperState({
    steps: steps.length,
    defaultStep: 0,
    onCompleted: () => {
      void queryClient.invalidateQueries({ queryKey: ['organization'] })
      void queryClient.invalidateQueries({ queryKey: ['userGroups'] })
      setHideModal(true)
    },
  })

  return (
    <>
      <Dialog
        title={getText('setupOrganization')}
        isDismissable={false}
        isKeyboardDismissDisabled
        hideCloseButton
        size="xxxlarge"
        padding="xlarge"
        modalProps={{ isOpen: shouldShowModal }}
      >
        <Stepper
          state={stepperState}
          renderStep={(props) => (
            <Stepper.Step {...props} title={steps[props.index]?.title ?? ''} />
          )}
        >
          {({ currentStep, nextStep }) => <>{steps[currentStep]?.component({ nextStep })}</>}
        </Stepper>
      </Dialog>

      <Outlet context={session} />
    </>
  )
}

/** Props for the SetOrganizationNameForm component. */
export interface SetOrganizationNameFormProps {
  readonly onSubmit: (name: string) => Promise<void>
}

export const ORGANIZATION_NAME_MAX_LENGTH = 64

// eslint-disable-next-line no-restricted-syntax
export const SET_ORGANIZATION_NAME_FORM_SCHEMA = (getText: GetText) =>
  Form.schema.object({
    name: Form.schema
      .string()
      .min(1, getText('arbitraryFieldRequired'))
      .max(ORGANIZATION_NAME_MAX_LENGTH, getText('arbitraryFieldTooLong')),
  })

/** Form for setting the organization name. */
export function SetOrganizationNameForm(props: SetOrganizationNameFormProps) {
  const { onSubmit } = props
  const { getText } = useText()

  return (
    <Form
      gap="medium"
      className="max-w-96"
      defaultValues={{ name: '' }}
      schema={SET_ORGANIZATION_NAME_FORM_SCHEMA(getText)}
      onSubmit={({ name }) => onSubmit(name)}
    >
      <Input
        name="name"
        autoFocus
        inputMode="text"
        autoComplete="off"
        label={getText('organizationNameSettingsInput')}
        description={getText(
          'organizationNameSettingsInputDescription',
          ORGANIZATION_NAME_MAX_LENGTH,
        )}
      />

      <Form.FormError />

      <Form.Submit />
    </Form>
  )
}

/** Props for the CreateUserGroupForm component. */
export interface CreateUserGroupFormProps {
  readonly onSubmit: (name: string) => Promise<void>
}

/** Form for creating a user group. */
export function CreateUserGroupForm(props: CreateUserGroupFormProps) {
  const { onSubmit } = props
  const { getText } = useText()

  const defaultUserGroupMaxLength = 64

  return (
    <Form
      schema={(z) => z.object({ groupName: z.string().min(1).max(defaultUserGroupMaxLength) })}
      gap="medium"
      className="max-w-96"
      defaultValues={{ groupName: '' }}
      onSubmit={({ groupName }) => onSubmit(groupName)}
    >
      <Input
        name="groupName"
        autoComplete="off"
        label={getText('groupNameSettingsInput')}
        description={getText('groupNameSettingsInputDescription', defaultUserGroupMaxLength)}
      />

      <Form.Submit />
    </Form>
  )
}
