/** @file Test the "change password" modal. */
// import { expect, test, type Page } from '@playwright/test'

// import { mockAllAndLogin } from './actions'

// FIXME[sb]: https://github.com/enso-org/cloud-v2/issues/1615
// Uncomment once cloud execution in the browser is re-enabled.

// /** Find an editor container. */
// function locateEditor(page: Page) {
//   // Test ID of a placeholder editor component used during testing.
//   return page.locator('.App')
// }

// /** Find a samples list. */
// function locateSamplesList(page: Page) {
//   // This has no identifying features.
//   return page.getByTestId('samples')
// }

// /** Find all samples list. */
// function locateSamples(page: Page) {
//   // This has no identifying features.
//   return locateSamplesList(page).getByRole('button')
// }

// test('create project from template', ({ page }) =>
//   mockAllAndLogin({ page })
//     .openStartModal()
//     .createProjectFromTemplate(0)
//     .do(async (thePage) => {
//       await expect(locateEditor(thePage)).toBeAttached()
//       await expect(locateSamples(page).first()).not.toBeVisible()
//     }))
