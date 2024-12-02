/** @file Actions for the "user" tab of the "settings" page. */
import { goToPageActions, type GoToPageActions } from './goToPageActions'
import PageActions from './PageActions'

// TODO: split settings page actions into different classes for each settings tab.
/** Actions for the "user" tab of the "settings" page. */
export default class SettingsPageActions<Context> extends PageActions<Context> {
  /** Actions for navigating to another page. */
  get goToPage(): Omit<GoToPageActions<Context>, 'settings'> {
    return goToPageActions(this.step.bind(this))
  }
}
