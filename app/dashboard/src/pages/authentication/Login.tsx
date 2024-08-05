/** @file Login component responsible for rendering and interactions in sign in flow. */
import * as router from 'react-router-dom'

import { CLOUD_DASHBOARD_DOMAIN } from 'enso-common'
import isEmail from 'validator/lib/isEmail'

import { FORGOT_PASSWORD_PATH, REGISTRATION_PATH } from '#/appUtils'
import CreateAccountIcon from '#/assets/create_account.svg'
import GithubIcon from '#/assets/github.svg'
import GoogleIcon from '#/assets/google.svg'
import { Button, Form, Input } from '#/components/AriaComponents'
import Link from '#/components/Link'
import AuthenticationPage from '#/pages/authentication/AuthenticationPage'
import { passwordSchema } from '#/pages/authentication/schemas'
import { useAuth } from '#/providers/AuthProvider'
import { useLocalBackend } from '#/providers/BackendProvider'
import { type GetText, useText } from '#/providers/TextProvider'
import { useMutation } from '@tanstack/react-query'

// =============
// === Login ===
// =============

/** A form for users to log in. */
export default function Login() {
  const location = router.useLocation()
  const auth = useAuth()
  const { getText } = useText()
  const query = new URLSearchParams(location.search)
  const initialEmail = query.get('email')
  const localBackend = useLocalBackend()
  const supportsOffline = localBackend != null

  const signInWithGoogleMutation = useMutation({ mutationFn: auth.signInWithGoogle })
  const signInWithGitHubMutation = useMutation({ mutationFn: auth.signInWithGitHub })
  const signInWithPasswordMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      auth.signInWithPassword(email, password),
  })
  const signInWithGoogle = signInWithGoogleMutation.mutateAsync
  const signInWithGitHub = signInWithGitHubMutation.mutateAsync
  const signInWithPassword = signInWithPasswordMutation.mutateAsync

  return (
    <AuthenticationPage
      title={getText('loginToYourAccount')}
      supportsOffline={supportsOffline}
      footer={
        <Link
          openInBrowser={localBackend != null}
          to={
            localBackend != null ?
              'https://' + CLOUD_DASHBOARD_DOMAIN + REGISTRATION_PATH
            : REGISTRATION_PATH
          }
          icon={CreateAccountIcon}
          text={getText('dontHaveAnAccount')}
        />
      }
    >
      <div className="flex flex-col gap-auth">
        <Button
          size="large"
          variant="outline"
          icon={GoogleIcon}
          onPress={async () => {
            await signInWithGoogle()
          }}
        >
          {getText('signUpOrLoginWithGoogle')}
        </Button>
        <Button
          size="large"
          variant="outline"
          icon={GithubIcon}
          onPress={async () => {
            await signInWithGitHub()
          }}
        >
          {getText('signUpOrLoginWithGitHub')}
        </Button>
      </div>

      <Form
        schema={(z) =>
          z.object({
            email: z
              .string()
              .min(1, getText('arbitraryFieldRequired'))
              .email(getText('invalidEmailValidationError')),
            password: passwordSchema(getText),
          })
        }
        gap="medium"
        onSubmit={(values) => signInWithPassword(values)}
      >
        <Input
          autoFocus
          required
          name="email"
          label={getText('email')}
          type="email"
          autoComplete="email"
          defaultValue={initialEmail ?? undefined}
          placeholder={getText('emailPlaceholder')}
        />

        <div className="flex w-full flex-col">
          <Input
            required
            label={getText('password')}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={getText('passwordPlaceholder')}
          />

          <Button variant="link" href={FORGOT_PASSWORD_PATH} size="small" className="self-end">
            {getText('forgotYourPassword')}
          </Button>
        </div>

        <Form.FormError />

        <Form.Submit className="w-full">{getText('login')}</Form.Submit>
      </Form>
    </AuthenticationPage>
  )
}
