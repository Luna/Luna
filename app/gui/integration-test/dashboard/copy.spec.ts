/** @file Test copying, moving, cutting and pasting. */
import { expect, test } from '@playwright/test'

import {
  getAssetRowLeftPx,
  locateContextMenus,
  locateTrashCategory,
  mockAllAndLogin,
} from './actions'

test('copy', ({ page }) =>
  mockAllAndLogin({ page })
    // Assets: [0: Folder 1]
    .createFolder()
    // Assets: [0: Folder 2, 1: Folder 1]
    .createFolder()
    .driveTable.rightClickRow(0)
    // Assets: [0: Folder 2 <copied>, 1: Folder 1]
    .contextMenu.copy()
    .driveTable.rightClickRow(1)
    // Assets: [0: Folder 2, 1: Folder 1, 2: Folder 2 (copy) <child { depth=1 }>]
    .contextMenu.paste()
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(2)).toBeVisible()
      await expect(rows.nth(2)).toHaveText(/^New Folder 1 [(]copy[)]*/)
      const parentLeft = await getAssetRowLeftPx(rows.nth(1))
      const childLeft = await getAssetRowLeftPx(rows.nth(2))
      expect(childLeft, 'child is indented further than parent').toBeGreaterThan(parentLeft)
    }))

test('copy (keyboard)', ({ page }) =>
  mockAllAndLogin({ page })
    // Assets: [0: Folder 1]
    .createFolder()
    // Assets: [0: Folder 2, 1: Folder 1]
    .createFolder()
    .driveTable.clickRow(0)
    // Assets: [0: Folder 2 <copied>, 1: Folder 1]
    .press('Mod+C')
    .driveTable.clickRow(1)
    // Assets: [0: Folder 2, 1: Folder 1, 2: Folder 2 (copy) <child { depth=1 }>]
    .press('Mod+V')
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(2)).toBeVisible()
      await expect(rows.nth(2)).toHaveText(/^New Folder 1 [(]copy[)]*/)
      const parentLeft = await getAssetRowLeftPx(rows.nth(1))
      const childLeft = await getAssetRowLeftPx(rows.nth(2))
      expect(childLeft, 'child is indented further than parent').toBeGreaterThan(parentLeft)
    }))

test('move', ({ page }) =>
  mockAllAndLogin({ page })
    // Assets: [0: Folder 1]
    .createFolder()
    // Assets: [0: Folder 2, 1: Folder 1]
    .createFolder()
    .driveTable.rightClickRow(0)
    // Assets: [0: Folder 2 <cut>, 1: Folder 1]
    .contextMenu.cut()
    .driveTable.rightClickRow(1)
    // Assets: [0: Folder 1, 1: Folder 2 <child { depth=1 }>]
    .contextMenu.paste()
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(2)
      await expect(rows.nth(1)).toBeVisible()
      await expect(rows.nth(1)).toHaveText(/^New Folder 1/)
      const parentLeft = await getAssetRowLeftPx(rows.nth(0))
      const childLeft = await getAssetRowLeftPx(rows.nth(1))
      expect(childLeft, 'child is indented further than parent').toBeGreaterThan(parentLeft)
    }))

test('move (drag)', ({ page }) =>
  mockAllAndLogin({ page })
    // Assets: [0: Folder 1]
    .createFolder()
    // Assets: [0: Folder 2, 1: Folder 1]
    .createFolder()
    // Assets: [0: Folder 1, 1: Folder 2 <child { depth=1 }>]
    .driveTable.dragRowToRow(0, 1)
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(2)
      await expect(rows.nth(1)).toBeVisible()
      await expect(rows.nth(1)).toHaveText(/^New Folder 1/)
      const parentLeft = await getAssetRowLeftPx(rows.nth(0))
      const childLeft = await getAssetRowLeftPx(rows.nth(1))
      expect(childLeft, 'child is indented further than parent').toBeGreaterThan(parentLeft)
    }))

test('move to trash', ({ page }) =>
  mockAllAndLogin({ page })
    // Assets: [0: Folder 1]
    .createFolder()
    // Assets: [0: Folder 2, 1: Folder 1]
    .createFolder()
    // NOTE: For some reason, `react-aria-components` causes drag-n-drop to break if `Mod` is still
    // held.
    .withModPressed((modActions) => modActions.driveTable.clickRow(0).driveTable.clickRow(1))
    .driveTable.dragRow(0, locateTrashCategory(page))
    .driveTable.expectPlaceholderRow()
    .goToCategory.trash()
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveText([/^New Folder 1/, /^New Folder 2/])
    }))

test('move (keyboard)', ({ page }) =>
  mockAllAndLogin({ page })
    // Assets: [0: Folder 1]
    .createFolder()
    // Assets: [0: Folder 2, 1: Folder 1]
    .createFolder()
    .driveTable.clickRow(0)
    // Assets: [0: Folder 2 <cut>, 1: Folder 1]
    .press('Mod+X')
    .driveTable.clickRow(1)
    // Assets: [0: Folder 1, 1: Folder 2 <child { depth=1 }>]
    .press('Mod+V')
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(2)
      await expect(rows.nth(1)).toBeVisible()
      await expect(rows.nth(1)).toHaveText(/^New Folder 1/)
      const parentLeft = await getAssetRowLeftPx(rows.nth(0))
      const childLeft = await getAssetRowLeftPx(rows.nth(1))
      expect(childLeft, 'child is indented further than parent').toBeGreaterThan(parentLeft)
    }))

test('cut (keyboard)', async ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .driveTable.clickRow(0)
    .press('Mod+X')
    .driveTable.withRows(async (rows) => {
      // This action is not a builtin `expect` action, so it needs to be manually retried.
      await expect(async () => {
        expect(
          await rows.nth(0).evaluate((el) => Number(getComputedStyle(el).opacity)),
        ).toBeLessThan(1)
      }).toPass()
    }))

test('duplicate', ({ page }) =>
  mockAllAndLogin({ page })
    // Assets: [0: New Project 1]
    .newEmptyProject()
    .waitForEditorToLoad()
    .goToPage.drive()
    .driveTable.rightClickRow(0)
    .contextMenu.duplicate()
    .driveTable.withRows(async (rows) => {
      // Assets: [0: New Project 1, 1: New Project 1 (copy)]
      await expect(rows).toHaveCount(2)
      await expect(locateContextMenus(page)).not.toBeVisible()
      await expect(rows.nth(1)).toBeVisible()
      await expect(rows.nth(1)).toHaveText(/^New Project 1 [(]copy[)]/)
    }))

test('duplicate (keyboard)', ({ page }) =>
  mockAllAndLogin({ page })
    // Assets: [0: New Project 1]
    .newEmptyProject()
    .waitForEditorToLoad()
    .goToPage.drive()
    .driveTable.clickRow(0)
    .press('Mod+D')
    .driveTable.withRows(async (rows) => {
      // Assets: [0: New Project 1 (copy), 1: New Project 1]
      await expect(rows).toHaveCount(2)
      await expect(rows.nth(1)).toBeVisible()
      await expect(rows.nth(1)).toHaveText(/^New Project 1 [(]copy[)]/)
    }))
