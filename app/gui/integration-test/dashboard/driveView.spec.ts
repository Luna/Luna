/** @file Test the drive view. */
import { expect, test } from '@playwright/test'

import {
  locateAssetsTable,
  locateEditor,
  locateStopProjectButton,
  mockAllAndLogin,
} from './actions'

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
    .do(async () => {
      await expect(locateAssetsTable(page)).toBeVisible()
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
