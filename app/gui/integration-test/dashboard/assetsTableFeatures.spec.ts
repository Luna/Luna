/** @file Test the drive view. */
import { expect, test } from '@playwright/test'

import {
  getAssetRowLeftPx,
  locateAssetsTable,
  locateExtraColumns,
  locateRootDirectoryDropzone,
  mockAllAndLogin,
  TEXT,
} from './actions'

const PASS_TIMEOUT = 5_000

test('extra columns should stick to right side of assets table', ({ page }) =>
  mockAllAndLogin({ page })
    .withAssetsTable(async (table) => {
      await table.evaluate((element) => {
        let scrollableParent: HTMLElement | SVGElement | null = element
        while (
          scrollableParent != null &&
          scrollableParent.scrollWidth <= scrollableParent.clientWidth
        ) {
          scrollableParent = scrollableParent.parentElement
        }
        scrollableParent?.scrollTo({ left: 999999, behavior: 'instant' })
      })
    })
    .do(async (thePage) => {
      const extraColumns = locateExtraColumns(thePage)
      const assetsTable = locateAssetsTable(thePage)
      await expect(async () => {
        const extraColumnsRight = await extraColumns.evaluate(
          (element) => element.getBoundingClientRect().right,
        )
        const assetsTableRight = await assetsTable.evaluate(
          (element) => element.getBoundingClientRect().right,
        )
        expect(extraColumnsRight).toEqual(assetsTableRight - 12)
      }).toPass({ timeout: PASS_TIMEOUT })
    }))

test('extra columns should stick to top of scroll container', async ({ page }) => {
  await mockAllAndLogin({
    page,
    setupAPI: (api) => {
      for (let i = 0; i < 100; i += 1) {
        api.addFile('a')
      }
    },
  })

  await locateAssetsTable(page).evaluate((element) => {
    let scrollableParent: HTMLElement | SVGElement | null = element
    while (
      scrollableParent != null &&
      scrollableParent.scrollHeight <= scrollableParent.clientHeight
    ) {
      scrollableParent = scrollableParent.parentElement
    }
    scrollableParent?.scrollTo({ top: 999999, behavior: 'instant' })
  })
  const extraColumns = locateExtraColumns(page)
  const assetsTable = locateAssetsTable(page)
  await expect(async () => {
    const extraColumnsTop = await extraColumns.evaluate(
      (element) => element.getBoundingClientRect().top,
    )
    const assetsTableTop = await assetsTable.evaluate((element) => {
      let scrollableParent: HTMLElement | SVGElement | null = element
      while (
        scrollableParent != null &&
        scrollableParent.scrollHeight <= scrollableParent.clientHeight
      ) {
        scrollableParent = scrollableParent.parentElement
      }
      return scrollableParent?.getBoundingClientRect().top ?? 0
    })
    expect(extraColumnsTop).toEqual(assetsTableTop + 2)
  }).toPass({ timeout: PASS_TIMEOUT })
})

test('can drop onto root directory dropzone', ({ page }) =>
  mockAllAndLogin({ page })
    .createFolder()
    .uploadFile('b', 'testing')
    .driveTable.doubleClickRow(0)
    .driveTable.withRows(async (rows, nonAssetRows) => {
      const parentLeft = await getAssetRowLeftPx(rows.nth(0))
      await expect(nonAssetRows.nth(0)).toHaveText(TEXT.thisFolderIsEmpty)
      const childLeft = await getAssetRowLeftPx(nonAssetRows.nth(0))
      expect(childLeft, 'Child is indented further than parent').toBeGreaterThan(parentLeft)
    })
    .driveTable.dragRow(1, locateRootDirectoryDropzone(page))
    .driveTable.withRows(async (rows) => {
      const firstLeft = await getAssetRowLeftPx(rows.nth(0))
      const secondLeft = await getAssetRowLeftPx(rows.nth(1))
      expect(firstLeft, 'Siblings have same indentation').toEqual(secondLeft)
    }))
