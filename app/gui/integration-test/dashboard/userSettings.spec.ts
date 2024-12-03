/** @file Test the user settings tab. */
import * as test from '@playwright/test'

import * as actions from './actions'

const NEW_USERNAME = 'another user-name'
const NEW_PASSWORD = '1234!' + actions.VALID_PASSWORD
const PROFILE_PICTURE_FILENAME = 'foo.png'
const PROFILE_PICTURE_CONTENT = 'a profile picture'
const PROFILE_PICTURE_MIMETYPE = 'image/png'

test.test('user settings', ({ page }) =>
  actions
    .mockAllAndLogin({ page })
    .do((_, { api }) => {
      test.expect(api.currentUser()?.name).toBe(api.defaultName)
    })
    .goToPage.settings()
    .accountForm()
    .fillName(NEW_USERNAME)
    .save()
    .do((_, { api }) => {
      test.expect(api.currentUser()?.name).toBe(NEW_USERNAME)
      test.expect(api.currentOrganization()?.name).not.toBe(NEW_USERNAME)
    }),
)

test.test('change password form', ({ page }) =>
  actions
    .mockAllAndLogin({ page })
    .do((_, { api }) => {
      test.expect(api.currentPassword()).toBe(actions.VALID_PASSWORD)
    })
    .goToPage.settings()
    .changePasswordForm()
    .fillCurrentPassword(actions.VALID_PASSWORD)
    .fillNewPassword(actions.INVALID_PASSWORD)
    .fillConfirmNewPassword(actions.INVALID_PASSWORD)
    .save()
    .step('Invalid new password should fail', async (page) => {
      await test
        .expect(
          page
            .getByRole('group', { name: /^New password/, exact: true })
            .locator('.text-danger')
            .last(),
        )
        .toHaveText(actions.TEXT.passwordValidationError)
    })
    .changePasswordForm()
    .fillCurrentPassword(actions.VALID_PASSWORD)
    .fillNewPassword(actions.VALID_PASSWORD)
    .fillConfirmNewPassword(actions.VALID_PASSWORD + 'a')
    .save()
    .step('Invalid new password confirmation should fail', async (page) => {
      await test
        .expect(
          page
            .getByRole('group', { name: /^Confirm new password/, exact: true })
            .locator('.text-danger')
            .last(),
        )
        .toHaveText(actions.TEXT.passwordMismatchError)
    })
    .changePasswordForm()
    .fillCurrentPassword(actions.VALID_PASSWORD)
    .fillNewPassword(NEW_PASSWORD)
    .fillConfirmNewPassword(NEW_PASSWORD)
    .save()
    // TODO: consider checking that password inputs are now empty.
    .step('Password change should be successful', (_, { api }) => {
      test.expect(api.currentPassword()).toBe(NEW_PASSWORD)
    }),
)

test.test('upload profile picture', ({ page }) =>
  actions
    .mockAllAndLogin({ page })
    .goToPage.settings()
    .uploadProfilePicture(
      PROFILE_PICTURE_FILENAME,
      PROFILE_PICTURE_CONTENT,
      PROFILE_PICTURE_MIMETYPE,
    )
    .step('Profile picture should be updated', async (_, { api }) => {
      await test
        .expect(() => {
          test.expect(api.currentProfilePicture()).toEqual(PROFILE_PICTURE_CONTENT)
        })
        .toPass()
    }),
)
