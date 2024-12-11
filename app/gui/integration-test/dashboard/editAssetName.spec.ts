/** @file Test copying, moving, cutting and pasting. */
import { test, type Locator, type Page } from '@playwright/test'

import { TEXT, mockAllAndLogin } from './actions'

const NEW_NAME = 'foo bar baz'
const NEW_NAME_2 = 'foo bar baz quux'

/** Find a set of context menus. */
function locateContextMenus(page: Page) {
  // This has no identifying features.
  return page.getByTestId('context-menus')
}

/** Find the name column of the given assets table row. */
function locateAssetRowName(locator: Locator) {
  return locator.getByTestId('asset-row-name')
}

/** Find a tick button. */
function locateEditingTick(page: Locator) {
  return page.getByLabel(TEXT.confirmEdit)
}

/** Find a cross button. */
function locateEditingCross(page: Locator) {
  return page.getByLabel(TEXT.cancelEdit)
}

test('edit name (double click)', ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .driveTable.withRows(async (rows) => {
      const row = rows.nth(0)
      const nameEl = locateAssetRowName(row)
      await nameEl.click()
      await nameEl.click()
      await nameEl.fill(NEW_NAME)
      await locateEditingTick(row).click()
      await test.expect(row).toHaveText(new RegExp('^' + NEW_NAME))
    }))

test('edit name (context menu)', ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .driveTable.withRows(async (rows) => {
      const row = rows.nth(0)
      await locateAssetRowName(row).click({ button: 'right' })
      await locateContextMenus(page)
        .getByText(/Rename/)
        .click()
      const nameEl = locateAssetRowName(row)
      await test.expect(nameEl).toBeVisible()
      await test.expect(nameEl).toBeFocused()
      await nameEl.fill(NEW_NAME)
      await test.expect(nameEl).toHaveValue(NEW_NAME)
      await nameEl.press('Enter')
      await test.expect(row).toHaveText(new RegExp('^' + NEW_NAME))
    }))

test('edit name (keyboard)', ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .driveTable.withRows(async (rows) => {
      await locateAssetRowName(rows.nth(0)).click()
    })
    .press('Mod+R')
    .driveTable.withRows(async (rows) => {
      const row = rows.nth(0)
      const nameEl = locateAssetRowName(row)
      await nameEl.fill(NEW_NAME_2)
      await nameEl.press('Enter')
      await test.expect(row).toHaveText(new RegExp('^' + NEW_NAME_2))
    }))

test('cancel editing name (double click)', ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .driveTable.withRows(async (rows) => {
      const row = rows.nth(0)
      const nameEl = locateAssetRowName(row)
      const oldName = (await nameEl.textContent()) ?? ''
      await nameEl.click()
      await nameEl.click()
      await nameEl.fill(NEW_NAME)
      await locateEditingCross(row).click()
      await test.expect(row).toHaveText(new RegExp('^' + oldName))
    }))

test('cancel editing name (keyboard)', ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .press('Mod+R')
    .driveTable.withRows(async (rows) => {
      const row = rows.nth(0)
      const nameEl = locateAssetRowName(row)
      const oldName = (await nameEl.textContent()) ?? ''
      await nameEl.fill(NEW_NAME_2)
      await nameEl.press('Escape')
      await test.expect(row).toHaveText(new RegExp('^' + oldName))
    }))

test('change to blank name (double click)', ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .driveTable.withRows(async (rows) => {
      const row = rows.nth(0)
      const nameEl = locateAssetRowName(row)
      const oldName = (await nameEl.textContent()) ?? ''
      await nameEl.click()
      await nameEl.click()
      await nameEl.fill('')
      await test.expect(locateEditingTick(row)).not.toBeVisible()
      await locateEditingCross(row).click()
      await test.expect(row).toHaveText(new RegExp('^' + oldName))
    }))

test('change to blank name (keyboard)', ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .driveTable.withRows(async (rows) => {
      await locateAssetRowName(rows.nth(0)).click()
    })
    .press('Mod+R')
    .driveTable.withRows(async (rows) => {
      const row = rows.nth(0)
      const nameEl = locateAssetRowName(row)
      const oldName = (await nameEl.textContent()) ?? ''
      await nameEl.fill('')
      await nameEl.press('Enter')
      await test.expect(row).toHaveText(new RegExp('^' + oldName))
    }))
