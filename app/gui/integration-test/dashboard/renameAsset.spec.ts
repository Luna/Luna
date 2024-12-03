/** @file Test copying, moving, cutting and pasting. */
import { expect, test } from '@playwright/test'

import { locateAssetRowName, locateEditingTick, locateEditor, mockAllAndLogin } from './actions'

/** The name of the uploaded file. */
const FILE_NAME = 'foo.txt'
/** The contents of the uploaded file. */
const FILE_CONTENTS = 'hello world'
/** The name of the created secret. */
const SECRET_NAME = 'a secret name'
/** The value of the created secret. */
const SECRET_VALUE = 'a secret value'
const NEW_NAME = 'some new name'

test('rename folder', ({ page }) =>
  mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addDirectory('a directory')
    },
  })
    .createFolder()
    .driveTable.withRows(async (rows, _, { api }) => {
      await expect(rows).toHaveCount(1)
      const row = rows.nth(0)
      await expect(row).toBeVisible()
      await expect(row).toHaveText(/^a directory/)
      await locateAssetRowName(row).click()
      await locateAssetRowName(row).click()
      const calls = api.trackCalls()
      await locateAssetRowName(row).fill(NEW_NAME)
      await locateEditingTick(row).click()
      await expect(row).toHaveText(new RegExp('^' + NEW_NAME))
      expect(calls.updateDirectory).toBeGreaterThan(0)
    }))

test('create project', ({ page }) =>
  mockAllAndLogin({ page })
    .newEmptyProject()
    .do((thePage) => expect(locateEditor(thePage)).toBeAttached())
    .goToPage.drive()
    .driveTable.withRows((rows) => expect(rows).toHaveCount(1)))

test('upload file', ({ page }) =>
  mockAllAndLogin({ page })
    .uploadFile(FILE_NAME, FILE_CONTENTS)
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(1)
      await expect(rows.nth(0)).toBeVisible()
      await expect(rows.nth(0)).toHaveText(new RegExp('^' + FILE_NAME))
    }))

test('create secret', ({ page }) =>
  mockAllAndLogin({ page })
    .createSecret(SECRET_NAME, SECRET_VALUE)
    .driveTable.withRows(async (rows) => {
      await expect(rows).toHaveCount(1)
      await expect(rows.nth(0)).toBeVisible()
      await expect(rows.nth(0)).toHaveText(new RegExp('^' + SECRET_NAME))
    }))
