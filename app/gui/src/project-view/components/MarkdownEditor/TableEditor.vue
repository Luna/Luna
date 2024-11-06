<script setup lang="ts">
import TableEditorCell from '@/components/MarkdownEditor/TableEditorCell.vue'
import type { Text } from '@codemirror/state'
import { SyntaxNode, TreeCursor } from '@lezer/common'
import { shallowRef, watch } from 'vue'

const { source, parsed } = defineProps<{
  source: Text
  parsed: SyntaxNode
}>()

const emit = defineEmits<{
  edit: []
}>()

const headers = shallowRef(new Array<string>())
const rows = shallowRef(new Array<string[]>())

function parseRow(cursor: TreeCursor, output: string[]) {
  if (!cursor.firstChild()) return
  do {
    if (cursor.name === 'TableCell') {
      output.push(source.sliceString(cursor.from, cursor.to))
    } else if (cursor.name === 'TableDelimiter') {
    } else {
      console.warn('Unexpected in table row:', cursor.name)
    }
  } while (cursor.nextSibling())
  cursor.parent()
}

watch(
  () => parsed,
  (parsed) => {
    const cursor = parsed.cursor()
    if (!cursor.firstChild()) return
    let newRows: string[][] = []
    let newHeaders: string[] = []
    do {
      if (cursor.name === 'TableRow') {
        const newRow: string[] = []
        parseRow(cursor, newRow)
        newRows.push(newRow)
      } else if (cursor.name === 'TableHeader') {
        parseRow(cursor, newHeaders)
      } else if (cursor.name === 'TableDelimiter') {
      } else {
        console.warn('Unexpected at top level of table:', cursor.name)
      }
    } while (cursor.nextSibling())
    headers.value = newHeaders
    rows.value = newRows
  },
  { immediate: true },
)
</script>

<template>
  <table>
    <thead>
      <tr>
        <th v-for="cell in headers" class="cell">
          <TableEditorCell :source="cell" />
        </th>
      </tr>
    </thead>
    <tbody class="tableBody">
      <tr v-for="row in rows" class="row">
        <td v-for="cell in row" class="cell">
          <TableEditorCell :source="cell" />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.cell {
  border: 1px solid #dddddd;
}
.tableBody .row:nth-of-type(even) {
  background-color: #f3f3f3;
}
</style>
