/** @file Setup page. */
import type { ComponentType } from 'react'

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import invariant from 'tiny-invariant'

import { Plan } from 'enso-common/src/services/Backend'
import type { TextId } from 'enso-common/src/text'

import { DASHBOARD_PATH, LOGIN_PATH } from '#/appUtils'
import ArrowRight from '#/assets/arrow_right.svg'
import { Button, ButtonGroup, Form, Input, Separator, Text } from '#/components/AriaComponents'
import Page from '#/components/Page'
import { Stepper, useStepperState } from '#/components/Stepper'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useIsFirstRender } from '#/hooks/mountHooks'
import { InviteUsersForm } from '#/modals/InviteUsersModal'
import { ORGANIZATION_NAME_MAX_LENGTH } from '#/modals/SetupOrganizationAfterSubscribe'
import { PlanSelector } from '#/modules/payments'
import { useAuth, UserSessionType, useUserSession } from '#/providers/AuthProvider'
import { useRemoteBackend } from '#/providers/BackendProvider'
import { useText } from '#/providers/TextProvider'

/** Step in the setup process */
interface Step {
  readonly title: TextId
  readonly description?: TextId
  readonly text?: TextId
  readonly component?: ComponentType<Context>
  readonly canSkip?: boolean | ((context: Context) => boolean)
  readonly hideNext?: boolean | ((context: Context) => boolean)
  readonly hidePrevious?: boolean | ((context: Context) => boolean)
  readonly ignore?: (context: Context) => boolean
}

/** Context for the setup process */
interface Context {
  readonly session: ReturnType<typeof useAuth>['session']
  readonly plan: Plan
  readonly goToNextStep: () => void
  readonly goToPreviousStep: () => void
}

