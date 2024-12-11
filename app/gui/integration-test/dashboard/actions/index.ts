/** @file Various actions, locators, and constants used in end-to-end tests. */
import { expect, test, type Page } from '@playwright/test'

import { TEXTS } from 'enso-common/src/text'

import { EULA_JSON, PRIVACY_JSON, mockApi, type MockApi, type SetupAPI } from './api'
import DrivePageActions from './DrivePageActions'
import LATEST_GITHUB_RELEASES from './latestGithubReleases.json' with { type: 'json' }
import LoginPageActions from './LoginPageActions'

export { mockApi } from './api'

/** An example password that does not meet validation requirements. */
export const INVALID_PASSWORD = 'password'
/** An example password that meets validation requirements. */
export const VALID_PASSWORD = 'Password0!'
/** An example valid email address. */
export const VALID_EMAIL = 'email@example.com'
export const TEXT = TEXTS.english

/** Perform a successful login. */
export async function login(
  { page, setupAPI }: MockParams,
  email = 'email@example.com',
  password = VALID_PASSWORD,
  first = true,
) {
  await test.step('Login', async () => {
    const url = new URL(page.url())

    if (url.pathname !== '/login') {
      return
    }

    await page.getByPlaceholder(TEXT.emailPlaceholder).fill(email)
    await page.getByPlaceholder(TEXT.passwordPlaceholder).fill(password)
    await page.getByRole('button', { name: TEXT.login, exact: true }).getByText(TEXT.login).click()

    await expect(page.getByText(TEXT.loadingAppMessage)).not.toBeVisible()

    if (first) {
      await passAgreementsDialog({ page, setupAPI })
      await expect(page.getByText(TEXT.loadingAppMessage)).not.toBeVisible()
    }
  })
}

/** A placeholder date for visual regression testing. */
const MOCK_DATE = Number(new Date('01/23/45 01:23:45'))

/** Parameters for {@link mockDate}. */
interface MockParams {
  readonly page: Page
  readonly setupAPI?: SetupAPI | undefined
}

/** Pass the Agreements dialog. */
export async function passAgreementsDialog({ page }: MockParams) {
  await test.step('Accept Terms and Conditions', async () => {
    await page.waitForSelector('#agreements-modal')
    await page
      .getByRole('group', { name: TEXT.licenseAgreementCheckbox })
      .getByText(TEXT.licenseAgreementCheckbox)
      .click()
    await page
      .getByRole('group', { name: TEXT.privacyPolicyCheckbox })
      .getByText(TEXT.privacyPolicyCheckbox)
      .click()
    await page.getByRole('button', { name: 'Accept' }).click()
  })
}

interface Context {
  readonly api: MockApi
}

/** Set up all mocks, without logging in. */
export function mockAll({ page, setupAPI }: MockParams) {
  const context: { api: MockApi } = { api: undefined! }
  return new LoginPageActions<Context>(page, context).step('Execute all mocks', async () => {
    await Promise.all([
      mockApi({ page, setupAPI }).then((api) => {
        context.api = api
      }),
      mockDate({ page, setupAPI }),
      mockAllAnimations({ page }),
      mockUnneededUrls({ page }),
    ])
    await page.goto('/')
  })
}

/** Set up all mocks, and log in with dummy credentials. */
export function mockAllAndLogin({ page, setupAPI }: MockParams) {
  return mockAll({ page, setupAPI })
    .into(DrivePageActions<Context>)
    .step('Login', () => login({ page, setupAPI }))
}

/** Replace `Date` with a version that returns a fixed time. */
async function mockDate({ page }: MockParams) {
  // https://github.com/microsoft/playwright/issues/6347#issuecomment-1085850728
  await test.step('Mock Date', async () => {
    await page.addInitScript(`{
        Date = class extends Date {
            constructor(...args) {
                if (args.length === 0) {
                    super(${MOCK_DATE});
                } else {
                    super(...args);
                }
            }
        }
        const __DateNowOffset = ${MOCK_DATE} - Date.now();
        const __DateNow = Date.now;
        Date.now = () => __DateNow() + __DateNowOffset;
    }`)
  })
}

