/** @file Settings screen. */
import * as React from 'react'

import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'

import AccountSettingsTab from '#/layouts/dashboard/Settings/AccountSettingsTab'
import MembersSettingsTab from '#/layouts/dashboard/Settings/MembersSettingsTab'
import OrganizationSettingsTab from '#/layouts/dashboard/Settings/OrganizationSettingsTab'
import SettingsTab from '#/layouts/dashboard/Settings/SettingsTab'
import SettingsSidebar from '#/layouts/dashboard/SettingsSidebar'

import * as backendModule from '#/services/Backend'

// ================
// === Settings ===
// ================

/** Settings screen. */
export default function Settings() {
  const [settingsTab, setSettingsTab] = React.useState(SettingsTab.account)
  const { type: sessionType, user } = authProvider.useNonPartialUserSession()
  const { backend } = backendProvider.useBackend()
  const [organization, setOrganization] = React.useState<backendModule.OrganizationInfo>(() => ({
    pk: user?.id ?? backendModule.OrganizationId(''),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    organization_name: null,
    email: null,
    website: null,
    address: null,
    picture: null,
  }))

  React.useEffect(() => {
    void (async () => {
      if (
        sessionType === authProvider.UserSessionType.full &&
        backend.type === backendModule.BackendType.remote
      ) {
        const newOrganization = await backend.getOrganization()
        if (newOrganization != null) {
          setOrganization(newOrganization)
        }
      }
    })()
  }, [sessionType, backend])

  let content: JSX.Element
  switch (settingsTab) {
    case SettingsTab.account: {
      content = <AccountSettingsTab />
      break
    }
    case SettingsTab.organization: {
      content = (
        <OrganizationSettingsTab organization={organization} setOrganization={setOrganization} />
      )
      break
    }
    case SettingsTab.members: {
      content = <MembersSettingsTab />
      break
    }
    default: {
      // This case should be removed when all settings tabs are implemented.
      content = <></>
      break
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-2.5 font-bold text-xl h-9.5 px-4.75">
        <span className="py-0.5">Settings for </span>
        <div className="rounded-full leading-144.5 bg-frame h-9 px-2.25 pt-0.5 pb-1.25">
          {settingsTab !== SettingsTab.organization
            ? user?.name ?? 'your account'
            : organization.organization_name ?? 'your organization'}
        </div>
      </div>
      <div className="flex gap-8 pl-3">
        <SettingsSidebar settingsTab={settingsTab} setSettingsTab={setSettingsTab} />
        {content}
      </div>
    </div>
  )
}
