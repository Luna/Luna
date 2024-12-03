/** @file Test the search bar and its suggestions. */
import { expect, test } from '@playwright/test'

import { COLORS } from '#/services/Backend'

import {
  locateSearchBarInput,
  locateSearchBarLabels,
  locateSearchBarSuggestions,
  locateSearchBarTags,
  mockAllAndLogin,
} from './actions'

test('tags (positive)', async ({ page }) => {
  await mockAllAndLogin({ page })
  const searchBarInput = locateSearchBarInput(page)
  const tags = locateSearchBarTags(page)

  await searchBarInput.click()
  for (const positiveTag of await tags.all()) {
    await searchBarInput.selectText()
    await searchBarInput.press('Backspace')
    const text = (await positiveTag.textContent()) ?? ''
    expect(text.length).toBeGreaterThan(0)
    await positiveTag.click()
    await expect(searchBarInput).toHaveValue(text)
  }
})

test('tags (negative)', async ({ page }) => {
  await mockAllAndLogin({ page })
  const searchBarInput = locateSearchBarInput(page)
  const tags = locateSearchBarTags(page)

  await searchBarInput.click()
  await page.keyboard.down('Shift')
  for (const negativeTag of await tags.all()) {
    await searchBarInput.selectText()
    await searchBarInput.press('Backspace')
    const text = (await negativeTag.textContent()) ?? ''
    expect(text.length).toBeGreaterThan(0)
    await negativeTag.click()
    await expect(searchBarInput).toHaveValue(text)
  }
})

test('labels', async ({ page }) => {
  await mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addLabel('aaaa', COLORS[0])
      api.addLabel('bbbb', COLORS[1])
      api.addLabel('cccc', COLORS[2])
      api.addLabel('dddd', COLORS[3])
    },
  })
  const searchBarInput = locateSearchBarInput(page)
  const labels = locateSearchBarLabels(page)

  await searchBarInput.click()
  for (const label of await labels.all()) {
    const name = (await label.textContent()) ?? ''
    expect(name.length).toBeGreaterThan(0)
    await label.click()
    await expect(searchBarInput).toHaveValue('label:' + name)
    await label.click()
    await expect(searchBarInput).toHaveValue('-label:' + name)
    await label.click()
    await expect(searchBarInput).toHaveValue('')
  }
})

test('suggestions', async ({ page }) => {
  await mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addDirectory('foo')
      api.addProject('bar')
      api.addSecret('baz')
      api.addSecret('quux')
    },
  })

  const searchBarInput = locateSearchBarInput(page)
  const suggestions = locateSearchBarSuggestions(page)

  await searchBarInput.click()

  for (const suggestion of await suggestions.all()) {
    const name = (await suggestion.textContent()) ?? ''
    expect(name.length).toBeGreaterThan(0)
    await suggestion.click()
    await expect(searchBarInput).toHaveValue('name:' + name)
    await searchBarInput.selectText()
    await searchBarInput.press('Backspace')
  }
})

test('suggestions (keyboard)', async ({ page }) => {
  await mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addDirectory('foo')
      api.addProject('bar')
      api.addSecret('baz')
      api.addSecret('quux')
    },
  })

  const searchBarInput = locateSearchBarInput(page)
  const suggestions = locateSearchBarSuggestions(page)

  await searchBarInput.click()
  for (const suggestion of await suggestions.all()) {
    const name = (await suggestion.textContent()) ?? ''
    expect(name.length).toBeGreaterThan(0)
    await page.press('body', 'ArrowDown')
    await expect(searchBarInput).toHaveValue('name:' + name)
  }
})

test('complex flows', async ({ page }) => {
  const firstName = 'foo'

  await mockAllAndLogin({
    page,
    setupAPI: (api) => {
      api.addDirectory(firstName)
      api.addProject('bar')
      api.addSecret('baz')
      api.addSecret('quux')
    },
  })
  const searchBarInput = locateSearchBarInput(page)

  await searchBarInput.click()
  await page.press('body', 'ArrowDown')
  await expect(searchBarInput).toHaveValue('name:' + firstName)
  await searchBarInput.selectText()
  await searchBarInput.press('Backspace')
  await expect(searchBarInput).toHaveValue('')
  await page.press('body', 'ArrowDown')
  await expect(searchBarInput).toHaveValue('name:' + firstName)
})
