/** @file Actions for the third step of the "setup" page. */
import { TEXT } from '../actions'
import BaseActions from './BaseActions'
import SetupDonePageActions from './SetupDonePageActions'

// ============================
// === SetupTeamPageActions ===
// ============================

/** Actions for the third step of the "setup" page. */
export default class SetupTeamPageActions extends BaseActions {
  /** Set the userame for a new user that does not yet have a username. */
  setOrganizationName(organizationName: string) {
    return this.step(`Set organization name to '${organizationName}'`, async (page) => {
      await page
        .getByLabel(TEXT.organizationNameSettingsInput)
        .and(page.getByRole('textbox'))
        .fill(organizationName)
      await page.getByText(TEXT.next).click()
    }).into(SetupDonePageActions)
  }
}
