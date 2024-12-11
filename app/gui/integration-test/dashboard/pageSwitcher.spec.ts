/** @file Test the login flow. */
// import { expect, test, type Page } from '@playwright/test'

// import { mockAllAndLogin } from './actions'

// /** Find an editor container. */
// function locateEditor(page: Page) {
//   // Test ID of a placeholder editor component used during testing.
//   return page.locator('.App')
// }

// /** Find a drive view. */
// function locateDriveView(page: Page) {
//   // This has no identifying features.
//   return page.getByTestId('drive-view')
// }

// FIXME[sb]: https://github.com/enso-org/cloud-v2/issues/1615
// Uncomment once cloud execution in the browser is re-enabled.
// test('page switcher', ({ page }) =>
//   actions
//     .mockAllAndLogin({ page })
//     // Create a new project so that the editor page can be switched to.
//     .newEmptyProject()
//     .do(async (thePage) => {
//       await expect(actions.locateDriveView(thePage)).not.toBeVisible()
//       await expect(actions.locateEditor(thePage)).toBeVisible()
//     })
//     .goToPage.drive()
//     .do(async (thePage) => {
//       await expect(actions.locateDriveView(thePage)).toBeVisible()
//       await expect(actions.locateEditor(thePage)).not.toBeVisible()
//     })
//     .goToPage.editor()
//     .do(async (thePage) => {
//       await expect(actions.locateDriveView(thePage)).not.toBeVisible()
//       await expect(actions.locateEditor(thePage)).toBeVisible()
//     }),
// )
