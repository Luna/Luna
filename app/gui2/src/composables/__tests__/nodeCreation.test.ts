import { insertNodeStatements } from '@/composables/nodeCreation'
import { Ast } from '@/util/ast'
import { identifier } from 'shared/ast'
import { initializeFFI } from 'shared/ast/ffi'
import { expect, test } from 'vitest'

await initializeFFI()

test.each([
  ['node1 = 123', '*'],
  ['node1 = 123', '*', 'node1'],
  ['node1 = 123', '', '*', 'node1'],
  ['*', 'node1'],
  ['', '*', 'node1'],
  ['*', '## Return value', 'node1'],
  ['*', '## Return value', '', 'node1'],
  ['*', '## Block ends in documentation?!'],
])('New node location in block', (...linesWithInsertionPoint: string[]) => {
  const inputLines = linesWithInsertionPoint.filter((line) => line !== '*')
  const bodyBlock = Ast.parseBlock(inputLines.join('\n'))
  insertNodeStatements(bodyBlock, [Ast.parse('newNodePositionMarker')])
  const lines = bodyBlock
    .code()
    .split('\n')
    .map((line) => (line === 'newNodePositionMarker' ? '*' : line))
  expect(lines).toEqual(linesWithInsertionPoint)
})

// This is a special case because when a block is empty, adding a line requires adding *two* linebreaks.
test('Adding node to empty block', () => {
  const module = Ast.MutableModule.Transient()
  const func = Ast.Function.fromStatements(module, identifier('f')!, [], [])
  const rootBlock = Ast.BodyBlock.new([], module)
  rootBlock.push(func)
  expect(rootBlock.code().trimEnd()).toBe('f =')
  insertNodeStatements(func.bodyAsBlock(), [Ast.parse('newNode')])
  expect(
    rootBlock
      .code()
      .split('\n')
      .map((line) => line.trimEnd()),
  ).toEqual(['f =', '    newNode'])
})
