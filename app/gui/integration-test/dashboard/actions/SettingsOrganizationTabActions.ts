/** @file Actions for the "organization" tab of the "settings" page. */
import BaseSettingsTabActions from './BaseSettingsTabActions'
import SettingsOrganizationFormActions from './SettingsOrganizationFormActions'

/** Actions for the "organization" tab of the "settings" page. */
export default class SettingsOrganizationTabActions<Context> extends BaseSettingsTabActions<
  'organization',
  Context
> {
  /** Manipulate the "organization" form. */
  organizationForm() {
    return this.into(SettingsOrganizationFormActions<Context>)
  }

  /** Upload a profile picture. */
  uploadProfilePicture(
    name: string,
    content: WithImplicitCoercion<string | Uint8Array | readonly number[]>,
    mimeType: string,
  ) {
    return this.step('Upload organization profile picture', async (page) => {
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('label').click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles([{ name, mimeType, buffer: Buffer.from(content) }])
    })
  }
}
