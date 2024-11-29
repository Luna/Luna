/** @file Actions for the "editor" page. */
import * as goToPageActions from './goToPageActions'
import PageActions from './PageActions'

/** Actions for the "editor" page. */
export default class EditorPageActions<Context> extends PageActions<Context> {
  /** Actions for navigating to another page. */
  get goToPage(): Omit<goToPageActions.GoToPageActions<Context>, 'editor'> {
    return goToPageActions.goToPageActions(this.step.bind(this))
  }
  /** Waits for the editor to load. */
  waitForEditorToLoad(): EditorPageActions<Context> {
    return this.step('wait for the editor to load', async () => {
      await this.page.waitForSelector('[data-testid=editor]', { state: 'visible' })
    })
  }
}
