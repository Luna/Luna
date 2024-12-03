/** @file Test the "change password" modal. */
import { expect, test } from '@playwright/test'

import { locateEditor, locateSamples, mockAllAndLogin } from './actions'

test('create project from template', ({ page }) =>
  mockAllAndLogin({ page })
    .openStartModal()
    .createProjectFromTemplate(0)
    .do(async (thePage) => {
      await expect(locateEditor(thePage)).toBeAttached()
      await expect(locateSamples(page).first()).not.toBeVisible()
    }))
