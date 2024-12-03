/** @file Test dragging of labels. */
import * as test from '@playwright/test'

import * as actions from './actions'

export const ASSET_ROW_SAFE_POSITION = { x: 300, y: 16 }

/** Click an asset row. The center must not be clicked as that is the button for adding a label. */
export async function clickAssetRow(assetRow: test.Locator) {
  await assetRow.click({ position: ASSET_ROW_SAFE_POSITION })
}

test.test('drag asset to trash (should fail)', async ({ page }) => {
  await actions.mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addDirectory('foo')
      api.addSecret('bar')
      api.addFile('baz')
      api.addSecret('quux')
    },
  })

  const assetRows = actions.locateAssetRows(page)

  await page.keyboard.down(await actions.modModifier(page))
  await test.expect(assetRows).toHaveCount(4)
  await clickAssetRow(assetRows.nth(0))
  await clickAssetRow(assetRows.nth(1))
  await clickAssetRow(assetRows.nth(2))
  await clickAssetRow(assetRows.nth(3))
  await assetRows.nth(0).dragTo(actions.locateTrashCategory(page))
  // Assert that all four assets were successfully moved to trash.
  await test.expect(assetRows).toHaveCount(4)
  await clickAssetRow(assetRows.nth(0))
  await clickAssetRow(assetRows.nth(2))
  await assetRows.nth(0).dragTo(page.getByLabel(actions.TEXT.cloud).locator('visible=true'), {
    force: true,
  })
  // If the count is the same, assume that the move failed.
  await test.expect(assetRows).toHaveCount(4)
})
