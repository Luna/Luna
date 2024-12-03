/** @file Test the login flow. */
import { expect, test } from '@playwright/test'

import { locateDriveView, locateLoginButton, mockAll } from './actions'

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } })

test('login and logout', ({ page }) =>
  mockAll({ page })
    .login()
    .do(async (thePage) => {
      await expect(locateDriveView(thePage)).toBeVisible()
      await expect(locateLoginButton(thePage)).not.toBeVisible()
    })
    .openUserMenu()
    .userMenu.logout()
    .do(async (thePage) => {
      await expect(locateDriveView(thePage)).not.toBeVisible()
      await expect(locateLoginButton(thePage)).toBeVisible()
    }))
