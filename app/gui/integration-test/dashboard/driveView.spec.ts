/** @file Test the drive view. */
import { expect, test, type Locator, type Page } from '@playwright/test'

import { TEXT, mockAllAndLogin } from './actions'

/** Find an editor container. */
function locateEditor(page: Page) {
  // Test ID of a placeholder editor component used during testing.
  return page.locator('.App')
}

/** Find a button to close the project. */
function locateStopProjectButton(page: Locator) {
  return page.getByLabel(TEXT.stopExecution)
}

test('drive view', ({ page }) =>
  mockAllAndLogin({ page })
    .withDriveView(async (view) => {
      await expect(view).toBeVisible()
    })
    .driveTable.expectPlaceholderRow()
    .newEmptyProject()
    .do(async () => {
      await expect(locateEditor(page)).toBeAttached()
    })
    .goToPage.drive()
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(1)
    })
    .withAssetsTable(async (assetsTable) => {
      await expect(assetsTable).toBeVisible()
    })
    .newEmptyProject()
    .do(async () => {
      await expect(locateEditor(page)).toBeAttached()
    })
    .goToPage.drive()
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(2)
    })
    // The last opened project needs to be stopped, to remove the toast notification notifying the
    // user that project creation may take a while. Previously opened projects are stopped when the
    // new project is created.
    .driveTable.withRows(async (rows) => {
      await locateStopProjectButton(rows.nth(1)).click()
    })
    // Project context menu
    .driveTable.rightClickRow(0)
    .contextMenu.moveNonFolderToTrash()
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(1)
    }))
