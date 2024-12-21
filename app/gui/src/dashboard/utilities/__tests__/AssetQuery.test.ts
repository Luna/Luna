/** @file Tests for {@link AssetQuery}. */
import { expect, test } from 'vitest'

import AssetQuery from '#/utilities/AssetQuery'

test.each([
  { query: '' },
  { query: 'name:', names: [[]] },
  { query: '-name:', negativeNames: [[]] },
  { query: 'label:', labels: [[]] },
  { query: '-label:', negativeLabels: [[]] },
  { query: 'owner:', owners: [[]] },
  { query: '-owner:', negativeOwners: [[]] },
  { query: '"', keywords: [['']] },
  { query: '""', keywords: [['']] },
  { query: 'a', keywords: [['a']] },
  { query: 'a b', keywords: [['a'], ['b']] },
  { query: '"a" "b"', keywords: [['a'], ['b']] },
  { query: 'a,b', keywords: [['a', 'b']] },
  { query: '"a","b"', keywords: [['a', 'b']] },
  { query: '-:a', negativeKeywords: [['a']] },
  { query: '-:a,b', negativeKeywords: [['a', 'b']] },
  { query: 'name:a,b', names: [['a', 'b']] },
  { query: '-name:a', negativeNames: [['a']] },
  { query: '-name:a,b', negativeNames: [['a', 'b']] },
  { query: 'label:a', labels: [['a']] },
  { query: '-label:a', negativeLabels: [['a']] },
  { query: 'owner:a', owners: [['a']] },
  { query: '-owner:a', negativeOwners: [['a']] },
  { query: 'no:a', nos: [['a']] },
  { query: '-no:a', negativeNos: [['a']] },
  { query: 'has:a', negativeNos: [['a']] },
  { query: '-has:a', nos: [['a']] },
  // Ensure that invalid queries are parsed reasonably
  { query: '-label', keywords: [['-label']] },
  { query: '"a" "b', keywords: [['a'], ['b']] },
  { query: '"a","b', keywords: [['a', 'b']] },
  { query: '"a""b"', keywords: [['a', 'b']] },
  { query: '"a""b', keywords: [['a', 'b']] },
  { query: '"a"b"', keywords: [['a', 'b"']] },
])(
  'AssetQuery.fromString',
  ({
    query,
    keywords,
    negativeKeywords,
    names,
    negativeNames,
    labels,
    negativeLabels,
    owners,
    negativeOwners,
    nos,
    negativeNos,
  }) => {
    const parsed = AssetQuery.fromString(query)
    expect(parsed.keywords, `Keywords in '${query}'`).toEqual(keywords ?? [])
    expect(parsed.negativeKeywords, `Negative keywords in '${query}'`).toEqual(
      negativeKeywords ?? [],
    )
    expect(parsed.names, `Names in '${query}'`).toEqual(names ?? [])
    expect(parsed.negativeNames, `Negative names in '${query}'`).toEqual(negativeNames ?? [])
    expect(parsed.labels, `Labels in '${query}'`).toEqual(labels ?? [])
    expect(parsed.negativeLabels, `Negative labels in '${query}'`).toEqual(negativeLabels ?? [])
    expect(parsed.owners, `Owners in '${query}'`).toEqual(owners ?? [])
    expect(parsed.negativeOwners, `Negative owners in '${query}'`).toEqual(negativeOwners ?? [])
    expect(parsed.nos, `Nos in '${query}'`).toEqual(nos ?? [])
    expect(parsed.negativeNos, `Negative nos in '${query}'`).toEqual(negativeNos ?? [])
  },
)

test.each([{ query: 'a', updates: { keywords: [['b']] }, newQuery: 'a b' }])(
  'AssetQuery#add',
  ({ query, updates, newQuery }) => {
    const parsed = AssetQuery.fromString(query)
    expect(
      parsed.add(updates).toString(),
      `'${query}' with ${JSON.stringify(updates)} added should be '${newQuery}'`,
    ).toBe(newQuery)
  },
)

test.each([
  { query: 'a b', updates: { keywords: [['b']] }, newQuery: 'a' },
  { query: 'a', updates: { keywords: [['a']] }, newQuery: '' },
  // Edge cases. The exact result should not matter, as long as it is reasonable.
  { query: 'a a', updates: { keywords: [['a']] }, newQuery: '' },
])('AssetQuery#delete', ({ query, updates, newQuery }) => {
  const parsed = AssetQuery.fromString(query)
  expect(
    parsed.delete(updates).toString(),
    `'${query}' with ${JSON.stringify(updates)} deleted should be '${newQuery}'`,
  ).toBe(newQuery)
})

test.each([{ query: 'a', updates: { keywords: ['b'] }, newQuery: 'a,b' }])(
  'AssetQuery#addToLastTerm',
  ({ query, updates, newQuery }) => {
    const parsed = AssetQuery.fromString(query)
    expect(
      parsed.addToLastTerm(updates).toString(),
      `'${query}' with ${JSON.stringify(updates)} added should be '${newQuery}'`,
    ).toBe(newQuery)
  },
)

test.each([
  { query: 'a b', updates: { keywords: ['b'] }, newQuery: 'a' },
  { query: 'a b', updates: { keywords: ['a'] }, newQuery: 'a b' },
  { query: 'a b,c', updates: { keywords: ['c'] }, newQuery: 'a b' },
  { query: 'a b,c', updates: { keywords: ['b', 'd', 'e', 'f'] }, newQuery: 'a c' },
  { query: 'a b,c', updates: { keywords: ['b', 'c'] }, newQuery: 'a' },
  { query: 'a', updates: { keywords: ['a'] }, newQuery: '' },
  { query: 'a b c', updates: { keywords: ['b', 'c'] }, newQuery: 'a b' },
])('AssetQuery#deleteFromLastTerm', ({ query, updates, newQuery }) => {
  const parsed = AssetQuery.fromString(query)
  expect(
    parsed.deleteFromLastTerm(updates).toString(),
    `'${query}' with ${JSON.stringify(updates)} deleted should be '${newQuery}'`,
  ).toBe(newQuery)
})

test.each([
  { query: 'a b a', updates: { keywords: ['b'] }, newQuery: 'a a' },
  { query: 'a b a', updates: { keywords: ['a'] }, newQuery: 'b' },
  { query: 'a b,c', updates: { keywords: ['c'] }, newQuery: 'a b' },
  { query: 'a b,c', updates: { keywords: ['b', 'd', 'e', 'f'] }, newQuery: 'a c' },
  { query: 'a b,c', updates: { keywords: ['b', 'c'] }, newQuery: 'a' },
  { query: 'b,c a', updates: { keywords: ['b', 'c'] }, newQuery: 'a' },
  { query: 'a', updates: { keywords: ['a'] }, newQuery: '' },
  { query: 'a b c', updates: { keywords: ['b', 'c'] }, newQuery: 'a' },
])('AssetQuery#deleteFromEveryTerm', ({ query, updates, newQuery }) => {
  const parsed = AssetQuery.fromString(query)
  expect(
    parsed.deleteFromEveryTerm(updates).toString(),
    `'${query}' with ${JSON.stringify(updates)} deleted should be '${newQuery}'`,
  ).toBe(newQuery)
})
