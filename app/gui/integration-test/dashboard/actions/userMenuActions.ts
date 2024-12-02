/** @file Actions for the user menu. */
import type * as test from 'playwright/test'

import type * as baseActions from './BaseActions'
import type BaseActions from './BaseActions'
import LoginPageActions from './LoginPageActions'
import SettingsPageActions from './SettingsPageActions'

/** Actions for the user menu. */
export interface UserMenuActions<T extends BaseActions<Context>, Context> {
  readonly downloadApp: (callback: (download: test.Download) => Promise<void> | void) => T
  readonly settings: () => SettingsPageActions<Context>
  readonly logout: () => LoginPageActions<Context>
  readonly goToLoginPage: () => LoginPageActions<Context>
}

/** Generate actions for the user menu. */
export function userMenuActions<T extends BaseActions<Context>, Context>(
  step: (name: string, callback: baseActions.PageCallback<Context>) => T,
): UserMenuActions<T, Context> {
  return {
    downloadApp: (callback: (download: test.Download) => Promise<void> | void) =>
      step('Download app (user menu)', async (page) => {
        const downloadPromise = page.waitForEvent('download')
        await page.getByRole('button', { name: 'Download App' }).getByText('Download App').click()
        await callback(await downloadPromise)
      }),
    settings: () =>
      step('Go to Settings (user menu)', async (page) => {
        await page.getByRole('button', { name: 'Settings' }).getByText('Settings').click()
      }).into(SettingsPageActions<Context>),
    logout: () =>
      step('Logout (user menu)', (page) =>
        page.getByRole('button', { name: 'Logout' }).getByText('Logout').click(),
      ).into(LoginPageActions<Context>),
    goToLoginPage: () =>
      step('Login (user menu)', (page) =>
        page.getByRole('button', { name: 'Login', exact: true }).getByText('Login').click(),
      ).into(LoginPageActions<Context>),
  }
}
