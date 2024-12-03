/** @file Actions for the "account" tab of the "settings" page. */
import BaseSettingsTabActions from './BaseSettingsTabActions'
import SettingsAccountFormActions from './SettingsAccountFormActions'
import SettingsChangePasswordFormActions from './SettingsChangePasswordFormActions'

/** Actions for the "account" tab of the "settings" page. */
export default class SettingsAccountTabActions<Context> extends BaseSettingsTabActions<
  'account',
  Context
> {
  /** Manipulate the "account" form. */
  accountForm() {
    return this.into(SettingsAccountFormActions<Context>)
  }

  /** Manipulate the "change password" form. */
  changePasswordForm() {
    return this.into(SettingsChangePasswordFormActions<Context>)
  }

  /** Upload a profile picture. */
  uploadProfilePicture(
    name: string,
    content: WithImplicitCoercion<string | Uint8Array | readonly number[]>,
    mimeType = 'image/png',
  ) {
    return this.step('Upload account profile picture', async (page) => {
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('label').click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles([{ name, mimeType, buffer: Buffer.from(content) }])
    })
  }
}
