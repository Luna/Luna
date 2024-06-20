/** @file Settings section for viewing and editing account information. */
import * as React from 'react'

import * as backendHooks from '#/hooks/backendHooks'
import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as authProvider from '#/providers/AuthProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import SettingsInput from '#/components/styled/settings/SettingsInput'
import SettingsSection from '#/components/styled/settings/SettingsSection'

import type Backend from '#/services/Backend'

import * as object from '#/utilities/object'

// ==================================
// === UserAccountSettingsSection ===
// ==================================

/** Props for a {@link UserAccountSettingsSection}. */
export interface UserAccountSettingsSectionProps {
  readonly backend: Backend
}

/** Settings section for viewing and editing account information. */
export default function UserAccountSettingsSection(props: UserAccountSettingsSectionProps) {
  const { backend } = props
  const { setUser } = authProvider.useAuth()
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const { getText } = textProvider.useText()
  const nameRef = React.useRef<HTMLInputElement | null>(null)
  const user = backendHooks.useBackendUsersMe(backend)

  const updateUserMutation = backendHooks.useBackendMutation(backend, 'updateUser')

  const doUpdateName = async (newName: string) => {
    const oldName = user?.name ?? null
    if (newName === oldName) {
      return
    } else {
      try {
        await updateUserMutation.mutateAsync([{ username: newName }])
        setUser(object.merger({ name: newName }))
      } catch (error) {
        toastAndLog(null, error)
        const ref = nameRef.current
        if (ref) {
          ref.value = oldName ?? ''
        }
      }
      return
    }
  }

  return (
    <SettingsSection title={getText('userAccount')}>
      <div className="flex flex-col">
        <aria.TextField defaultValue={user?.name ?? ''} className="flex h-row gap-settings-entry">
          <aria.Label className="text my-auto w-user-account-settings-label">
            {getText('name')}
          </aria.Label>
          <SettingsInput key={user?.name ?? ''} ref={nameRef} type="text" onSubmit={doUpdateName} />
        </aria.TextField>
        <div className="flex h-row gap-settings-entry">
          <aria.Text className="text my-auto w-user-account-settings-label">
            {getText('email')}
          </aria.Text>
          <aria.Text className="settings-value my-auto grow font-bold">
            {user?.email ?? ''}
          </aria.Text>
        </div>
      </div>
    </SettingsSection>
  )
}
