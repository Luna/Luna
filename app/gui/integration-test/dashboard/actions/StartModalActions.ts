/** @file Actions for the "home" page. */
import type { Page } from '@playwright/test'
import BaseActions from './BaseActions'
import DrivePageActions from './DrivePageActions'
import EditorPageActions from './EditorPageActions'

/** Find a samples list. */
function locateSamplesList(page: Page) {
  // This has no identifying features.
  return page.getByTestId('samples')
}

/** Find all samples list. */
function locateSamples(page: Page) {
  // This has no identifying features.
  return locateSamplesList(page).getByRole('button')
}

/** Actions for the "start" modal. */
export default class StartModalActions<Context> extends BaseActions<Context> {
  /** Close this modal and go back to the Drive page. */
  close() {
    return this.step('Close "start" modal', (page) => page.getByLabel('Close').click()).into(
      DrivePageActions<Context>,
    )
  }

  /** Create a project from the template at the given index. */
  createProjectFromTemplate(index: number) {
    return this.step(`Create project from template #${index}`, (page) =>
      locateSamples(page)
        .nth(index + 1)
        .click(),
    ).into(EditorPageActions<Context>)
  }
}
