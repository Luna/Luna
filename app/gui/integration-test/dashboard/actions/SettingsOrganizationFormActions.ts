/** @file Actions for the "organization" form in settings. */
import { TEXT } from '.'
import type PageActions from './PageActions'
import SettingsFormActions from './SettingsFormActions'
import SettingsOrganizationTabActions from './SettingsOrganizationTabActions'

/** Actions for the "organization" form in settings. */
export default class SettingsOrganizationFormActions<Context> extends SettingsFormActions<
  Context,
  typeof SettingsOrganizationTabActions<Context>
> {
  /** Create a {@link SettingsOrganizationFormActions}. */
  constructor(...args: ConstructorParameters<typeof PageActions<Context>>) {
    super(
      SettingsOrganizationTabActions<Context>,
      (page) =>
        page
          .getByRole('heading')
          .and(page.getByText(TEXT.organizationSettingsSection))
          .locator('..'),
      ...args,
    )
  }

  /** Fill the "name" input of this form. */
  fillName(name: string) {
    return this.step("Fill 'name' input of 'organization' form", (page) =>
      this.locate(page)
        .getByLabel(TEXT.organizationNameSettingsInput)
        .getByRole('textbox')
        .fill(name),
    )
  }

  /** Fill the "email" input of this form. */
  fillEmail(name: string) {
    return this.step("Fill 'email' input of 'organization' form", (page) =>
      this.locate(page)
        .getByLabel(TEXT.organizationEmailSettingsInput)
        .getByRole('textbox')
        .fill(name),
    )
  }

  /** Fill the "website" input of this form. */
  fillWebsite(name: string) {
    return this.step("Fill 'website' input of 'organization' form", (page) =>
      this.locate(page)
        .getByLabel(TEXT.organizationWebsiteSettingsInput)
        .getByRole('textbox')
        .fill(name),
    )
  }

  /** Fill the "location" input of this form. */
  fillLocation(name: string) {
    return this.step("Fill 'location' input of 'organization' form", (page) =>
      this.locate(page)
        .getByLabel(TEXT.organizationLocationSettingsInput)
        .getByRole('textbox')
        .fill(name),
    )
  }
}
