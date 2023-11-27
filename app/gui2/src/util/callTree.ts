import type { SuggestionEntryArgument } from '@/stores/suggestionDatabase/entry'
import { tryGetIndex } from './array'
import { Ast } from './ast'

export const enum ApplicationKind {
  Prefix,
  Infix,
}

/**
 * Information about an argument that doesn't have an assigned value yet, therefore are not
 * represented in the AST.
 */
export class ArgumentPlaceholder {
  constructor(
    public index: number,
    public info: SuggestionEntryArgument,
    public kind: ApplicationKind,
  ) {}
}

export class ArgumentAst {
  constructor(
    public ast: Ast.Ast,
    public index: number | undefined,
    public info: SuggestionEntryArgument | undefined,
    public kind: ApplicationKind,
  ) {}
}

export class ArgumentApplication {
  private constructor(
    public appTree: Ast.Ast | undefined,
    public target: ArgumentApplication | Ast.Ast | ArgumentPlaceholder | ArgumentAst,
    public infixOperator: Ast.Tok | undefined,
    public argument: ArgumentAst | ArgumentPlaceholder,
  ) {}

  static FromAstWithInfo(
    callRoot: Ast.Ast,
    knownArguments: SuggestionEntryArgument[] | undefined,
    notAppliedArguments: number[],
  ): ArgumentApplication | Ast.Ast {
    interface FoundApplication {
      appTree: Ast.App
      argument: Ast.Ast
      argName: string | undefined
    }

    // Infix chains are handled one level at a time. Each application may have at most 2 arguments.
    if (callRoot instanceof Ast.OprApp) {
      const oprApp = callRoot
      const infixOperator = callRoot.operator.ok ? callRoot.operator.value : undefined
      const argFor = (key: 'lhs' | 'rhs', index: number) => {
        const tree = oprApp[key]
        const info = tryGetIndex(knownArguments, index) ?? unknownArgInfoNamed(key)
        return tree != null
          ? new ArgumentAst(tree, 0, info, ApplicationKind.Infix)
          : new ArgumentPlaceholder(0, info, ApplicationKind.Infix)
      }
      return new ArgumentApplication(callRoot, argFor('lhs', 0), infixOperator, argFor('rhs', 1))
    }

    // Prefix chains are handled all at once, as they may have arbitrary number of arguments.
    const foundApplications: FoundApplication[] = []
    let nextApplication = callRoot
    // Traverse the AST and find all arguments applied in sequence to the same function.
    while (nextApplication instanceof Ast.App) {
      foundApplications.push({
        appTree: nextApplication,
        argument: nextApplication.argument,
        argName: nextApplication.argumentName?.code(),
      })
      nextApplication = nextApplication.function
    }

    // The applications are peeled away from outer to inner, so arguments are in reverse order. We
    // need to reverse them back to match them with the order in suggestion entry.
    const foundArgs = foundApplications.reverse()

    const notAppliedSet = new Set(notAppliedArguments)
    const argumentsLeftToMatch = Array.from(knownArguments ?? [], (_, i) => i).filter(
      (_, i) => !notAppliedSet.has(i),
    )

    const prefixArgsToDisplay: Array<{
      appTree: Ast.Ast
      argument: ArgumentAst | ArgumentPlaceholder
    }> = []

    function insertPlaceholdersUpto(index: number, appTree: Ast.Ast) {
      while (notAppliedArguments[0] != null && notAppliedArguments[0] < index) {
        const argIndex = notAppliedArguments.shift()
        const argInfo = tryGetIndex(knownArguments, argIndex)
        if (argIndex != null && argInfo != null)
          prefixArgsToDisplay.push({
            appTree,
            argument: new ArgumentPlaceholder(argIndex, argInfo, ApplicationKind.Prefix),
          })
      }
    }

    for (const realArg of foundArgs) {
      if (realArg.argName == null) {
        const argIndex = argumentsLeftToMatch.shift()
        if (argIndex != null) insertPlaceholdersUpto(argIndex, realArg.appTree)
        prefixArgsToDisplay.push({
          appTree: realArg.appTree,
          argument: new ArgumentAst(
            realArg.argument,
            argIndex,
            // If we have more arguments applied than we know about, display that argument anyway, but
            // mark it as unknown.
            tryGetIndex(knownArguments, argIndex),
            ApplicationKind.Prefix,
          ),
        })
      } else {
        // When name is present, we need to find the argument with the same name in the list of
        // known arguments.
        const name = realArg.argName
        const foundIdx = argumentsLeftToMatch.findIndex((i) => knownArguments?.[i]?.name === name)
        const argIndex = foundIdx === -1 ? undefined : argumentsLeftToMatch.splice(foundIdx, 1)[0]
        if (argIndex != null && foundIdx === 0) insertPlaceholdersUpto(argIndex, realArg.appTree)
        prefixArgsToDisplay.push({
          appTree: realArg.appTree,
          argument: new ArgumentAst(
            realArg.argument,
            argIndex,
            tryGetIndex(knownArguments, argIndex) ?? unknownArgInfoNamed(name),
            ApplicationKind.Prefix,
          ),
        })
      }
    }

    insertPlaceholdersUpto(Infinity, nextApplication)

    return prefixArgsToDisplay.reduce(
      (target: ArgumentApplication | Ast.Ast, toDisplay) =>
        new ArgumentApplication(toDisplay.appTree, target, undefined, toDisplay.argument),
      nextApplication,
    )
  }
}

const unknownArgInfoNamed = (name: string) => ({
  name,
  type: 'Any',
  isSuspended: false,
  hasDefault: false,
})

declare const ArgumentApplicationKey: unique symbol
declare const ArgumentPlaceholderKey: unique symbol
declare const ArgumentAstKey: unique symbol
declare module '@/providers/widgetRegistry' {
  export interface WidgetInputTypes {
    [ArgumentApplicationKey]: ArgumentApplication
    [ArgumentPlaceholderKey]: ArgumentPlaceholder
    [ArgumentAstKey]: ArgumentAst
  }
}
