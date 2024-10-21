import { type GraphStore } from '@/stores/graph'
import { Ast } from '@/util/ast'
import { type ToValue } from '@/util/reactivity'
import { computed, toValue } from 'vue'

/** A composable for reactively retrieving and setting documentation from given Ast node. */
export function useAstDocumentation(graphStore: GraphStore, ast: ToValue<Ast.Ast | undefined>) {
  return {
    documentation: {
      state: computed(() => {
        const astValue = toValue(ast)
        return (astValue?.isStatement() ? astValue.documentationText() : undefined) ?? ''
      }),
      set: (text: string | undefined) => {
        const astValue = toValue(ast)
        graphStore.edit((edit) => {
          if (astValue?.isStatement()) {
            const editAst = edit.getVersion(astValue)
            if ('setDocumentationText' in editAst) {
              editAst.setDocumentationText(text)
              return
            }
          }
          console.error('Unable to set documentation', astValue?.id)
        })
      },
    },
  }
}
