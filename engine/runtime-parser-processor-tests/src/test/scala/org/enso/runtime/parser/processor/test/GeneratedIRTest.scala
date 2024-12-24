package org.enso.runtime.parser.processor.test

import org.enso.compiler.core.ir.{Literal, MetadataStorage}
import org.enso.runtime.parser.processor.test.gen.ir.core.JCallArgument.JSpecified
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

/** Tests IR elements generated from package [[org.enso.runtime.parser.processor.test.gen.ir]].
  */
class GeneratedIRTest extends AnyFlatSpec with Matchers {
  "JSpecifiedGen" should "be duplicated correctly" in {
    val lit     = Literal.Text("foo", null, new MetadataStorage())
    val callArg = new JSpecified(true, None, lit)
    callArg should not be null

    val dupl = callArg.duplicate(false, false, false, false)
    dupl.value() shouldEqual lit
  }

  "JSpecified" should "can implement unapply" in {
    val lit     = Literal.Text("foo", null, new MetadataStorage())
    val callArg = new JSpecified(true, None, lit)
    callArg match {
      case JSpecified(isSynthetic, _, _) =>
        isSynthetic shouldEqual true
    }
  }
}
