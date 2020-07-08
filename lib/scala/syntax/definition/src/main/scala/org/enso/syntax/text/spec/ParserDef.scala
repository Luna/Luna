package org.enso.syntax.text.spec

import org.enso.flexer
import org.enso.flexer.{Reader, State}
import org.enso.flexer.automata.Pattern
import org.enso.flexer.automata.Pattern._
import org.enso.syntax.text.AST

import scala.annotation.tailrec

case class ParserDef() extends flexer.Parser[AST.Module] {
  import ParserDef2._

  final def unwrap[T](opt: Option[T]): T =
    opt match {
      case None    => throw new Error("Internal Error")
      case Some(t) => t
    }

  /////////////
  //// API ////
  /////////////

  override def run(input: Reader): Result[AST.Module] = {
    state.begin(ROOT)
    super.run(input)
  }

  // === Debug Lexer Definition ===

  /* a-word   = 'a'+;
   * b-word   = 'b'+;
   * word     = a-word | b-word;
   * space    = ' ';
   * language = word, (space, word)*;
   */

  val aWord: Pattern       = 'a'.many1
  val bWord: Pattern       = 'b'.many1
  val space: Pattern       = ' '
  val spacedAWord: Pattern = space >> aWord
  val spacedBWord: Pattern = space >> bWord

  final object Word {
    var current: Option[AST.Ident] = None

    def onFirstWord(word: String => AST.Ident): Unit =
      logger.trace_ {
        onFirstWord(word(currentMatch))
      }

    def onFirstWord(ast: AST.Ident): Unit =
      logger.trace {
        current = Some(ast)
        state.begin(SEEN_FIRST_WORD)
      }

    def onSpacedWord(word: String => AST.Ident): Unit =
      logger.trace_ {
        onSpacedWord(word(currentMatch.stripLeading()))
      }

    def onSpacedWord(ast: AST.Ident): Unit =
      logger.trace {
        current = Some(ast)
      }

    def onNoErrSuffix(): Unit =
      logger.trace {
        submit()
        state.end()
      }

    def onErrSuffix(): Unit =
      logger.trace {
        val ast = AST.Invalid.Unrecognized(currentMatch)
        result.app(ast)
        current = None
        state.end()
      }

    def submit(): Unit =
      logger.trace {
        result.app(unwrap(current))
        current = None
      }

    val SEEN_FIRST_WORD: State = state.define("Inside Word")
  }

  ROOT                 || aWord       || Word.onFirstWord(AST.Var(_))
  ROOT                 || bWord       || Word.onFirstWord(AST.Var(_))
  ROOT                 || always      || Word.onErrSuffix()
  Word.SEEN_FIRST_WORD || spacedAWord || Word.onSpacedWord(AST.Var(_))
  Word.SEEN_FIRST_WORD || spacedBWord || Word.onSpacedWord(AST.Var(_))
  Word.SEEN_FIRST_WORD || always      || Word.onNoErrSuffix()

  ////////////////
  //// Result ////
  ////////////////

  override def getResult() =
    result.current.flatMap {
      case AST.Module.any(mod) => Some(mod)
      case _                   => None
    }

  final object result {

    var current: Option[AST]     = None
    var stack: List[Option[AST]] = Nil

    def push(): Unit =
      logger.trace {
        logger.log(s"Pushed: $current")
        stack +:= current
        current = None
      }

    def pop(): Unit =
      logger.trace {
        current = stack.head
        stack   = stack.tail
        logger.log(s"New result: ${current.map(_.show()).getOrElse("None")}")
      }

    def app(fn: String => AST): Unit =
      app(fn(currentMatch))

    def app(ast: AST): Unit =
      logger.trace {
        current = Some(current match {
          case None    => ast
          case Some(r) => AST.App.Prefix(r, ast)
        })
      }

    def last(): Option[AST] = {
      @tailrec
      def go(ast: AST): AST =
        ast match {
          case AST.App.Prefix.any(t) => go(t.arg)
          case t                     => t
        }
      current.map(go)
    }
  }
}

object ParserDef2 {
  type Result[T] = flexer.Parser.Result[T]
}
