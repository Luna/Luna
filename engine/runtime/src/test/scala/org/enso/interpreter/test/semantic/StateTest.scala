package org.enso.interpreter.test.semantic

import org.enso.interpreter.test.{InterpreterTest, InterpreterContext}

class StateTest extends InterpreterTest {
  override def subject: String = "State"

  override def specify(
    implicit interpreterContext: InterpreterContext
  ): Unit = {

    "be accessible from functions" in {
      val code =
        """
          |stateful =
          |    State.put Number 10
          |    x = State.get Number
          |    State.put Number x+1
          |    State.get Number
          |
          |main = State.run Number 0 here.stateful
          |""".stripMargin

      eval(code) shouldEqual 11
    }

    "be implicitly threaded through function executions" in {
      val code =
        """
          |inc_state =
          |  x = State.get Number
          |  State.put Number x+1
          |
          |run =
          |    here.inc_state
          |    here.inc_state
          |    here.inc_state
          |    here.inc_state
          |    here.inc_state
          |    State.get Number
          |
          |main = State.run Number 0 here.run
          |""".stripMargin

      eval(code) shouldEqual 5
    }

    "work well with recursive code" in {
      val code =
        """
          |main =
          |    stateSum = n ->
          |        acc = State.get Number
          |        State.put Number acc+n
          |        if n == 0 then State.get Number else stateSum n-1
          |
          |    State.run Number 0 (stateSum 10)
          |""".stripMargin
      eval(code) shouldEqual 55
    }

    "work with pattern matches" in {
      val code =
        """
          |run =
          |    matcher = x -> case x of
          |        Unit ->
          |            y = State.get Number
          |            State.put Number (y + 5)
          |        Nil ->
          |            y = State.get Number
          |            State.put Number (y + 10)
          |
          |    State.put Number 1
          |    matcher Nil
          |    IO.println (State.get Number)
          |    matcher Unit
          |    IO.println (State.get Number)
          |    0
          |
          |main = State.run Number 0 here.run
          |""".stripMargin
      eval(code)
      consumeOut shouldEqual List("11", "16")
    }

    "undo changes on Panics" in {
      val code =
        """
          |panicker =
          |    State.put Number 400
          |    Panic.throw Unit
          |
          |stater =
          |    State.put Number 5
          |    Panic.recover here.panicker
          |    State.get Number
          |
          |main = State.run Number 0 here.stater
          |""".stripMargin
      eval(code) shouldEqual 5
    }
  }
}
