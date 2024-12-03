/** @file Test dragging of labels. */
import { expect, test, type Locator } from '@playwright/test'

import { COLORS } from '#/services/Backend'

import {
  locateAssetLabels,
  locateAssetRows,
  locateLabelsPanelLabels,
  mockAllAndLogin,
  modModifier,
} from './actions'

export const ASSET_ROW_SAFE_POSITION = { x: 300, y: 16 }

/** Click an asset row. The center must not be clicked as that is the button for adding a label. */
export async function clickAssetRow(assetRow: Locator) {
  await assetRow.click({ position: ASSET_ROW_SAFE_POSITION })
}

test('drag labels onto single row', async ({ page }) => {
  const label = 'aaaa'
  return mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addLabel(label, COLORS[0])
      api.addLabel('bbbb', COLORS[1])
      api.addLabel('cccc', COLORS[2])
      api.addLabel('dddd', COLORS[3])
      api.addDirectory('foo')
      api.addSecret('bar')
      api.addFile('baz')
      api.addSecret('quux')
    },
  }).do(async () => {
    const assetRows = locateAssetRows(page)
    const labelEl = locateLabelsPanelLabels(page, label)

    await expect(labelEl).toBeVisible()
    await labelEl.dragTo(assetRows.nth(1))
    await expect(locateAssetLabels(assetRows.nth(0)).getByText(label)).not.toBeVisible()
    await expect(locateAssetLabels(assetRows.nth(1)).getByText(label)).toBeVisible()
    await expect(locateAssetLabels(assetRows.nth(2)).getByText(label)).not.toBeVisible()
    await expect(locateAssetLabels(assetRows.nth(3)).getByText(label)).not.toBeVisible()
  })
})

test('drag labels onto multiple rows', async ({ page }) => {
  const label = 'aaaa'
  await mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addLabel(label, COLORS[0])
      api.addLabel('bbbb', COLORS[1])
      api.addLabel('cccc', COLORS[2])
      api.addLabel('dddd', COLORS[3])
      api.addDirectory('foo')
      api.addSecret('bar')
      api.addFile('baz')
      api.addSecret('quux')
    },
  })

  const assetRows = locateAssetRows(page)
  const labelEl = locateLabelsPanelLabels(page, label)

  await page.keyboard.down(await modModifier(page))
  await expect(assetRows).toHaveCount(4)
  await clickAssetRow(assetRows.nth(0))
  await clickAssetRow(assetRows.nth(2))
  await expect(labelEl).toBeVisible()
  await labelEl.dragTo(assetRows.nth(2))
  await page.keyboard.up(await modModifier(page))
  await expect(locateAssetLabels(assetRows.nth(0)).getByText(label)).toBeVisible()
  await expect(locateAssetLabels(assetRows.nth(1)).getByText(label)).not.toBeVisible()
  await expect(locateAssetLabels(assetRows.nth(2)).getByText(label)).toBeVisible()
  await expect(locateAssetLabels(assetRows.nth(3)).getByText(label)).not.toBeVisible()
})
