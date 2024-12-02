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
}
