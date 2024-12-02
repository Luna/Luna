/** @file Actions for the "user" tab of the "settings" page. */
import { goToPageActions, type GoToPageActions } from './goToPageActions'
import { goToSettingsTabActions, type GoToSettingsTabActions } from './gotoSettingsTabActions'
import PageActions from './PageActions'

/** Actions common to all settings pages. */
export default class BaseSettingsTabActions<
  CurrentTab extends keyof GoToSettingsTabActions<unknown>,
  Context,
> extends PageActions<Context> {
  /** Actions for navigating to another page. */
  get goToPage(): Omit<GoToPageActions<Context>, 'settings'> {
    return goToPageActions(this.step.bind(this))
  }

  /** Actions for navigating to another settings tab. */
  get goToSettingsTab(): Omit<GoToSettingsTabActions<Context>, CurrentTab> {
    return goToSettingsTabActions(this.step.bind(this))
  }
}
