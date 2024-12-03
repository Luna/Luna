/** @file Test copying, moving, cutting and pasting. */
import { test } from '@playwright/test'

import {
  locateAssetRowName,
  locateAssetRows,
  locateContextMenus,
  locateEditingCross,
  locateEditingTick,
  locateNewFolderIcon,
  mockAllAndLogin,
  press,
} from './actions'

test('edit name (double click)', async ({ page }) => {
  await mockAllAndLogin({ page })
  const assetRows = locateAssetRows(page)
  const row = assetRows.nth(0)
  const newName = 'foo bar baz'

  await locateNewFolderIcon(page).click()
  await locateAssetRowName(row).click()
  await locateAssetRowName(row).click()
  await locateAssetRowName(row).fill(newName)
  await locateEditingTick(row).click()
  await test.expect(row).toHaveText(new RegExp('^' + newName))
})

test('edit name (context menu)', async ({ page }) => {
  await mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addAsset(api.createDirectory('foo'))
    },
  })

  const assetRows = locateAssetRows(page)
  const row = assetRows.nth(0)
  const newName = 'foo bar baz'

  await locateAssetRowName(row).click({ button: 'right' })
  await locateContextMenus(page)
    .getByText(/Rename/)
    .click()

  const input = page.getByTestId('asset-row-name')

  await test.expect(input).toBeVisible()
  await test.expect(input).toBeFocused()

  await input.fill(newName)

  await test.expect(input).toHaveValue(newName)

  await input.press('Enter')

  await test.expect(row).toHaveText(new RegExp('^' + newName))
})

test('edit name (keyboard)', async ({ page }) => {
  await mockAllAndLogin({ page })

  const assetRows = locateAssetRows(page)
  const row = assetRows.nth(0)
  const newName = 'foo bar baz quux'

  await locateNewFolderIcon(page).click()
  await locateAssetRowName(row).click()
  await press(page, 'Mod+R')
  await locateAssetRowName(row).fill(newName)
  await locateAssetRowName(row).press('Enter')
  await test.expect(row).toHaveText(new RegExp('^' + newName))
})

test('cancel editing name (double click)', async ({ page }) => {
  await mockAllAndLogin({ page })

  const assetRows = locateAssetRows(page)
  const row = assetRows.nth(0)
  const newName = 'foo bar baz'

  await locateNewFolderIcon(page).click()
  const oldName = (await locateAssetRowName(row).textContent()) ?? ''
  await locateAssetRowName(row).click()
  await locateAssetRowName(row).click()

  await locateAssetRowName(row).fill(newName)
  await locateEditingCross(row).click()
  await test.expect(row).toHaveText(new RegExp('^' + oldName))
})

test('cancel editing name (keyboard)', async ({ page }) => {
  await mockAllAndLogin({ page })

  const assetRows = locateAssetRows(page)
  const row = assetRows.nth(0)
  const newName = 'foo bar baz quux'

  await locateNewFolderIcon(page).click()
  const oldName = (await locateAssetRowName(row).textContent()) ?? ''
  await locateAssetRowName(row).click()
  await press(page, 'Mod+R')
  await locateAssetRowName(row).fill(newName)
  await locateAssetRowName(row).press('Escape')
  await test.expect(row).toHaveText(new RegExp('^' + oldName))
})

test('change to blank name (double click)', async ({ page }) => {
  await mockAllAndLogin({ page })

  const assetRows = locateAssetRows(page)
  const row = assetRows.nth(0)

  await locateNewFolderIcon(page).click()
  const oldName = (await locateAssetRowName(row).textContent()) ?? ''
  await locateAssetRowName(row).click()
  await locateAssetRowName(row).click()
  await locateAssetRowName(row).fill('')
  await test.expect(locateEditingTick(row)).not.toBeVisible()
  await locateEditingCross(row).click()
  await test.expect(row).toHaveText(new RegExp('^' + oldName))
})

test('change to blank name (keyboard)', async ({ page }) => {
  await mockAllAndLogin({ page })

  const assetRows = locateAssetRows(page)
  const row = assetRows.nth(0)

  await locateNewFolderIcon(page).click()
  const oldName = (await locateAssetRowName(row).textContent()) ?? ''
  await locateAssetRowName(row).click()
  await press(page, 'Mod+R')
  await locateAssetRowName(row).fill('')
  await locateAssetRowName(row).press('Enter')
  await test.expect(row).toHaveText(new RegExp('^' + oldName))
})
