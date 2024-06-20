/** @file Settings tab for viewing and editing account information. */
import * as React from 'react'

import isEmail from 'validator/lib/isEmail'

import * as backendHooks from '#/hooks/backendHooks'
import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import SettingsInput from '#/components/styled/settings/SettingsInput'
import SettingsSection from '#/components/styled/settings/SettingsSection'

import * as backendModule from '#/services/Backend'
import type Backend from '#/services/Backend'

// ===================================
// === OrganizationSettingsSection ===
// ===================================

/** Props for a {@link OrganizationSettingsSection}. */
export interface OrganizationSettingsSectionProps {
  readonly backend: Backend
}

/** Settings tab for viewing and editing organization information. */
export default function OrganizationSettingsSection(props: OrganizationSettingsSectionProps) {
  const { backend } = props
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const { getText } = textProvider.useText()
  const nameRef = React.useRef<HTMLInputElement | null>(null)
  const emailRef = React.useRef<HTMLInputElement | null>(null)
  const websiteRef = React.useRef<HTMLInputElement | null>(null)
  const locationRef = React.useRef<HTMLInputElement | null>(null)
  const organization = backendHooks.useBackendGetOrganization(backend)

  const updateOrganizationMutation = backendHooks.useBackendMutation(backend, 'updateOrganization')

  const doUpdateName = async () => {
    const oldName = organization?.name ?? null
    const name = nameRef.current?.value ?? ''
    if (oldName !== name) {
      try {
        await updateOrganizationMutation.mutateAsync([{ name }])
      } catch (error) {
        toastAndLog(null, error)
        const ref = nameRef.current
        if (ref) {
          ref.value = oldName ?? ''
        }
      }
    }
  }

  const doUpdateEmail = async () => {
    const oldEmail = organization?.email ?? null
    const email = backendModule.EmailAddress(emailRef.current?.value ?? '')
    if (oldEmail !== email) {
      try {
        await updateOrganizationMutation.mutateAsync([{ email }])
      } catch (error) {
        toastAndLog(null, error)
        const ref = emailRef.current
        if (ref) {
          ref.value = oldEmail ?? ''
        }
      }
    }
  }

  const doUpdateWebsite = async () => {
    const oldWebsite = organization?.website ?? null
    const website = backendModule.HttpsUrl(websiteRef.current?.value ?? '')
    if (oldWebsite !== website) {
      try {
        await updateOrganizationMutation.mutateAsync([{ website }])
      } catch (error) {
        toastAndLog(null, error)
        const ref = websiteRef.current
        if (ref) {
          ref.value = oldWebsite ?? ''
        }
      }
    }
  }

  const doUpdateLocation = async () => {
    const oldLocation = organization?.address ?? null
    const location = locationRef.current?.value ?? ''
    if (oldLocation !== location) {
      try {
        await updateOrganizationMutation.mutateAsync([{ address: location }])
      } catch (error) {
        toastAndLog(null, error)
        const ref = locationRef.current
        if (ref) {
          ref.value = oldLocation ?? ''
        }
      }
    }
  }

  return (
    <SettingsSection title={getText('organization')}>
      <div key={JSON.stringify(organization)} className="flex flex-col">
        <aria.TextField
          key={organization?.name ?? 0}
          defaultValue={organization?.name ?? ''}
          validate={name => (/\S/.test(name) ? true : '')}
          className="flex h-row gap-settings-entry"
        >
          <aria.Label className="text my-auto w-organization-settings-label">
            {getText('organizationDisplayName')}
          </aria.Label>
          <SettingsInput
            key={organization?.name}
            ref={nameRef}
            type="text"
            onSubmit={doUpdateName}
          />
        </aria.TextField>
        <aria.TextField
          key={organization?.email ?? 1}
          defaultValue={organization?.email ?? ''}
          validate={email => (isEmail(email) ? true : getText('invalidEmailValidationError'))}
          className="flex h-row items-start gap-settings-entry"
        >
          <aria.Label className="text my-auto w-organization-settings-label">
            {getText('email')}
          </aria.Label>
          <div className="flex grow flex-col">
            <SettingsInput
              key={organization?.email}
              ref={emailRef}
              type="text"
              onSubmit={value => {
                if (isEmail(value)) {
                  void doUpdateEmail()
                } else {
                  emailRef.current?.focus()
                }
              }}
              onChange={() => {
                emailRef.current?.setCustomValidity(
                  isEmail(emailRef.current.value) ? '' : 'Invalid email.'
                )
              }}
            />
            <aria.FieldError className="text-red-700" />
          </div>
        </aria.TextField>
        <aria.TextField
          key={organization?.website ?? 2}
          defaultValue={organization?.website ?? ''}
          className="flex h-row gap-settings-entry"
        >
          <aria.Label className="text my-auto w-organization-settings-label">
            {getText('website')}
          </aria.Label>
          <SettingsInput
            key={organization?.website}
            ref={websiteRef}
            type="text"
            onSubmit={doUpdateWebsite}
          />
        </aria.TextField>
        <aria.TextField
          key={organization?.address ?? 3}
          defaultValue={organization?.address ?? ''}
          className="flex h-row gap-settings-entry"
        >
          <aria.Label className="text my-auto w-organization-settings-label">
            {getText('location')}
          </aria.Label>
          <SettingsInput
            ref={locationRef}
            key={organization?.address}
            type="text"
            onSubmit={doUpdateLocation}
          />
        </aria.TextField>
      </div>
    </SettingsSection>
  )
}
