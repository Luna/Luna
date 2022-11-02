package org.enso.languageserver.requesthandler.vcs

import akka.actor.{Actor, ActorRef, Cancellable, Props}
import com.typesafe.scalalogging.LazyLogging
import org.enso.jsonrpc.{Errors, Id, Request, ResponseError, ResponseResult}
import org.enso.languageserver.filemanager.Path
import org.enso.languageserver.requesthandler.RequestTimeout
import org.enso.languageserver.session.JsonSession
import org.enso.languageserver.util.UnhandledLogging
import org.enso.languageserver.vcsmanager.VcsManagerApi.ModifiedVcs
import org.enso.languageserver.vcsmanager.{VcsFailureMapper, VcsProtocol}

import scala.annotation.unused
import scala.concurrent.duration.FiniteDuration

class ModifiedVcsHandler(
  requestTimeout: FiniteDuration,
  vcsManager: ActorRef,
  rpcSession: JsonSession
) extends Actor
    with LazyLogging
    with UnhandledLogging {

  import context.dispatcher

  override def receive: Receive = requestStage

  private def requestStage: Receive = {
    case Request(ModifiedVcs, id, params: ModifiedVcs.Params) =>
      vcsManager ! VcsProtocol.ModifiedRepo(params.root)
      val cancellable = context.system.scheduler
        .scheduleOnce(requestTimeout, self, RequestTimeout)
      context.become(responseStage(id, sender(), cancellable, params.root))
  }

  private def responseStage(
    id: Id,
    replyTo: ActorRef,
    cancellable: Cancellable,
    @unused root: Path
  ): Receive = {
    case RequestTimeout =>
      logger.error(
        "Initialize project request [{}] for [{}] timed out.",
        id,
        rpcSession.clientId
      )
      replyTo ! ResponseError(Some(id), Errors.RequestTimeout)
      context.stop(self)

    case VcsProtocol.ModifiedRepoResult(Right(isModified)) =>
      replyTo ! ResponseResult(ModifiedVcs, id, ModifiedVcs.Result(isModified))
      cancellable.cancel()
      context.stop(self)

    case VcsProtocol.ModifiedRepoResult(Left(failure)) =>
      replyTo ! ResponseError(Some(id), VcsFailureMapper.mapFailure(failure))
      cancellable.cancel()
      context.stop(self)
  }
}

object ModifiedVcsHandler {

  def props(
    timeout: FiniteDuration,
    vcsManager: ActorRef,
    rpcSession: JsonSession
  ): Props =
    Props(new ModifiedVcsHandler(timeout, vcsManager, rpcSession))
}
