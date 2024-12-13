/** @file Tests for password validation. */
import { expect, test } from 'vitest'

import { DIRECTORY_NAME_REGEX, PASSWORD_REGEX } from '#/utilities/validation'

/** Runs all tests. */
test('password validation', () => {
  const regex = PASSWORD_REGEX
  const emptyPassword = ''
  expect(emptyPassword, `'${emptyPassword}' fails validation`).not.toMatch(regex)
  const shortPassword = 'Aa0!'
  expect(shortPassword, `'${shortPassword}' is too short`).not.toMatch(regex)
  const passwordMissingDigit = 'Aa!Aa!Aa!'
  expect(passwordMissingDigit, `'${passwordMissingDigit}' is missing a digit`).not.toMatch(regex)
  const passwordMissingLowercase = 'A0!A0!A0!'
  expect(
    passwordMissingLowercase,
    `'${passwordMissingLowercase}' is missing a lowercase letter`,
  ).not.toMatch(regex)
  const passwordMissingUppercase = 'a0!a0!a0!'
  expect(
    passwordMissingUppercase,
    `'${passwordMissingUppercase}' is missing an uppercase letter`,
  ).not.toMatch(regex)
  const passwordMissingSymbol = 'Aa0Aa0Aa0'
  expect(passwordMissingSymbol, `'${passwordMissingSymbol}' is missing a symbol`).not.toMatch(regex)
  const validPassword = 'Aa0!Aa0!'
  expect(validPassword, `'${validPassword}' passes validation`).toMatch(regex)
  const basicPassword = 'Password0!'
  expect(basicPassword, `'${basicPassword}' passes validation`).toMatch(regex)
  const issue7498Password = 'ÑéFÛÅÐåÒ.ú¿¼\u00b4N@aö¶U¹jÙÇ3'
  expect(issue7498Password, `'${issue7498Password}' passes validation`).toMatch(regex)
})

test.each([
  { name: 'foo', valid: true },
  { name: 'foo/', valid: false },
  { name: 'foo\\', valid: false },
  { name: 'foo/bar', valid: false },
  { name: 'foo\\bar', valid: false },
  { name: '/bar', valid: false },
  { name: '\\bar', valid: false },
  { name: '\\', valid: false },
  { name: '/', valid: false },
  { name: '......', valid: false },
  { name: '..', valid: false },
  { name: '.', valid: true },
  { name: 'a.a.a.a.a.a.a.a.', valid: true },
  { name: 'a.a.a.a.a.a.a.a.a', valid: true },
  { name: '.a.a.a.a.a.a.a.a', valid: true },
  { name: 'a.a.a.a.a.a.a.a..', valid: false },
  { name: './', valid: false },
  { name: '//', valid: false },
  { name: '/\\', valid: false },
  { name: '\\/', valid: false },
])('directory name validation', (args) => {
  const { name, valid } = args
  const regex = DIRECTORY_NAME_REGEX
  if (valid) {
    expect(name, `'${name}' is a valid directory name`).toMatch(regex)
  } else {
    expect(name, `'${name}' is not a valid directory name`).not.toMatch(regex)
  }
})
