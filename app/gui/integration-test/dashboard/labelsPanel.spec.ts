/** @file Test the labels sidebar panel. */
import { expect, test } from '@playwright/test'

import {
  locateCreateButton,
  locateLabelsPanel,
  locateLabelsPanelLabels,
  locateNewLabelButton,
  locateNewLabelModal,
  locateNewLabelModalColorButtons,
  locateNewLabelModalNameInput,
  mockAllAndLogin,
  TEXT,
} from './actions'

test.beforeEach(({ page }) => mockAllAndLogin({ page }))

test('labels', async ({ page }) => {
  // Empty labels panel
  await expect(locateLabelsPanel(page)).toBeVisible()

  // "New Label" modal
  await locateNewLabelButton(page).click()
  await expect(locateNewLabelModal(page)).toBeVisible()

  // "New Label" modal with name set
  await locateNewLabelModalNameInput(page).fill('New Label')
  await expect(locateNewLabelModal(page)).toHaveText(/^New Label/)

  await page.press('html', 'Escape')

  // "New Label" modal with color set
  // The exact number is allowed to vary; but to click the fourth color, there must be at least
  // four colors.
  await locateNewLabelButton(page).click()
  expect(await locateNewLabelModalColorButtons(page).count()).toBeGreaterThanOrEqual(4)
  // `force: true` is required because the `label` needs to handle the click event, not the
  // `button`.
  await locateNewLabelModalColorButtons(page).nth(4).click({ force: true })
  await expect(locateNewLabelModal(page)).toBeVisible()

  // "New Label" modal with name and color set
  await locateNewLabelModalNameInput(page).fill('New Label')
  await expect(locateNewLabelModal(page)).toHaveText(/^New Label/)

  // Labels panel with one entry
  await locateCreateButton(locateNewLabelModal(page)).click()
  await expect(locateLabelsPanel(page)).toBeVisible()

  // Empty labels panel again, after deleting the only entry
  await locateLabelsPanelLabels(page).first().hover()

  const labelsPanel = locateLabelsPanel(page)
  await labelsPanel.getByRole('button').and(labelsPanel.getByLabel(TEXT.delete)).click()
  await page.getByRole('button', { name: TEXT.delete }).getByText(TEXT.delete).click()
  expect(await locateLabelsPanelLabels(page).count()).toBeGreaterThanOrEqual(1)
})
