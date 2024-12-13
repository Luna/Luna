/** @file Tests for `fileInfo.ts`. */
import { expect, test } from 'vitest'

import { fileExtension } from '../fileInfo'

test('fileExtension', () => {
  expect(fileExtension('image.png')).toBe('png')
  expect(fileExtension('.gif')).toBe('gif')
  expect(fileExtension('fileInfo.spec.js')).toBe('js')
})
