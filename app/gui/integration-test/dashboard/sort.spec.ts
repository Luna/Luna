/** @file Test sorting of assets columns. */
import { expect, test, type Locator } from '@playwright/test'

import { toRfc3339 } from '#/utilities/dateTime'

import { mockAllAndLogin } from './actions'

/** A test assertion to confirm that the element is fully transparent. */
async function expectOpacity0(locator: Locator) {
  await test.step('Expect `opacity: 0`', async () => {
    await expect(async () => {
      expect(await locator.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
    }).toPass()
  })
}

/** A test assertion to confirm that the element is not fully transparent. */
async function expectNotOpacity0(locator: Locator) {
  await test.step('Expect not `opacity: 0`', async () => {
    await expect(async () => {
      expect(await locator.evaluate((el) => getComputedStyle(el).opacity)).not.toBe('0')
    }).toPass()
  })
}

/** Find a "sort ascending" icon. */
function locateSortAscendingIcon(page: Locator) {
  return page.getByAltText('Sort Ascending')
}

/** Find a "sort descending" icon. */
function locateSortDescendingIcon(page: Locator) {
  return page.getByAltText('Sort Descending')
}

const START_DATE_EPOCH_MS = 1.7e12
/** The number of milliseconds in a minute. */
const MIN_MS = 60_000

test('sort', ({ page }) =>
  mockAllAndLogin({
    page,
    setupAPI: (api) => {
      const date1 = toRfc3339(new Date(START_DATE_EPOCH_MS))
      const date2 = toRfc3339(new Date(START_DATE_EPOCH_MS + 1 * MIN_MS))
      const date3 = toRfc3339(new Date(START_DATE_EPOCH_MS + 2 * MIN_MS))
      const date4 = toRfc3339(new Date(START_DATE_EPOCH_MS + 3 * MIN_MS))
      const date5 = toRfc3339(new Date(START_DATE_EPOCH_MS + 4 * MIN_MS))
      const date6 = toRfc3339(new Date(START_DATE_EPOCH_MS + 5 * MIN_MS))
      const date7 = toRfc3339(new Date(START_DATE_EPOCH_MS + 6 * MIN_MS))
      const date8 = toRfc3339(new Date(START_DATE_EPOCH_MS + 7 * MIN_MS))
      api.addDirectory('a directory', { modifiedAt: date4 })
      api.addDirectory('G directory', { modifiedAt: date6 })
      api.addProject('C project', { modifiedAt: date7 })
      api.addSecret('H secret', { modifiedAt: date2 })
      api.addProject('b project', { modifiedAt: date1 })
      api.addFile('d file', { modifiedAt: date8 })
      api.addSecret('f secret', { modifiedAt: date3 })
      api.addFile('e file', { modifiedAt: date5 })
      // By date:
      // b project
      // h secret
      // f secret
      // a directory
      // e file
      // g directory
      // c project
      // d file
    },
  })
    .driveTable.withNameColumnHeading(async (nameHeading) => {
      await expectOpacity0(locateSortAscendingIcon(nameHeading))
      await expect(locateSortDescendingIcon(nameHeading)).not.toBeVisible()
    })
    .driveTable.withModifiedColumnHeading(async (modifiedHeading) => {
      await expectOpacity0(locateSortAscendingIcon(modifiedHeading))
      await expect(locateSortDescendingIcon(modifiedHeading)).not.toBeVisible()
    })
    .driveTable.withRows(async (rows) => {
      // By default, assets should be grouped by type.
      // Assets in each group are ordered by insertion order.
      await expect(rows.nth(0)).toHaveText(/^a directory/)
      await expect(rows.nth(1)).toHaveText(/^G directory/)
      await expect(rows.nth(2)).toHaveText(/^C project/)
      await expect(rows.nth(3)).toHaveText(/^b project/)
      await expect(rows.nth(4)).toHaveText(/^d file/)
      await expect(rows.nth(5)).toHaveText(/^e file/)
      await expect(rows.nth(6)).toHaveText(/^H secret/)
      await expect(rows.nth(7)).toHaveText(/^f secret/)
    })
    // Sort by name ascending.
    .driveTable.clickNameColumnHeading()
    .driveTable.withNameColumnHeading(async (nameHeading) => {
      await expectNotOpacity0(locateSortAscendingIcon(nameHeading))
    })
    .driveTable.withRows(async (rows) => {
      await expect(rows.nth(0)).toHaveText(/^a directory/)
      await expect(rows.nth(1)).toHaveText(/^b project/)
      await expect(rows.nth(2)).toHaveText(/^C project/)
      await expect(rows.nth(3)).toHaveText(/^d file/)
      await expect(rows.nth(4)).toHaveText(/^e file/)
      await expect(rows.nth(5)).toHaveText(/^f secret/)
      await expect(rows.nth(6)).toHaveText(/^G directory/)
      await expect(rows.nth(7)).toHaveText(/^H secret/)
    })
    // Sort by name descending.
    .driveTable.clickNameColumnHeading()
    .driveTable.withNameColumnHeading(async (nameHeading) => {
      await expectNotOpacity0(locateSortDescendingIcon(nameHeading))
    })
    .driveTable.withRows(async (rows) => {
      await expect(rows.nth(0)).toHaveText(/^H secret/)
      await expect(rows.nth(1)).toHaveText(/^G directory/)
      await expect(rows.nth(2)).toHaveText(/^f secret/)
      await expect(rows.nth(3)).toHaveText(/^e file/)
      await expect(rows.nth(4)).toHaveText(/^d file/)
      await expect(rows.nth(5)).toHaveText(/^C project/)
      await expect(rows.nth(6)).toHaveText(/^b project/)
      await expect(rows.nth(7)).toHaveText(/^a directory/)
    })
    // Sorting should be unset.
    .driveTable.clickNameColumnHeading()
    .do(async (thePage) => {
      await thePage.mouse.move(0, 0)
    })
    .driveTable.withNameColumnHeading(async (nameHeading) => {
      await expectOpacity0(locateSortAscendingIcon(nameHeading))
      await test.expect(locateSortDescendingIcon(nameHeading)).not.toBeVisible()
    })
    .driveTable.withRows(async (rows) => {
      await expect(rows.nth(0)).toHaveText(/^a directory/)
      await expect(rows.nth(1)).toHaveText(/^G directory/)
      await expect(rows.nth(2)).toHaveText(/^C project/)
      await expect(rows.nth(3)).toHaveText(/^b project/)
      await expect(rows.nth(4)).toHaveText(/^d file/)
      await expect(rows.nth(5)).toHaveText(/^e file/)
      await expect(rows.nth(6)).toHaveText(/^H secret/)
      await expect(rows.nth(7)).toHaveText(/^f secret/)
    })
    // Sort by date ascending.
    .driveTable.clickModifiedColumnHeading()
    .driveTable.withModifiedColumnHeading(async (modifiedHeading) => {
      await expectNotOpacity0(locateSortAscendingIcon(modifiedHeading))
    })
    .driveTable.withRows(async (rows) => {
      await expect(rows.nth(0)).toHaveText(/^b project/)
      await expect(rows.nth(1)).toHaveText(/^H secret/)
      await expect(rows.nth(2)).toHaveText(/^f secret/)
      await expect(rows.nth(3)).toHaveText(/^a directory/)
      await expect(rows.nth(4)).toHaveText(/^e file/)
      await expect(rows.nth(5)).toHaveText(/^G directory/)
      await expect(rows.nth(6)).toHaveText(/^C project/)
      await expect(rows.nth(7)).toHaveText(/^d file/)
    })
    // Sort by date descending.
    .driveTable.clickModifiedColumnHeading()
    .driveTable.withModifiedColumnHeading(async (modifiedHeading) => {
      await expectNotOpacity0(locateSortDescendingIcon(modifiedHeading))
    })
    .driveTable.withRows(async (rows) => {
      await expect(rows.nth(0)).toHaveText(/^d file/)
      await expect(rows.nth(1)).toHaveText(/^C project/)
      await expect(rows.nth(2)).toHaveText(/^G directory/)
      await expect(rows.nth(3)).toHaveText(/^e file/)
      await expect(rows.nth(4)).toHaveText(/^a directory/)
      await expect(rows.nth(5)).toHaveText(/^f secret/)
      await expect(rows.nth(6)).toHaveText(/^H secret/)
      await expect(rows.nth(7)).toHaveText(/^b project/)
    })
    // Sorting should be unset.
    .driveTable.clickModifiedColumnHeading()
    .do(async (thePage) => {
      await thePage.mouse.move(0, 0)
    })
    .driveTable.withModifiedColumnHeading(async (modifiedHeading) => {
      await expectOpacity0(locateSortAscendingIcon(modifiedHeading))
      await expect(locateSortDescendingIcon(modifiedHeading)).not.toBeVisible()
    })
    .driveTable.withRows(async (rows) => {
      await expect(rows.nth(0)).toHaveText(/^a directory/)
      await expect(rows.nth(1)).toHaveText(/^G directory/)
      await expect(rows.nth(2)).toHaveText(/^C project/)
      await expect(rows.nth(3)).toHaveText(/^b project/)
      await expect(rows.nth(4)).toHaveText(/^d file/)
      await expect(rows.nth(5)).toHaveText(/^e file/)
      await expect(rows.nth(6)).toHaveText(/^H secret/)
      await expect(rows.nth(7)).toHaveText(/^f secret/)
    }))
