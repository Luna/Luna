package org.enso.projectmanager.infrastructure.desktop

import org.enso.desktopenvironment.{Platform, TrashBin}
import org.enso.projectmanager.control.effect.Sync

import java.io.File

class DesktopTrash[F[+_, +_]: Sync](trash: TrashBin) extends TrashCan[F] {

  /** @inheritdoc */
  override def moveToTrash(path: File): F[Nothing, Boolean] =
    Sync[F].effect(trash.moveToTrash(path.toPath))
}

object DesktopTrash {

  def apply[F[+_, +_]: Sync]: DesktopTrash[F] = {
    new DesktopTrash(Platform.getOperatingSystem.getTrashBin)
  }
}
