import * as fc from '@fast-check/vitest'
import { expect, test } from 'vitest'

import { includesPredicate, shallowEqual, transpose } from '../array'

interface TransposeCase {
  matrix: number[][]
  expected: number[][]
}

const transposeCases: TransposeCase[] = [
  { matrix: [], expected: [] },
  { matrix: [[]], expected: [[]] },
  { matrix: [[1]], expected: [[1]] },
  { matrix: [[1, 2]], expected: [[1], [2]] },
  { matrix: [[1], [2]], expected: [[1, 2]] },
  {
    matrix: [
      [1, 2, 3],
      [4, 5, 6],
    ],
    expected: [
      [1, 4],
      [2, 5],
      [3, 6],
    ],
  },
]

test.each(transposeCases)('transpose: case %#', ({ matrix, expected }) => {
  const transposed = transpose(matrix)
  expect(transposed).toStrictEqual(expected)
})

fc.test.prop({ theArray: fc.fc.array(fc.fc.anything()) })(
  '`array.shallowEqual`',
  ({ theArray }) => {
    expect(shallowEqual(theArray, [...theArray]))
  },
)

fc.test.prop({
  theArray: fc.fc.array(fc.fc.anything(), { minLength: 1 }).chain(theArray =>
    fc.fc.record({
      theArray: fc.fc.constant(theArray),
      i: fc.fc.nat(theArray.length - 1),
    }),
  ),
})('`array.includesPredicate`', ({ theArray: { theArray, i } }) => {
  expect(
    includesPredicate(theArray)(theArray[i]),
    `'${JSON.stringify(theArray)}' should include '${JSON.stringify(theArray[i])}'`,
  ).toBe(true)
  expect(includesPredicate(theArray)({}), 'unique object should not be in array').toBe(false)
})
