<script setup lang="ts">
import MarkdownEditorImpl from '@/components/MarkdownEditor/MarkdownEditorImpl.vue'
import type { Text } from '@codemirror/state'
import { SyntaxNode, TreeCursor } from '@lezer/common'
import { computed, shallowRef, watch } from 'vue'

const { source, parsed } = defineProps<{
  source: Text
  parsed: SyntaxNode
}>()

const emit = defineEmits<{
  edit: []
}>()

function parseRow(cursor: TreeCursor, output: string[]) {
  if (!cursor.firstChild()) return
  do {
    if (cursor.name === 'TableCell') {
      output.push(source.sliceString(cursor.from, cursor.to))
    } else if (cursor.name !== 'TableDelimiter') {
      console.warn('Unexpected in table row:', cursor.name)
    }
  } while (cursor.nextSibling())
  cursor.parent()
}

const content = computed(() => {
  let headers: string[] = []
  let rows: string[][] = []
  const cursor = parsed.cursor()
  if (cursor.firstChild()) {
    do {
      if (cursor.name === 'TableRow') {
        const newRow: string[] = []
        parseRow(cursor, newRow)
        rows.push(newRow)
      } else if (cursor.name === 'TableHeader') {
        parseRow(cursor, headers)
      } else if (cursor.name !== 'TableDelimiter') {
        console.warn('Unexpected at top level of table:', cursor.name)
      }
    } while (cursor.nextSibling())
  }
  return { headers, rows }
})
</script>

<template>
  <table>
    <thead>
      <tr>
        <th v-for="cell in content.headers" class="cell">
          <MarkdownEditorImpl :content="cell" />
        </th>
      </tr>
    </thead>
    <tbody class="tableBody">
      <tr v-for="row in content.rows" class="row">
        <td v-for="cell in row" class="cell">
          <MarkdownEditorImpl :content="cell" />
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
:deep(.cm-line) {
  padding-right: 6px;
}
</style>