const BASE_STEPS: Step[] = [
  {
    title: 'setUsername',
    text: 'setUsernameDescription',
    hideNext: true,
    /** Setup step for setting username. */
    component: function SetUsernameStep({ session, goToNextStep }) {
      const { setUsername } = useAuth()
      const userSession = useUserSession()
      const { getText } = useText()

      const isUserCreated = userSession?.type === UserSessionType.full
      const defaultName =
        session && 'user' in session ? session.user.name : userSession?.email ?? ''

      return (
        <Form
          className="max-w-96"
          schema={(z) =>
            z.object({
              username: z
                .string()
                .min(3)
                /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
                .max(48),
            })
          }
          defaultValues={{ username: defaultName }}
          onSubmit={async ({ username }) => {
            // If user is already created we shouldn't call `setUsername` if the value has not been
            // changed.
            if (username !== defaultName || !isUserCreated) {
              await setUsername(username)
            }
            goToNextStep()
          }}
        >
          <Input
            name="username"
            label={getText('userNameSettingsInput')}
            placeholder={getText('usernamePlaceholder')}
            description="Minimum 3 characters, maximum 48 characters"
          />

          <Form.Submit variant="primary">{getText('next')}</Form.Submit>

          <Form.FormError />
        </Form>
      )
    },
  },
  {
    title: 'choosePlan',
    text: 'choosePlanDescription',
    ignore: ({ session }) =>
      session && 'user' in session ? !session.user.isOrganizationAdmin : true,
    canSkip: ({ plan }) => plan === Plan.free,
    hideNext: ({ plan }) => plan === Plan.free,
    /** Setup step for choosing plan. */
    component: function ChoosePlanStep({ goToNextStep, plan, session }) {
      const isOrganizationAdmin =
        session && 'user' in session ? session.user.isOrganizationAdmin : false

      return (
        <PlanSelector
          userPlan={plan}
          isOrganizationAdmin={isOrganizationAdmin}
          hasTrial={plan === Plan.free}
          onSubscribeSuccess={goToNextStep}
        />
      )
    },
  },
  {
    title: 'setOrgNameTitle',
    text: 'setOrgNameDescription',
    ignore: (context) => {
      const isOrganizationAdmin =
        context.session && 'user' in context.session ?
          context.session.user.isOrganizationAdmin
        : false

      return context.plan === Plan.free || context.plan === Plan.solo || !isOrganizationAdmin
    },
    hideNext: true,
    hidePrevious: true,
    /** Setup step for setting organization name. */
    component: function SetOrganizationNameStep({ goToNextStep, goToPreviousStep, session }) {
      const { getText } = useText()
      const remoteBackend = useRemoteBackend()
      const userId = session && 'user' in session ? session.user.userId : null

      const { data: defaultOrgName } = useSuspenseQuery({
        queryKey: ['organization', userId],
        queryFn: () => remoteBackend.getOrganization(),
        select: (data) => data?.name ?? '',
      })

      const updateOrganizationMutation = useMutation(
        backendMutationOptions(remoteBackend, 'updateOrganization', {
          onSuccess: () => {
            goToNextStep()
          },
        }),
      )

      return (
        <Form
          schema={(z) =>
            z.object({ organizationName: z.string().min(1).max(ORGANIZATION_NAME_MAX_LENGTH) })
          }
          defaultValues={{ organizationName: defaultOrgName }}
          className="max-w-96"
          onSubmit={({ organizationName }) => {
            if (organizationName !== defaultOrgName) {
              return updateOrganizationMutation.mutateAsync([{ name: organizationName }])
            }
          }}
        >
          <Input
            name="organizationName"
            autoComplete="off"
            label={getText('organizationNameSettingsInput')}
            description={getText(
              'organizationNameSettingsInputDescription',
              ORGANIZATION_NAME_MAX_LENGTH,
            )}
          />

          <ButtonGroup align="start">
            <Button variant="outline" onPress={goToPreviousStep}>
              {getText('back')}
            </Button>

            <Form.Submit variant="primary">{getText('next')}</Form.Submit>
          </ButtonGroup>

          <Form.FormError />
        </Form>
      )
    },
  },
  {
    title: 'inviteUsers',
    text: 'inviteUsersDescription',
    ignore: (context) => {
      const isOrganizationAdmin =
        context.session && 'user' in context.session ?
          context.session.user.isOrganizationAdmin
        : false

      return context.plan === Plan.free || context.plan === Plan.solo || !isOrganizationAdmin
    },
    hideNext: true,
    hidePrevious: true,
    /** Setup step for inviting users to the organization. */
    component: function InviteUsersStep({ goToNextStep, goToPreviousStep }) {
      const { getText } = useText()

      return (
        <div className="max-w-96">
          <InviteUsersForm onSubmitted={goToNextStep} />

          <ButtonGroup align="start" className="mt-4">
            <Button variant="outline" onPress={goToPreviousStep}>
              {getText('back')}
            </Button>

            <Button variant="ghost-fading" onPress={goToNextStep}>
              {getText('skip')}
            </Button>
          </ButtonGroup>
        </div>
      )
    },
  },
  {
    title: 'setDefaultUserGroup',
    text: 'setDefaultUserGroupDescription',
    ignore: (context) => {
      const isOrganizationAdmin =
        context.session && 'user' in context.session ?
          context.session.user.isOrganizationAdmin
        : false

      return context.plan === Plan.free || context.plan === Plan.solo || !isOrganizationAdmin
    },
    hideNext: true,
    hidePrevious: true,
    /** Setup step for creating the first user group. */
    component: function CreateUserGroupStep({ goToNextStep, goToPreviousStep }) {
      const { getText } = useText()
      const remoteBackend = useRemoteBackend()

      const defaultUserGroupMaxLength = 64

      const listUsersQuery = useSuspenseQuery({
        queryKey: ['users'],
        queryFn: () => remoteBackend.listUsers(),
      })

      const changeUserGroupMutation = useMutation(
        backendMutationOptions(remoteBackend, 'changeUserGroup'),
      )

      const createUserGroupMutation = useMutation(
        backendMutationOptions(remoteBackend, 'createUserGroup', {
          onSuccess: async (result) => {
            await Promise.all([
              listUsersQuery.data.map((user) =>
                changeUserGroupMutation.mutateAsync([
                  user.userId,
                  { userGroups: [result.id] },
                  user.name,
                ]),
              ),
            ])

            goToNextStep()
          },
        }),
      )

      return (
        <Form
          schema={(z) => z.object({ groupName: z.string().min(1).max(defaultUserGroupMaxLength) })}
          className="max-w-96"
          onSubmit={({ groupName }) => createUserGroupMutation.mutateAsync([{ name: groupName }])}
        >
          <Input
            name="groupName"
            autoComplete="off"
            label={getText('groupNameSettingsInput')}
            description={getText('groupNameSettingsInputDescription', defaultUserGroupMaxLength)}
          />

          <ButtonGroup align="start">
            <Button variant="outline" onPress={goToPreviousStep}>
              {getText('back')}
            </Button>

            <Form.Submit variant="primary">{getText('next')}</Form.Submit>
          </ButtonGroup>

          <Form.FormError />
        </Form>
      )
    },
  },
  {
    title: 'allSet',
    text: 'allSetDescription',
    hideNext: true,
    hidePrevious: true,
    /** Final setup step. */
    component: function AllSetStep({ goToPreviousStep }) {
      const { getText } = useText()

      const navigate = useNavigate()
      const queryClient = useQueryClient()

      return (
        <ButtonGroup align="start">
          <Button variant="outline" onPress={goToPreviousStep}>
            {getText('back')}
          </Button>

          <Button
            variant="primary"
            size="medium"
            icon={ArrowRight}
            iconPosition="end"
            onPress={() =>
              queryClient.invalidateQueries().then(() => {
                navigate(
                  DASHBOARD_PATH +
                    '?' +
                    new URLSearchParams({ startModalDefaultOpen: 'true' }).toString(),
                )
              })
            }
          >
            {getText('goToDashboard')}
          </Button>
        </ButtonGroup>
      )
    },
  },
]

