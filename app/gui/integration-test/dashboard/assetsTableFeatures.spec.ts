/** @file Test the drive view. */
import * as backend from '#/services/Backend'
import * as test from '@playwright/test'
import * as actions from './actions'

const PASS_TIMEOUT = 5_000

test.test('extra columns should stick to right side of assets table', ({ page }) =>
  actions
    .mockAllAndLogin({ page })
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
      const extraColumns = actions.locateExtraColumns(thePage)
      const assetsTable = actions.locateAssetsTable(thePage)
      await test
        .expect(async () => {
          const extraColumnsRight = await extraColumns.evaluate(
            (element) => element.getBoundingClientRect().right,
          )
          const assetsTableRight = await assetsTable.evaluate(
            (element) => element.getBoundingClientRect().right,
          )
          test.expect(extraColumnsRight).toEqual(assetsTableRight - 12)
        })
        .toPass({ timeout: PASS_TIMEOUT })
    }),
)

test.test('extra columns should stick to top of scroll container', async ({ page }) => {
  await actions.mockAllAndLogin({
    page,
    setupAPI: (api) => {
      for (let i = 0; i < 100; i += 1) {
        api.addFile({ title: 'a' })
      }
    },
  })

  await actions.locateAssetsTable(page).evaluate((element) => {
    let scrollableParent: HTMLElement | SVGElement | null = element
    while (
      scrollableParent != null &&
      scrollableParent.scrollHeight <= scrollableParent.clientHeight
    ) {
      scrollableParent = scrollableParent.parentElement
    }
    scrollableParent?.scrollTo({ top: 999999, behavior: 'instant' })
  })
  const extraColumns = actions.locateExtraColumns(page)
  const assetsTable = actions.locateAssetsTable(page)
  await test
    .expect(async () => {
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
      test.expect(extraColumnsTop).toEqual(assetsTableTop + 2)
    })
    .toPass({ timeout: PASS_TIMEOUT })
})

test.test('can drop onto root directory dropzone', ({ page }) =>
  actions
    .mockAllAndLogin({ page })
    .createFolder()
    .uploadFile('b', 'testing')
    .driveTable.doubleClickRow(0)
    .driveTable.withRows(async (rows, nonAssetRows) => {
      const parentLeft = await actions.getAssetRowLeftPx(rows.nth(0))
      await test.expect(nonAssetRows.nth(0)).toHaveText(actions.TEXT.thisFolderIsEmpty)
      const childLeft = await actions.getAssetRowLeftPx(nonAssetRows.nth(0))
      test.expect(childLeft, 'Child is indented further than parent').toBeGreaterThan(parentLeft)
    })
    .driveTable.dragRow(1, actions.locateRootDirectoryDropzone(page))
    .driveTable.withRows(async (rows) => {
      const firstLeft = await actions.getAssetRowLeftPx(rows.nth(0))
      const secondLeft = await actions.getAssetRowLeftPx(rows.nth(1))
      test.expect(firstLeft, 'Siblings have same indentation').toEqual(secondLeft)
    }),
)

test.test("can't run a project in browser by default", ({ page }) =>
  actions
    .mockAllAndLogin({
      page,
      setupAPI: async (api) => {
        api.addProject({ title: 'a' })
      },
    })
    .driveTable.withRows(async (rows) => {
      const row = rows.first()

      const startProjectButton = row.getByTestId('open-project')
      await test.expect(startProjectButton).toBeDisabled()
    }),
)

test.test("can't start an already running by another user", ({ page }) =>
  actions
    .mockAllAndLogin({
      page,
      setupAPI: async (api) => {
        await api.setFeatureFlags({ enableCloudExecution: true })

        const userGroup = api.addUserGroup('Test Group')

        api.addUserGroupToUser(api.defaultUser.userId, userGroup.id)

        const peer = api.addUser('Test User', {
          email: backend.EmailAddress('test@test.com'),
          userGroups: [userGroup.id],
        })

        api.addProject({
          title: 'a',
          projectState: {
            type: backend.ProjectState.opened,
            volumeId: '123',
            openedBy: peer.email,
          },
        })
      },
    })
    .driveTable.withRows(async (rows) => {
      const row = rows.first()
      const startProjectButton = row.getByTestId('open-project')

      await test.expect(row).toBeVisible()
      await test.expect(row.getByTestId('switch-to-project')).not.toBeVisible()
      await test.expect(startProjectButton).toBeDisabled()
      await test
        .expect(startProjectButton)
        .toHaveAccessibleName(actions.getText('xIsUsingTheProject', 'Test User'))
    }),
)
