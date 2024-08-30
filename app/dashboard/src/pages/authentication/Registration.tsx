/** @file Registration container responsible for rendering and interactions in sign up flow. */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import * as z from 'zod'

import { LOGIN_PATH } from '#/appUtils'
import AtIcon from '#/assets/at.svg'
import CreateAccountIcon from '#/assets/create_account.svg'
import GoBackIcon from '#/assets/go_back.svg'
import LockIcon from '#/assets/lock.svg'
import { Input as AriaInput } from '#/components/aria'
import { Alert, Button, Form, Input, Password, Text } from '#/components/AriaComponents'
import Link from '#/components/Link'
import { Stepper, useStepperState } from '#/components/Stepper'
import {
  latestPrivacyPolicyQueryOptions,
  latestTermsOfServiceQueryOptions,
} from '#/modals/AgreementsModal'
import AuthenticationPage from '#/pages/authentication/AuthenticationPage'
import { passwordWithPatternSchema } from '#/pages/authentication/schemas'
import { useAuth } from '#/providers/AuthProvider'
import { useLocalBackend } from '#/providers/BackendProvider'
import { useLocalStorage } from '#/providers/LocalStorageProvider'
import { useText } from '#/providers/TextProvider'
import LocalStorage from '#/utilities/LocalStorage'
import { twMerge } from '#/utilities/tailwindMerge'
import { PASSWORD_REGEX } from '#/utilities/validation'
import { useSuspenseQuery } from '@tanstack/react-query'
import { omit } from 'enso-common/src/utilities/data/object'
import { useEventCallback } from '../../hooks/eventCallbackHooks'

// ============================
// === Global configuration ===
// ============================

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly loginRedirect: string
  }
}

LocalStorage.registerKey('loginRedirect', {
  isUserSpecific: true,
  schema: z.string(),
})

const CONFIRM_SIGN_IN_INTERVAL = 5_000

// ====================
// === Registration ===
// ====================

