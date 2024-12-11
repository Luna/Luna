package org.enso.downloader.http

import java.net.http.HttpRequest

/** Wraps an underlying HTTP request implementation to make the outside API
  * independent of the internal implementation.
  */
case class HTTPRequest(requestImpl: HttpRequest) {

  /** Checks if this is a GET request. */
  def isGET: Boolean = requestImpl.method() == "GET"
}
