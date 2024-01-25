import test, { expect, type Locator, type Page } from 'playwright/test'
import * as actions from './actions'
import * as customExpect from './customExpect'
import { mockMethodCallInfo } from './expressionUpdates'
import * as locate from './locate'

class DropDownLocator {
  readonly dropDown: Locator
  readonly items: Locator

  constructor(page: Page) {
    this.dropDown = page.locator('.dropdownContainer')
    this.items = this.dropDown.locator('.selectable-item')
  }

  async expectVisibleWithOptions(page: Page, options: string[]): Promise<void> {
    await expect(this.dropDown).toBeVisible()
    await expect(this.items).toHaveCount(options.length)
    for (const option of options) {
      await expect(
        this.items.filter({ has: page.getByText(option, { exact: true }) }),
      ).toBeVisible()
    }
  }

  async clickOption(page: Page, option: string): Promise<void> {
    await this.items.filter({ has: page.getByText(option) }).click()
  }
}

test('Selection widgets in Data.read node', async ({ page }) => {
  await actions.goToGraph(page)
  await mockMethodCallInfo(page, 'data', {
    methodPointer: {
      module: 'Standard.Base.Data',
      definedOnType: 'Standard.Base.Data',
      name: 'read',
    },
    notAppliedArguments: [0, 1, 2],
  })

  const dropDown = new DropDownLocator(page)

  // Check initially visible arguments
  const node = locate.graphNodeByBinding(page, 'data')
  const argumentNames = locate.topLevelArguments(node)
  await expect(argumentNames).toHaveCount(3)

  // Set value on `on_problems` (static drop-down)
  // const onProblemsArg = locate.topLevelArgument(node, 'on_problems')
  const onProblemsArg = argumentNames.filter({
    has: page.getByText('on_problems'),
  }) as locate.WidgetLocator
  await onProblemsArg.click()
  await dropDown.expectVisibleWithOptions(page, ['Ignore', 'Report Warning', 'Report Error'])
  await dropDown.clickOption(page, 'Report Error')
  await customExpect.toHaveTokens(onProblemsArg, ['Problem_Behavior', '.', 'Report_Error'])
  await mockMethodCallInfo(page, 'data', {
    methodPointer: {
      module: 'Standard.Base.Data',
      definedOnType: 'Standard.Base.Data',
      name: 'read',
    },
    notAppliedArguments: [0, 1],
  })

  // Change value on `on_problems`
  await page.getByText('Report_Error').click()
  await dropDown.expectVisibleWithOptions(page, ['Ignore', 'Report Warning', 'Report Error'])
  await dropDown.clickOption(page, 'Report Warning')
  await customExpect.toHaveTokens(onProblemsArg, ['Problem_Behavior', '.', 'Report_Warning'])

  // Set value on `path` (dynamic config)
  const pathArg = locate.topLevelArgument(node, 'path')
  await pathArg.click()
  await expect(page.locator('.dropdownContainer')).toBeVisible()
  await dropDown.expectVisibleWithOptions(page, ['File 1', 'File 2'])
  await dropDown.clickOption(page, 'File 2')
  await customExpect.toHaveTokens(pathArg, ['"', 'File 2', '"'])

  // Change value on `path` (dynamic config)
  await mockMethodCallInfo(page, 'data', {
    methodPointer: {
      module: 'Standard.Base.Data',
      definedOnType: 'Standard.Base.Data',
      name: 'read',
    },
    notAppliedArguments: [1],
  })
  await page.getByText('File 2').click()
  await dropDown.expectVisibleWithOptions(page, ['File 1', 'File 2'])
  await dropDown.clickOption(page, 'File 1')
  await customExpect.toHaveTokens(pathArg, ['"', 'File 1', '"'])
})

