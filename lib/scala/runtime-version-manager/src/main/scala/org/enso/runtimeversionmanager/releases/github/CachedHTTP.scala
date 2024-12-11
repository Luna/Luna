package org.enso.runtimeversionmanager.releases.github

import org.enso.cli.task.TaskProgress
import org.enso.downloader.http.{
  APIResponse,
  HTTPDownload,
  HTTPRequest,
  HTTPRequestBuilder
}

import java.net.URI
import java.nio.charset.{Charset, StandardCharsets}

/** A very simple cache for HTTP requests made by the runtime version manager.
 *
 * It is used to avoid performing the same query to GitHub API multiple times.
 */
object CachedHTTP {
  def fetchString(
    request: HTTPRequest,
    sizeHint: Option[Long] = None,
    encoding: Charset      = StandardCharsets.UTF_8
  ): TaskProgress[APIResponse] = {
    if (!request.isGET) {
      throw new IllegalArgumentException(
        "Only GET can be used with CachedHTTP, use HTTPDownload directly instead."
      )
    }

    cache.get(request) match {
      case Some(response) =>
        System.out.println(s"Returning cached ${request.requestImpl.uri()}")
        TaskProgress.runImmediately(response)
      case None =>
        System.out.println(s"Fetching ${request.requestImpl.uri()}")
        HTTPDownload.fetchString(request, sizeHint, encoding).map { response =>
          cache.put(request, response)
          response
        }
    }
  }

  def fetchString(uri: URI): TaskProgress[APIResponse] = {
    val request = HTTPRequestBuilder.fromURI(uri).GET
    fetchString(request)
  }

  private val cache =
    collection.concurrent.TrieMap.empty[HTTPRequest, APIResponse]
}
