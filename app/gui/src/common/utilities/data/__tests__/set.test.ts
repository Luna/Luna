/** @file Tests for `set.ts`. */
import * as fc from '@fast-check/vitest'
import { expect } from 'vitest'

import { setPresence, withPresence } from '../set'

fc.test.prop({
  set: fc.fc.array(fc.fc.anything(), { minLength: 1 }).map((array) => new Set(array)),
  item: fc.fc.anything(),
})('Manipulating `Set` presence', ({ set, item }) => {
  expect(withPresence(set, item, true).has(item)).toBe(true)
  expect(withPresence(set, item, false).has(item)).toBe(false)
  expect(setPresence(set, item, true).has(item)).toBe(true)
  expect(setPresence(set, item, false).has(item)).toBe(false)
})