/** A form for users to register an account. */
export default function Registration() {
  const { signUp, confirmSignUp, signInWithPassword } = useAuth()

  const location = useLocation()
  const navigate = useNavigate()
  const { localStorage } = useLocalStorage()
  const { getText } = useText()
  const localBackend = useLocalBackend()
  const supportsOffline = localBackend != null

  const query = new URLSearchParams(location.search)
  const initialEmail = query.get('email')
  const organizationId = query.get('organization_id')
  const redirectTo = query.get('redirect_to')
  const [isManualCodeEntry, setIsManualCodeEntry] = useState(false)

  const signupForm = Form.useForm({
    schema: (schema) =>
      schema
        .object({
          email: Form.schema.string().email(getText('invalidEmailValidationError')),
          password: passwordWithPatternSchema(getText),
          confirmPassword: Form.schema.string(),
          agreedToTos: z
            .boolean()
            .refine((value) => value, getText('licenseAgreementCheckboxError')),
          agreedToPrivacyPolicy: z
            .boolean()
            .refine((value) => value, getText('privacyPolicyCheckboxError')),
        })
        .superRefine((object, context) => {
          if (PASSWORD_REGEX.test(object.password) && object.password !== object.confirmPassword) {
            context.addIssue({
              path: ['confirmPassword'],
              code: 'custom',
              message: getText('passwordMismatchError'),
            })
          }
        }),
  })

  const { stepperState } = useStepperState({ steps: 2, defaultStep: 0 })

  const cachedTosHash = localStorage.get('termsOfService')?.versionHash
  const { data: tosHash } = useSuspenseQuery({
    ...latestTermsOfServiceQueryOptions,
    // If the user has already accepted the EULA, we don't need to
    // block user interaction with the app while we fetch the latest version.
    // We can use the local version hash as the initial data.
    // and refetch in the background to check for updates.
    ...(cachedTosHash != null && {
      initialData: { hash: cachedTosHash },
    }),
    select: (data) => data.hash,
  })
  const cachedPrivacyPolicyHash = localStorage.get('privacyPolicy')?.versionHash
  const { data: privacyPolicyHash } = useSuspenseQuery({
    ...latestPrivacyPolicyQueryOptions,
    ...(cachedPrivacyPolicyHash != null && {
      initialData: { hash: cachedPrivacyPolicyHash },
    }),
    select: (data) => data.hash,
  })

  useEffect(() => {
    if (redirectTo != null) {
      localStorage.set('loginRedirect', redirectTo)
    } else {
      localStorage.delete('loginRedirect')
    }
  }, [localStorage, redirectTo])

  const trySignIn = useEventCallback(() => {
    const email = signupForm.getValues('email')
    const password = signupForm.getValues('password')

    return signInWithPassword(email, password)
  })

  useEffect(() => {
    if (stepperState.currentStep === 1) {
      const interval = setInterval(() => {
        void trySignIn().catch(() => {})
      }, CONFIRM_SIGN_IN_INTERVAL)

      return () => {
        clearInterval(interval)
      }
    } else {
      return
    }
  }, [stepperState.currentStep, trySignIn])

  return (
    <AuthenticationPage
      supportsOffline={supportsOffline}
      footer={
        <Link
          to={LOGIN_PATH}
          onPress={() => {
            navigate(
              LOGIN_PATH +
                `?${new URLSearchParams({ email: signupForm.getValues('email') }).toString()}`,
            )
          }}
          icon={GoBackIcon}
          text={getText('alreadyHaveAnAccount')}
        />
      }
    >
      <Stepper state={stepperState} renderStep={() => null}>
        {stepperState.currentStep === 0 && (
          <>
            <Text.Heading level={1} balance className="mb-4 text-center">
              {getText('createANewAccount')}
            </Text.Heading>

            <Form
              form={signupForm}
              onSubmit={({ email, password }) => {
                localStorage.set('termsOfService', { versionHash: tosHash })
                localStorage.set('privacyPolicy', { versionHash: privacyPolicyHash })

                return signUp(email, password, organizationId).then(() => {
                  stepperState.nextStep()
                })
              }}
            >
              {({ register }) => (
                <>
                  <Input
                    autoFocus
                    required
                    data-testid="email-input"
                    name="email"
                    label={getText('emailLabel')}
                    type="email"
                    autoComplete="email"
                    icon={AtIcon}
                    placeholder={getText('emailPlaceholder')}
                    defaultValue={initialEmail ?? undefined}
                  />
                  <Password
                    required
                    data-testid="password-input"
                    name="password"
                    label={getText('passwordLabel')}
                    autoComplete="new-password"
                    icon={LockIcon}
                    placeholder={getText('passwordPlaceholder')}
                    description={getText('passwordValidationMessage')}
                  />
                  <Password
                    required
                    data-testid="confirm-password-input"
                    name="confirmPassword"
                    label={getText('confirmPasswordLabel')}
                    autoComplete="new-password"
                    icon={LockIcon}
                    placeholder={getText('confirmPasswordPlaceholder')}
                  />

                  <Form.Field name="agreedToTos">
                    {({ isInvalid }) => (
                      <>
                        <label className="flex w-full items-center gap-1">
                          <AriaInput
                            type="checkbox"
                            className={twMerge(
                              'flex size-4 cursor-pointer overflow-clip rounded-lg border border-primary outline-primary focus-visible:outline focus-visible:outline-2',
                              isInvalid && 'border-red-700 text-red-500 outline-red-500',
                            )}
                            data-testid="terms-of-service-checkbox"
                            {...omit(register('agreedToTos'), 'isInvalid')}
                          />

                          <Text>{getText('licenseAgreementCheckbox')}</Text>
                        </label>

                        <Button
                          variant="link"
                          target="_blank"
                          href="https://ensoanalytics.com/eula"
                        >
                          {getText('viewLicenseAgreement')}
                        </Button>
                      </>
                    )}
                  </Form.Field>

                  <Form.Field name="agreedToPrivacyPolicy">
                    {({ isInvalid }) => (
                      <>
                        <label className="flex w-full items-center gap-1">
                          <AriaInput
                            type="checkbox"
                            className={twMerge(
                              'flex size-4 cursor-pointer overflow-clip rounded-lg border border-primary outline-primary focus-visible:outline focus-visible:outline-2',
                              isInvalid && 'border-red-700 text-red-500 outline-red-500',
                            )}
                            data-testid="privacy-policy-checkbox"
                            {...omit(register('agreedToPrivacyPolicy'), 'isInvalid')}
                          />

                          <Text>{getText('privacyPolicyCheckbox')}</Text>
                        </label>

                        <Button
                          variant="link"
                          target="_blank"
                          href="https://ensoanalytics.com/privacy"
                        >
                          {getText('viewPrivacyPolicy')}
                        </Button>
                      </>
                    )}
                  </Form.Field>

                  <Form.Submit size="large" icon={CreateAccountIcon} fullWidth>
                    {getText('register')}
                  </Form.Submit>

                  <Form.FormError />
                </>
              )}
            </Form>
          </>
        )}
        {stepperState.currentStep === 1 && (
          <>
            <Text.Heading level={1} balance className="mb-4 text-center">
              {getText('confirmRegistration')}
            </Text.Heading>

            <div className="flex flex-col gap-4 text-start">
              <div className="flex flex-col">
                <Text disableLineHeightCompensation>
                  {getText('confirmRegistrationInstruction')}
                </Text>
                <ul>
                  <li>
                    <Text disableLineHeightCompensation>
                      {getText('confirmRegistrationMethod1')}
                    </Text>
                  </li>
                  <li>
                    <Text disableLineHeightCompensation>
                      {getText('confirmRegistrationMethod2')}
                    </Text>
                  </li>
                </ul>
              </div>

              <Alert variant="neutral">
                <Text>{getText('confirmRegistrationSpam')}</Text>
              </Alert>

              {!isManualCodeEntry && (
                <Button
                  variant="outline"
                  onPress={() => {
                    setIsManualCodeEntry(true)
                  }}
                >
                  {getText('enterCodeManually')}
                </Button>
              )}

              {isManualCodeEntry && (
                <Form
                  schema={(schema) =>
                    schema.object({ verificationCode: Form.schema.string().min(1) })
                  }
                  onSubmit={async ({ verificationCode }) => {
                    const email = signupForm.getValues('email')
                    const password = signupForm.getValues('password')

                    return confirmSignUp(email, verificationCode).then(() =>
                      signInWithPassword(email, password),
                    )
                  }}
                >
                  <Input
                    name="verificationCode"
                    label={getText('confirmRegistrationVerificationCodeLabel')}
                  />

                  <Form.Submit fullWidth />

                  <Form.FormError />
                </Form>
              )}
            </div>
          </>
        )}
      </Stepper>
    </AuthenticationPage>
  )
}