/** Setup page */
export function Setup() {
  const { getText } = useText()
  const { session } = useAuth()
  const isFirstRender = useIsFirstRender()

  const [searchParams] = useSearchParams()

  const userPlan = session && 'user' in session ? session.user.plan ?? Plan.free : Plan.free

  const steps = BASE_STEPS
  const isDebug = searchParams.get('__qd-debg__') === 'true'

  const { stepperState, nextStep, previousStep, currentStep } = useStepperState({
    steps: steps.length,
    onStepChange: (step, direction) => {
      const screen = steps[step]

      if (screen?.ignore != null) {
        if (
          screen.ignore({
            session,
            plan: userPlan,
            goToNextStep: nextStep,
            goToPreviousStep: previousStep,
          })
        ) {
          if (direction === 'forward') {
            nextStep()
          } else {
            previousStep()
          }
        }
      }
    },
  })

  const context = {
    session,
    plan: userPlan,
    goToNextStep: nextStep,
    goToPreviousStep: previousStep,
  }

  const currentScreen = steps.at(currentStep)

  invariant(currentScreen != null, 'Current screen not found')

  if (isFirstRender() && !isDebug) {
    if (session?.type === UserSessionType.full && currentStep === 0) {
      nextStep()
    }
  }

  if (session?.type !== UserSessionType.full && session?.type !== UserSessionType.partial) {
    return <Navigate to={LOGIN_PATH} />
  }

  const hideNext =
    typeof currentScreen.hideNext === 'function' ?
      currentScreen.hideNext(context)
    : currentScreen.hideNext ?? false
  const canSkip =
    typeof currentScreen.canSkip === 'function' ?
      currentScreen.canSkip(context)
    : currentScreen.canSkip ?? false
  const hidePrevious =
    typeof currentScreen.hidePrevious === 'function' ?
      currentScreen.hidePrevious(context)
    : currentScreen.hidePrevious ?? false

  return (
    <Page>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto my-24 w-full max-w-screen-xl px-8 py-6">
          <Text.Heading level="1" className="mb-4">
            {getText('setupEnso')}
          </Text.Heading>

          <Stepper
            state={stepperState}
            renderStep={(stepProps) => {
              const step = steps[stepProps.index]

              invariant(step != null, 'Step not found')

              return (
                <Stepper.Step
                  {...stepProps}
                  title={getText(step.title)}
                  description={step.description && getText(step.description)}
                  isDisabled={step.ignore?.(context) ?? false}
                >
                  {!stepProps.isLast && <Separator variant="current" />}
                </Stepper.Step>
              )
            }}
          >
            {({ isLast, isFirst }) => (
              <div className="flex w-full flex-col gap-6">
                {currentScreen.text && <Text>{getText(currentScreen.text)}</Text>}

                {currentScreen.component && <currentScreen.component {...context} />}

                <ButtonGroup align="start">
                  {isFirst || hidePrevious ? null : (
                    <Button variant="outline" onPress={previousStep}>
                      {getText('back')}
                    </Button>
                  )}

                  {canSkip && (
                    <Button variant="ghost" onPress={nextStep}>
                      {getText('skip')}
                    </Button>
                  )}

                  {!hideNext && !isLast && (
                    <Button variant="primary" onPress={nextStep}>
                      {getText('next')}
                    </Button>
                  )}
                </ButtonGroup>
              </div>
            )}
          </Stepper>
        </div>
      </div>
    </Page>
  )
}