test('Managing aggregates in `aggregate` node', async ({ page }) => {
  await actions.goToGraph(page)
  await mockMethodCallInfo(page, 'aggregated', {
    methodPointer: {
      module: 'Standard.Table.Data.Table',
      definedOnType: 'Standard.Table.Data.Table.Table',
      name: 'aggregate',
    },
    notAppliedArguments: [1, 2, 3],
  })
  const dropDown = new DropDownLocator(page)

  // Check initially visible arguments
  const node = locate.graphNodeByBinding(page, 'aggregated')
  const argumentNames = locate.topLevelArguments(node)
  await expect(argumentNames).toHaveCount(3)

  // Add first aggregate
  const columnsArg = locate.widgetVectorEditor(locate.topLevelArgument(node, 'columns'))
  await columnsArg.locator('.add-item').click()
  await customExpect.toHaveTokens(columnsArg, ['Aggregate_Column', '.', 'Group_By'])
  await mockMethodCallInfo(
    page,
    {
      binding: 'aggregated',
      expr: 'Aggregate_Column.Group_By',
    },
    {
      methodPointer: {
        module: 'Standard.Table.Data.Aggregate_Column',
        definedOnType: 'Standard.Table.Data.Aggregate_Column.Aggregate_Column',
        name: 'Group_By',
      },
      notAppliedArguments: [0, 1],
    },
  )

  // Change aggregation type
  const firstItem = columnsArg.locator('.item > .WidgetPort > .WidgetSelection')
  await firstItem.click()
  await dropDown.expectVisibleWithOptions(page, ['Group By', 'Count', 'Count Distinct'])
  await dropDown.clickOption(page, 'Count Distinct')
  await customExpect.toHaveTokens(columnsArg, ['Aggregate_Column', '.', 'Count_Distinct'])
  await mockMethodCallInfo(
    page,
    {
      binding: 'aggregated',
      expr: 'Aggregate_Column.Count_Distinct',
    },
    {
      methodPointer: {
        module: 'Standard.Table.Data.Aggregate_Column',
        definedOnType: 'Standard.Table.Data.Aggregate_Column.Aggregate_Column',
        name: 'Count_Distinct',
      },
      notAppliedArguments: [0, 1, 2],
    },
  )

  // Set column
  const columnArg = firstItem.locator('.WidgetSelection').first()
  await columnArg.click()
  await dropDown.expectVisibleWithOptions(page, ['column 1', 'column 2'])
  await dropDown.clickOption(page, 'column 1')
  await customExpect.toHaveTokens(columnsArg, [
    'Aggregate_Column',
    '.',
    'Count_Distinct',
    '"',
    'column 1',
    '"',
  ])

  // Add another aggregate
  await columnsArg.locator('.add-item').click()
  await customExpect.toHaveTokens(columnsArg, [
    'Aggregate_Column',
    '.',
    'Count_Distinct',
    '"',
    'column 1',
    '"',
    'Aggregate_Column',
    '.',
    'Group_By',
  ])
  await mockMethodCallInfo(
    page,
    {
      binding: 'aggregated',
      expr: 'Aggregate_Column.Group_By',
    },
    {
      methodPointer: {
        module: 'Standard.Table.Data.Aggregate_Column',
        definedOnType: 'Standard.Table.Data.Aggregate_Column.Aggregate_Column',
        name: 'Group_By',
      },
      notAppliedArguments: [0, 1],
    },
  )

  // Set new aggregate's column
  const secondItem = columnsArg
    .locator('.item > .WidgetPort > .WidgetSelection')
    .nth(1) as locate.WidgetLocator
  const secondColumnArg = secondItem.locator('.WidgetSelection').first()
  await secondColumnArg.click()
  await dropDown.expectVisibleWithOptions(page, ['column 1', 'column 2'])
  await dropDown.clickOption(page, 'column 2')
  await customExpect.toHaveTokens(secondItem, [
    'Aggregate_Column',
    '.',
    'Group_By',
    '"',
    'column 2',
    '"',
  ])

  // Switch aggregates
  //TODO[ao] I have no idea how to emulate drag. Simple dragTo does not work (some element seem to capture event).
  // When hovered, the handle becomes available after some time, but still mouse events don't have any effect.
  // I have no time now to investigate this.
  // Once fixed, add also removing element from vector here.

  // await columnsArg.locator('.item > .handle').nth(1).hover({ force: true })
  // await columnsArg.locator('.item > .handle').nth(1).hover()
  // await page.mouse.down()
  // await columnsArg.locator('.item > .handle').nth(0).hover({ force: true })
  // await columnsArg.locator('.item > .handle').nth(0).hover()
  // await page.mouse.up()
  // await customExpect.toHaveTokens(columnsArg, [
  //   'Aggregate_Column',
  //   '.',
  //   'Group_By',
  //   '"',
  //   'column 2',
  //   '"',
  //   'Aggregate_Column',
  //   '.',
  //   'Count_Distinct',
  //   '"',
  //   'column 1',
  //   '"',
  // ])
})
