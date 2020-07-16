package org.enso.launcher.cli.internal

class OptsPure[A](v: A) extends BaseOpts[A] {
  override private[cli] def result() = Right(v)
  override private[cli] def reset(): Unit = {}

  override def helpExplanations(): Seq[String] = Seq()
}