/** Mock all animations. */
async function mockAllAnimations({ page }: MockParams) {
  await page.addInitScript({
    content: `
      window.DISABLE_ANIMATIONS = true;
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.add('disable-animations')
      })
    `,
  })
}

/** Mock unneeded URLs. */
async function mockUnneededUrls({ page }: MockParams) {
  const eulaJsonBody = JSON.stringify(EULA_JSON)
  const privacyJsonBody = JSON.stringify(PRIVACY_JSON)

  return Promise.all([
    page.route('https://cdn.enso.org/**', async (route) => {
      await route.fulfill()
    }),

    page.route('https://www.google-analytics.com/**', async (route) => {
      await route.fulfill()
    }),

    page.route('https://www.googletagmanager.com/gtag/js*', async (route) => {
      await route.fulfill({ contentType: 'text/javascript', body: 'export {};' })
    }),

    page.route('https://*.ingest.sentry.io/api/*/envelope/*', async (route) => {
      await route.fulfill()
    }),

    page.route('https://api.mapbox.com/mapbox-gl-js/*/mapbox-gl.css', async (route) => {
      await route.fulfill({ contentType: 'text/css', body: '' })
    }),

    page.route('https://ensoanalytics.com/eula.json', async (route) => {
      await route.fulfill({ contentType: 'text/json', body: eulaJsonBody })
    }),

    page.route('https://ensoanalytics.com/privacy.json', async (route) => {
      await route.fulfill({ contentType: 'text/json', body: privacyJsonBody })
    }),

    page.route('https://fonts.googleapis.com/css2*', async (route) => {
      await route.fulfill({ contentType: 'text/css', body: '' })
    }),

    ...(process.env.MOCK_ALL_URLS === 'true' ?
      []
    : [
        page.route('https://api.github.com/repos/enso-org/enso/releases/latest', async (route) => {
          await route.fulfill({ json: LATEST_GITHUB_RELEASES })
        }),

        page.route('https://github.com/enso-org/enso/releases/download/**', async (route) => {
          await route.fulfill({
            status: 302,
            headers: { location: 'https://objects.githubusercontent.com/foo/bar' },
          })
        }),

        page.route('https://objects.githubusercontent.com/**', async (route) => {
          await route.fulfill({
            status: 200,
            headers: {
              'content-type': 'application/octet-stream',
              'last-modified': 'Wed, 24 Jul 2024 17:22:47 GMT',
              etag: '"0x8DCAC053D058EA5"',
              server: 'Windows-Azure-Blob/1.0 Microsoft-HTTPAPI/2.0',
              'x-ms-request-id': '20ab2b4e-c01e-0068-7dfa-dd87c5000000',
              'x-ms-version': '2020-10-02',
              'x-ms-creation-time': 'Wed, 24 Jul 2024 17:22:47 GMT',
              'x-ms-lease-status': 'unlocked',
              'x-ms-lease-state': 'available',
              'x-ms-blob-type': 'BlockBlob',
              'content-disposition': 'attachment; filename=enso-linux-x86_64-2024.3.1-rc3.AppImage',
              'x-ms-server-encrypted': 'true',
              via: '1.1 varnish, 1.1 varnish',
              'accept-ranges': 'bytes',
              age: '1217',
              date: 'Mon, 29 Jul 2024 09:40:09 GMT',
              'x-served-by': 'cache-iad-kcgs7200163-IAD, cache-bne12520-BNE',
              'x-cache': 'HIT, HIT',
              'x-cache-hits': '48, 0',
              'x-timer': 'S1722246008.269342,VS0,VE895',
              'content-length': '1030383958',
            },
          })
        }),
      ]),
  ])
}
