package org.enso.std.test

import org.enso.interpreter.test.{InterpreterContext, InterpreterTest}

class BooleanTest extends InterpreterTest {
  override def subject = "Booleans"

  override def specify(implicit
    interpreterContext: InterpreterContext
  ): Unit = {

    val defaultImports =
      """
        |from Standard.Base.Data.Boolean import all
        |import Standard.Base.IO
        |""".stripMargin

    "support if_then_else" in {
      val code =
        s"""$defaultImports
           |
           |main =
           |    if True then IO.println "true when true" else IO.println "false when true"
           |    if False then IO.println "true when false" else IO.println "false when false"
           |""".stripMargin
      eval(code)
      consumeOut shouldEqual List("true when true", "false when false")
    }

    "support overriding methods on boolean" in {
      val code =
        """from Standard.Base.Data.Boolean import all
          |import Standard.Base.IO
          |import Standard.Base.Any.Any
          |
          |Boolean.isTrue self = self
          |
          |main =
          |    true = 1 == 1
          |    false = 1 == 2
          |    IO.println true.isTrue
          |    IO.println false.isTrue
          |""".stripMargin
      eval(code)
      consumeOut shouldEqual List("True", "False")
    }

    "support pattern matching" in {
      val code =
        """from Standard.Base.Data.Boolean import all
          |
          |to_num b = case b of
          |    True -> 1
          |    False -> 2
          |    _ -> 10
          |
          |main =
          |    to_num True + to_num False
          |""".stripMargin
      eval(code) shouldEqual 3
    }

    "support logical AND and OR operators" in {
      val code =
        s"""$defaultImports
           |
           |main =
           |    IO.println True&&False
           |    IO.println True&&True
           |    IO.println True&&Boolean.True
           |    IO.println False||False
           |    IO.println True||False
           |    IO.println ((True && False) || (True && True))
           |""".stripMargin
      eval(code)
      consumeOut shouldEqual List(
        "False",
        "True",
        "True",
        "False",
        "True",
        "True"
      )
    }

    "support negation" in {
      val code =
        s"""$defaultImports
           |
           |main =
           |    IO.println True.not
           |    IO.println Boolean.True.not
           |    IO.println False.not
           |    IO.println Boolean.False.not
           |    IO.println (1==2 . not)
           |""".stripMargin
      eval(code)
      consumeOut shouldEqual List("False", "False", "True", "True", "True")
    }

    "literal equals atom constructor" in {
      val code =
        s"""$defaultImports
           |
           |main =
           |    IO.println (False == Boolean.False)
           |    IO.println (Boolean.False == False)
           |    IO.println (True == Boolean.True)
           |    IO.println (Boolean.True == True)
           |
           |""".stripMargin
      eval(code)
      consumeOut shouldEqual List("True", "True", "True", "True")
    }
  }
}
