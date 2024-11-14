/** @file Commonly used functions for electron tests */

import { _electron, expect, type Page, test } from '@playwright/test'
import { TEXTS } from 'enso-common/src/text'

const LOADING_TIMEOUT = 10000
const TEXT = TEXTS.english

/**
 * Tests run on electron executable.
 *
 * Similar to playwright's test, but launches electron, and passes Page of the main window.
 */
export function electronTest(name: string, body: (page: Page) => Promise<void> | void) {
  test(name, async () => {
    const app = await _electron.launch({
      executablePath: process.env.ENSO_TEST_EXEC_PATH ?? '',
      args: process.env.ENSO_TEST_APP_ARGS != null ? process.env.ENSO_TEST_APP_ARGS.split(',') : [],
      env: { ...process.env, ['ENSO_TEST']: name },
    })
    const page = await app.firstWindow()
    // Wait until page will be finally loaded: we expect login screen.
    // There's bigger timeout, because the page may load longer on CI machines.
    await expect(page.getByText('Login to your account')).toBeVisible({ timeout: LOADING_TIMEOUT })
    await body(page)
    await app.close()
  })
}

/**
 * Login as test user. This function asserts that page is the login page, and uses
 * credentials from ENSO_TEST_USER and ENSO_TEST_USER_PASSWORD env variables.
 */
export async function loginAsTestUser(page: Page) {
  // Login screen
  await expect(page.getByRole('textbox', { name: 'email' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'password' })).toBeVisible()
  if (process.env.ENSO_TEST_USER == null || process.env.ENSO_TEST_USER_PASSWORD == null) {
    throw Error(
      'Cannot log in; `ENSO_TEST_USER` and `ENSO_TEST_USER_PASSWORD` env variables are not provided',
    )
  }
  await page.getByRole('textbox', { name: 'email' }).fill(process.env.ENSO_TEST_USER)
  await page.getByRole('textbox', { name: 'password' }).fill(process.env.ENSO_TEST_USER_PASSWORD)
  await page.getByTestId('form-submit-button').click()

  await page
    .getByRole('group', { name: TEXT.licenseAgreementCheckbox })
    .getByText(TEXT.licenseAgreementCheckbox)
    .click()
  await page
    .getByRole('group', { name: TEXT.privacyPolicyCheckbox })
    .getByText(TEXT.privacyPolicyCheckbox)
    .click()

  await page.getByTestId('form-submit-button').click()
}
