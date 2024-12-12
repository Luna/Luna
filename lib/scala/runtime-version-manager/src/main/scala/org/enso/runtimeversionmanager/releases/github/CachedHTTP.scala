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
        System.err.println(s"Returning cached ${request.requestImpl.uri()}")
        val hits = cacheHits.getOrElse(request, 0L)
        cacheHits.update(request, hits + 1)
        if (hits > 3) {
          System.err.println(
            s"Cache hit count for ${request.requestImpl.uri()}: $hits"
          )
          (new RuntimeException("find stack")).printStackTrace()
        }
        TaskProgress.runImmediately(response)
      case None =>
        System.err.println(s"Fetching ${request.requestImpl.uri()}")
        HTTPDownload.fetchString(request, sizeHint, encoding).map { response =>
          if (response.content.length <= MAX_CACHE_ENTRY_SIZE) {
            cache.put(request, response)
          } else {
            System.err.println(
              s"Response too large to cache ${request.requestImpl
                .uri()} - it is ${response.content.length} bytes long"
            )
          }
          response
        }
    }
  }

  def fetchString(uri: URI): TaskProgress[APIResponse] = {
    val request = HTTPRequestBuilder.fromURI(uri).GET
    fetchString(request)
  }

  private val MAX_CACHE_ENTRY_SIZE = 16 * 1024 * 1024
  private val cache =
    collection.concurrent.TrieMap.empty[HTTPRequest, APIResponse]

  private val cacheHits = collection.concurrent.TrieMap.empty[HTTPRequest, Long]
}
