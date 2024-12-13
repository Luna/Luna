/** @file Tests for the `parseUserEmails` function. */
import { describe, expect, it } from 'vitest'

import { parseUserEmails } from '../email'

describe('parseUserEmails', () => {
  it.each([
    ['john.doe@domain.com', { entries: [{ email: 'john.doe@domain.com' }] }],
    [
      'john.doe@domain.com, jane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    [
      'john.doe@domain.com jane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    [
      'john.doe@domain.com; jane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    [
      'john.doe@domain.com\njane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    ['', { entries: [] }],
    [' john.doe@domain.com ', { entries: [{ email: 'john.doe@domain.com' }] }],
    [
      'john.doe@domain.com, , jane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    [
      'john.doe@domain.com,,jane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    [
      'john.doe@domain.com  jane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    [
      'john.doe@domain.com;;jane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    [
      'john.doe@domain.com\n\njane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
    [' john.doe@domain.com ', { entries: [{ email: 'john.doe@domain.com' }] }],
    [
      'john.doe@domain.com,, jane.doe@domain.com',
      { entries: [{ email: 'john.doe@domain.com' }, { email: 'jane.doe@domain.com' }] },
    ],
  ])('should correctly parse email addresses in different formats', (given, expected) => {
    const result = parseUserEmails(given)
    expect(result).toEqual(expected)
  })
})
