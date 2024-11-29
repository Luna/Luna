/** @file Test copying, moving, cutting and pasting. */
import * as test from '@playwright/test'

import * as actions from './actions'

/** The name of the uploaded file. */
const FILE_NAME = 'foo.txt'
/** The contents of the uploaded file. */
const FILE_CONTENTS = 'hello world'
/** The name of the created secret. */
const SECRET_NAME = 'a secret name'
/** The value of the created secret. */
const SECRET_VALUE = 'a secret value'
const NEW_NAME = 'some new name'

test.test('rename folder', ({ page }) =>
  actions
    .mockAllAndLogin({
      page,
      setupAPI: (api) => {
        api.addDirectory('a directory')
      },
    })
    .createFolder()
    .driveTable.withRows(async (rows, _, { api }) => {
      await test.expect(rows).toHaveCount(1)
      const row = rows.nth(0)
      await test.expect(row).toBeVisible()
      await test.expect(row).toHaveText(/^a directory/)
      await actions.locateAssetRowName(row).click()
      await actions.locateAssetRowName(row).click()
      const calls = api.trackCalls()
      await actions.locateAssetRowName(row).fill(NEW_NAME)
      await actions.locateEditingTick(row).click()
      await test.expect(row).toHaveText(new RegExp('^' + NEW_NAME))
      test.expect(calls.updateDirectory).toBeGreaterThan(0)
    }),
)

test.test('create project', ({ page }) =>
  actions
    .mockAllAndLogin({ page })
    .newEmptyProject()
    .do((thePage) => test.expect(actions.locateEditor(thePage)).toBeAttached())
    .goToPage.drive()
    .driveTable.withRows((rows) => test.expect(rows).toHaveCount(1)),
)

test.test('upload file', ({ page }) =>
  actions
    .mockAllAndLogin({ page })
    .uploadFile(FILE_NAME, FILE_CONTENTS)
    .driveTable.withRows(async (rows) => {
      await test.expect(rows).toHaveCount(1)
      await test.expect(rows.nth(0)).toBeVisible()
      await test.expect(rows.nth(0)).toHaveText(new RegExp('^' + FILE_NAME))
    }),
)

test.test('create secret', ({ page }) =>
  actions
    .mockAllAndLogin({ page })
    .createSecret(SECRET_NAME, SECRET_VALUE)
    .driveTable.withRows(async (rows) => {
      await test.expect(rows).toHaveCount(1)
      await test.expect(rows.nth(0)).toBeVisible()
      await test.expect(rows.nth(0)).toHaveText(new RegExp('^' + SECRET_NAME))
    }),
)
