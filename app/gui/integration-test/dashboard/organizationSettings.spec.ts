/** @file Test the organization settings tab. */
import * as test from '@playwright/test'

import { Plan } from 'enso-common/src/services/Backend'
import * as actions from './actions'

const NEW_NAME = 'another organization-name'
const INVALID_EMAIL = 'invalid@email'
const NEW_EMAIL = 'organization@email.com'
const NEW_WEBSITE = 'organization.org'
const NEW_LOCATION = 'Somewhere, CA'
const PROFILE_PICTURE_FILENAME = 'bar.jpeg'
const PROFILE_PICTURE_CONTENT = 'organization profile picture'
const PROFILE_PICTURE_MIMETYPE = 'image/jpeg'

test.test('organization settings', async ({ page }) =>
  actions
    .mockAllAndLogin({
      page,
      setupAPI: (api) => {
        api.setPlan(Plan.team)
        api.setCurrentOrganization(api.defaultOrganization)
      },
    })
    .step('Verify initial organization state', (_, { api }) => {
      test.expect(api.currentOrganization()?.name).toBe(api.defaultOrganizationName)
      test.expect(api.currentOrganization()?.email).toBe(null)
      test.expect(api.currentOrganization()?.picture).toBe(null)
      test.expect(api.currentOrganization()?.website).toBe(null)
      test.expect(api.currentOrganization()?.address).toBe(null)
    })
    .do(async (page) => {
      await test.expect(page.getByText('Logging in to Enso...')).not.toBeVisible()
    })
    .goToPage.settings()
    .goToSettingsTab.organization()
    .organizationForm()
    .fillName(NEW_NAME)
    .save()
    .step('Set organization name', (_, { api }) => {
      test.expect(api.currentOrganization()?.name).toBe(NEW_NAME)
      test.expect(api.currentUser()?.name).not.toBe(NEW_NAME)
    })
    .organizationForm()
    .fillName('')
    .step('Unsetting organization name should fail', (_, { api }) => {
      test.expect(api.currentOrganization()?.name).toBe(NEW_NAME)
    })
    .cancel()
    .organizationForm()
    .fillEmail(INVALID_EMAIL)
    .save()
    .step('Setting invalid email should fail', (_, { api }) => {
      test.expect(api.currentOrganization()?.email).toBe('')
    })
    .organizationForm()
    .fillEmail(NEW_EMAIL)
    .save()
    .step('Set email', (_, { api }) => {
      test.expect(api.currentOrganization()?.email).toBe(NEW_EMAIL)
    })
    .organizationForm()
    .fillWebsite(NEW_WEBSITE)
    .save()
    // NOTE: It is not yet possible to unset the website or the location.
    .step('Set website', async (_, { api }) => {
      test.expect(api.currentOrganization()?.website).toBe(NEW_WEBSITE)
    })
    .organizationForm()
    .fillLocation(NEW_LOCATION)
    .save()
    .step('Set website', async (_, { api }) => {
      test.expect(api.currentOrganization()?.address).toBe(NEW_LOCATION)
    }),
)

test.test('upload organization profile picture', ({ page }) =>
  actions
    .mockAllAndLogin({
      page,
      setupAPI: (theApi) => {
        theApi.setPlan(Plan.team)
      },
    })
    .goToPage.settings()
    .goToSettingsTab.organization()
    .uploadProfilePicture(
      PROFILE_PICTURE_FILENAME,
      PROFILE_PICTURE_CONTENT,
      PROFILE_PICTURE_MIMETYPE,
    )
    .step('Profile picture should be updated', async (_, { api }) => {
      await test
        .expect(() => {
          test.expect(api.currentOrganizationProfilePicture()).toEqual(PROFILE_PICTURE_CONTENT)
        })
        .toPass()
    }),
)
