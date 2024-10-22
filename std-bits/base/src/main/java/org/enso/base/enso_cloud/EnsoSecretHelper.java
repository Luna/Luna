package org.enso.base.enso_cloud;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest.Builder;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import java.util.Properties;
import org.enso.base.cache.EnsoHTTPResponseCache;
import org.enso.base.net.URISchematic;
import org.enso.base.net.URIWithSecrets;
import org.graalvm.collections.Pair;

/** Makes HTTP requests with secrets in either header or query string. */
public final class EnsoSecretHelper extends SecretValueResolver {

  /** Gets a JDBC connection resolving EnsoKeyValuePair into the properties. */
  public static Connection getJDBCConnection(
      String url, List<Pair<String, HideableValue>> properties) throws SQLException {
    var javaProperties = new Properties();
    for (var pair : properties) {
      javaProperties.setProperty(pair.getLeft(), resolveValue(pair.getRight()));
    }

    return DriverManager.getConnection(url, javaProperties);
  }

  /**
   * Gets the actual URI with all secrets resolved, so that it can be used to create a request. This
   * value should never be returned to Enso.
   */
  private static URI resolveURI(URIWithSecrets uri) {
    try {
      List<Pair<String, String>> resolvedQueryParameters =
          uri.queryParameters().stream()
              .map(p -> Pair.create(p.getLeft(), resolveValue(p.getRight())))
              .toList();
      URISchematic resolvedSchematic = new URISchematic(uri.baseUri(), resolvedQueryParameters);
      return resolvedSchematic.build();
    } catch (URISyntaxException e) {
      // Here we don't display the message of the exception to avoid risking it may leak any
      // secrets.
      // This should never happen in practice.
      throw new IllegalStateException(
          "Unexpectedly unable to build a valid URI from the base URI: "
              + uri
              + ": "
              + e.getClass().getCanonicalName());
    }
  }

  /** Makes a request with secrets in the query string or headers. * */
  public static EnsoHttpResponse makeRequest(
      HttpClient client,
      Builder builder,
      URIWithSecrets uri,
      List<Pair<String, HideableValue>> headers,
      boolean useCache)
      throws IllegalArgumentException,
          IOException,
          InterruptedException,
          ResponseTooLargeException {

    // Build a new URI with the query arguments.
    URI resolvedURI = resolveURI(uri);

    List<Pair<String, String>> resolvedHeaders =
        headers.stream()
            .map(
                pair -> {
                  return Pair.create(pair.getLeft(), resolveValue(pair.getRight()));
                })
            .toList();

    if (!useCache) {
      return requestMaker.run();
    } else {
      var requestMaker =
          new EnsoSecretHelperRequestMaker(
              client, builder, uri, resolvedURI, headers, resolvedHeaders);
      return EnsoHTTPResponseCache.makeRequest(requestMaker);
    }
  }

  /** Makes a request with secrets resolved to their actual values. * */
  static EnsoHttpResponse makeRequestWithResolvedSecrets(
      HttpClient client,
      Builder builder,
      URIWithSecrets uri,
      URI resolvedURI,
      List<Pair<String, HideableValue>> headers,
      List<Pair<String, String>> resolvedHeaders)
      throws IOException, InterruptedException {
    boolean hasSecrets =
        uri.containsSecrets() || headers.stream().anyMatch(p -> p.getRight().containsSecrets());
    if (hasSecrets) {
      if (resolvedURI.getScheme() == null) {
        throw new IllegalArgumentException("The URI must have a scheme.");
      }

      if (!resolvedURI.getScheme().equalsIgnoreCase("https")) {
        throw new IllegalArgumentException(
            "Secrets are not allowed in HTTP connections, use HTTPS instead.");
      }
    }

    builder.uri(resolvedURI);

    for (Pair<String, String> resolvedHeader : resolvedHeaders) {
      builder.header(resolvedHeader.getLeft(), resolvedHeader.getRight());
    }

    // Build and Send the request.
    var httpRequest = builder.build();
    var bodyHandler = HttpResponse.BodyHandlers.ofInputStream();
    var javaResponse = client.send(httpRequest, bodyHandler);

    URI renderedURI = uri.render();

    return new EnsoHttpResponse(
        renderedURI, javaResponse.headers(), javaResponse.body(), javaResponse.statusCode());
  }

  public static void deleteSecretFromCache(String secretId) {
    EnsoSecretReader.removeFromCache(secretId);
  }

  private class EnsoSecretHelperRequestMaker implements EnsoHTTPResponseCache.RequestMaker {
    private HttpClient client;
    private Builder builder;
    private URIWithSecrets uri;
    private URI resolvedURI;
    private List<Pair<String, HideableValue>> headers;
    private List<Pair<String, String>> resolvedHeaders;

    EnsoSecretHelperRequestMaker(
        HttpClient client,
        Builder builder,
        URIWithSecrets uri,
        URI resolvedURI,
        List<Pair<String, HideableValue>> headers,
        List<Pair<String, String>> resolvedHeaders) {
      this.client = client;
      this.builder = builder;
      this.uri = uri;
      this.resolvedURI = resolvedURI;
      this.headers = headers;
      this.resolvedHeaders = resolvedHeaders;
    }

    public EnsoHttpResponse run() throws IOException, InterruptedException {
      makeRequestWithResolvedSecrets(client, builder, uri, resolvedURI, headers, resolvedHeaders);
    }

    /**
     * Sorts the header by header name, so we don't depend on header order. Multiple-valued headers
     * might hash differently, but it's a rare case.
     */
    public String makeHashKey() {
      try {
        MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
        messageDigest.update(resolvedURI.toString().getBytes());

        var sortedHeaders = resolvedHeaders.stream().sorted(headerNameComparator).toList();
        for (Pair<String, String> resolvedHeader : sortedHeaders) {
          messageDigest.update(resolvedHeader.getLeft().getBytes());
          messageDigest.update(resolvedHeader.getRight().getBytes());
        }
        return HexFormat.of().formatHex(messageDigest.digest());
      } catch (NoSuchAlgorithmException ex) {
        throw raise(RuntimeException.class, ex);
      }
    }

    public EnsoHttpResponse reconstructResponseFromCachedStream(
        InputStream inputStream, CacheResult<EnsoHTTPResponseMetadata> cacheResult) {
      URI renderedURI = uri.render();

      return new EnsoHttpResponse(
          renderedURI,
          cacheResult.metadata().headers(),
          inputStream,
          cacheResult.metadata().statusCode());
    }
  }
}
