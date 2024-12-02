/** @file Actions for the "home" page. */
import { locateSamples } from '.'
import BaseActions from './BaseActions'
import DrivePageActions from './DrivePageActions'
import EditorPageActions from './EditorPageActions'

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
