package org.enso.interpreter.test.semantic

import org.enso.interpreter.test.{
  InterpreterContext,
  InterpreterException,
  InterpreterTest
}
import org.enso.testkit.OsSpec

import scala.util.Random

class SystemProcessTest extends InterpreterTest with OsSpec {
  override def subject: String = "System.create_process"

  override def specify(implicit
    interpreterContext: InterpreterContext
  ): Unit = {

    "return success exit code" in {
      val code =
        """main =
          |    result = System.create_process "echo" [] "" False False False
          |    result.exit_code
          |""".stripMargin
      eval(code) shouldEqual 0
      consumeOut shouldEqual List()
      consumeErr shouldEqual List()
    }

    "return error when creating nonexistent command" in {
      val code =
        """main = System.create_process "nonexistentcommandxyz" [] "" False False False"""

      val error = the[InterpreterException] thrownBy eval(code)
      error.getMessage should include("nonexistentcommandxyz")
      consumeOut shouldEqual List()
      consumeErr shouldEqual List()
    }

    "return error exit code" in {
      val code =
        """main =
          |    result = System.create_process "ls" ["--gibberish"] "" False False False
          |    result.exit_code
          |""".stripMargin

      eval(code) should not equal 0
      consumeOut shouldEqual List()
      consumeErr shouldEqual List()
    }

    "redirect stdin chars (Unix)" taggedAs OsUnix in {
      val code =
        """main =
          |    result = System.create_process "/bin/sh" ["-c", "read line; echo $line"] "" True True True
          |    result.exit_code
          |""".stripMargin

      feedInput("hello")
      eval(code) shouldEqual 0
      consumeOut shouldEqual List("hello")
      consumeErr shouldEqual List()
    }

    "redirect stdin chars (Windows)" taggedAs OsWindows in {
      val code =
        """main =
          |    result = System.create_process "PowerShell" ["-Command", "$line = Read-Host; echo $line"] "" True True True
          |    result.exit_code
          |""".stripMargin

      feedInput("hello")
      eval(code) shouldEqual 0
      consumeOut shouldEqual List("hello")
      consumeErr shouldEqual List()
    }

    "redirect stdin bytes (Unix)" taggedAs OsUnix in {
      val input = Random.nextBytes(Byte.MaxValue)
      val code =
        """main =
          |    result = System.create_process "/bin/sh" ["-c", "wc -c"] "" True True True
          |    result.exit_code
          |""".stripMargin

      feedBytes(input)
      eval(code) shouldEqual 0
      consumeOut.map(_.trim) shouldEqual List(input.length.toString)
      consumeErr shouldEqual List()
    }

    "redirect stdin unused" in {
      val code =
        """main =
          |    result = System.create_process "echo" ["42"] "" True True True
          |    result.exit_code
          |""".stripMargin

      feedInput("unused input")
      eval(code) shouldEqual 0
      consumeOut shouldEqual List("42")
      consumeErr shouldEqual List()
    }

    "redirect stdin empty" in {
      val code =
        """main =
          |    result = System.create_process "echo" ["9"] "" True True True
          |    result.exit_code
          |""".stripMargin

      eval(code) shouldEqual 0
      consumeOut shouldEqual List("9")
      consumeErr shouldEqual List()
    }

    "provide stdin string (Unix)" taggedAs OsUnix in {
      val code =
        """main =
          |    result = System.create_process "/bin/sh" ["-c", "read line; echo -n $line"] "hello" False False False
          |    result.stdout
          |""".stripMargin

      eval(code) shouldEqual "hello"
      consumeOut shouldEqual List()
      consumeErr shouldEqual List()
    }

    "provide stdin string (Windows)" taggedAs OsWindows in {
      val code =
        """main =
          |    result = System.create_process "PowerShell" ["-Command", "$line = Read-Host; echo $line"] "hello" True True True
          |    result.exit_code
          |""".stripMargin

      eval(code) shouldEqual 0
      consumeOut shouldEqual List()
      consumeErr shouldEqual List()
    }

    "redirect stdout chars" in {
      val code =
        """main =
          |    result = System.create_process "echo" ["foobar"] "" False True True
          |    result.exit_code
          |""".stripMargin

      eval(code) shouldEqual 0
      consumeOut shouldEqual List("foobar")
      consumeErr shouldEqual List()
    }

    "redirect stdout binary (Unix)" taggedAs OsUnix in {
      val code =
        """main =
          |    result = System.create_process "/bin/sh" ["-c", "printf '\\x01\\x0F\\x10'"] "" False True True
          |    result.exit_code
          |""".stripMargin

      eval(code) shouldEqual 0
      consumeOutBytes shouldEqual Array(1, 15, 16)
      consumeErrBytes shouldEqual Array()
    }

    "return stdout string" in {
      val code =
        """main =
          |    result = System.create_process "echo" ["-n", "foobar"] "" False False False
          |    result.stdout
          |""".stripMargin

      eval(code) shouldEqual "foobar"
      consumeOut shouldEqual List()
      consumeErr shouldEqual List()
    }

    "redirect stderr chars (Unix)" taggedAs OsUnix in {
      val code =
        """main =
          |    result = System.create_process "/bin/sh" ["-c", "echo err 1>&2"] "" False True True
          |    result.exit_code
          |""".stripMargin

      eval(code) shouldEqual 0
      consumeOut shouldEqual List()
      consumeErr shouldEqual List("err")
    }

    "redirect stderr chars (Windows)" taggedAs OsWindows in {
      val code =
        """main =
          |    result = System.create_process "PowerShell" ["-Command", "Write-Error err"] "" False True True
          |    result.exit_code
          |""".stripMargin

      eval(code) shouldEqual 0
      consumeOut shouldEqual List()
      consumeErr shouldEqual List("err")
    }

    "redirect stderr binary (Unix)" taggedAs OsUnix in {
      val code =
        """main =
          |    result = System.create_process "/bin/sh" ["-c", "printf '\\xCA\\xFE\\xBA\\xBE' 1>&2"] "" False True True
          |    result.exit_code
          |""".stripMargin

      eval(code) shouldEqual 0
      consumeOutBytes shouldEqual Array()
      consumeErrBytes shouldEqual Array(-54, -2, -70, -66)
    }

    "return stderr string (Unix)" taggedAs OsUnix in {
      val code =
        """main =
          |    result = System.create_process "/bin/sh" ["-c", "echo -n err 1>&2"] "" False False False
          |    result.stderr
          |""".stripMargin

      eval(code) shouldEqual "err"
      consumeOut shouldEqual List()
      consumeErr shouldEqual List()
    }

    "return stderr string (Windows)" taggedAs OsWindows in {
      val code =
        """main =
          |    result = System.create_process "PowerShell" ["-Command", "Write-Error err"] "" False False False
          |    result.stderr
          |""".stripMargin

      eval(code) shouldEqual "err"
      consumeOut shouldEqual List()
      consumeErr shouldEqual List()
    }
  }
}
