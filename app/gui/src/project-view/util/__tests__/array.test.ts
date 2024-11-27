import { shallowEquality } from '#/utilities/equalities'
import { findDifferenceIndex, partitionPoint } from '@/util/data/array'
import { fc, test } from '@fast-check/vitest'
import { expect } from 'vitest'

const isEven = (n: number) => n % 2 === 0
const isOdd = (n: number) => n % 2 === 1

test.prop({
  evens: fc.array(fc.nat(1_000_000_000)).map((a) => a.map((n) => n * 2)),
  odds: fc.array(fc.nat(1_000_000_000)).map((a) => a.map((n) => n * 2 + 1)),
})('partitionPoint (even/odd)', ({ evens, odds }) => {
  expect(partitionPoint([...evens, ...odds], isEven)).toEqual(evens.length)
  expect(partitionPoint([...odds, ...evens], isOdd)).toEqual(odds.length)
})

test.prop({
  arr: fc.array(fc.float({ noNaN: true })).chain((a) => {
    const sorted = a.sort((a, b) => a - b)
    return fc.record({
      arr: fc.constant(sorted),
      i: fc.nat({ max: Math.max(sorted.length - 1, 0) }).map((i) => Math.max(0, a.indexOf(a[i]!))),
    })
  }),
})('partitionPoint (ascending)', ({ arr: { arr, i } }) => {
  const target = arr[i]!
  expect(partitionPoint(arr, (n) => n < target)).toEqual(i)
})

test.prop({
  arr: fc.array(fc.float({ noNaN: true })).chain((a) => {
    const sorted = a.sort((a, b) => b - a)
    return fc.record({
      arr: fc.constant(sorted),
      i: fc.nat({ max: Math.max(sorted.length - 1, 0) }).map((i) => Math.max(0, a.indexOf(a[i]!))),
    })
  }),
})('partitionPoint (descending)', ({ arr: { arr, i } }) => {
  const target = arr[i]!
  expect(partitionPoint(arr, (n) => n > target)).toEqual(i)
})

test.prop({
  arr1: fc.array(fc.anything()),
  arr2: fc.array(fc.anything()),
  returnedIndex: fc.context(),
})('findDifferenceIndex (anything)', ({ arr1, arr2, returnedIndex }) => {
  const differenceIndex = findDifferenceIndex(arr1, arr2)
  returnedIndex.log(`${differenceIndex}`)
  const shorterArrayLen = Math.min(arr1.length, arr2.length)
  expect(differenceIndex).toBeLessThanOrEqual(shorterArrayLen)
  expect(arr1.slice(0, differenceIndex)).toEqual(arr2.slice(0, differenceIndex))
  if (differenceIndex < shorterArrayLen) {
    expect(arr1[differenceIndex]).not.toEqual(arr2[differenceIndex])
  }
})
