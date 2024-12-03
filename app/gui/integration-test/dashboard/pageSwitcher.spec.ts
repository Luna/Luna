/** @file Test the login flow. */
import { expect, test } from '@playwright/test'

import { locateDriveView, locateEditor, mockAllAndLogin } from './actions'

test('page switcher', ({ page }) =>
  mockAllAndLogin({ page })
    // Create a new project so that the editor page can be switched to.
    .newEmptyProject()
    .do(async (thePage) => {
      await expect(locateDriveView(thePage)).not.toBeVisible()
      await expect(locateEditor(thePage)).toBeVisible()
    })
    .goToPage.drive()
    .do(async (thePage) => {
      await expect(locateDriveView(thePage)).toBeVisible()
      await expect(locateEditor(thePage)).not.toBeVisible()
    })
    .goToPage.editor()
    .do(async (thePage) => {
      await expect(locateDriveView(thePage)).not.toBeVisible()
      await expect(locateEditor(thePage)).toBeVisible()
    }))
