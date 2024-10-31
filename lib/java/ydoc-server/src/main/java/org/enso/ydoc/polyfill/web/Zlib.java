package org.enso.ydoc.polyfill.web;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.zip.DataFormatException;
import java.util.zip.Deflater;
import java.util.zip.Inflater;
import org.enso.ydoc.Polyfill;
import org.enso.ydoc.polyfill.Arguments;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.io.ByteSequence;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Implements the <a href="https://nodejs.org/api/zlib.html">Zlib</a> Node.js interface. */
final class Zlib implements Polyfill, ProxyExecutable {

  private static final Logger log = LoggerFactory.getLogger(Zlib.class);

  private static final String BUFFER_FROM = "buffer-from";
  private static final String BUFFER_TO_STRING = "buffer-to-string";
  private static final String ENCODING_BASE64 = "base64";
  private static final String ENCODING_BASE64_URL = "base64url";

  private static final String ZLIB_DEFLATE_SYNC = "zlib-deflate-sync";
  private static final String ZLIB_INFLATE_SYNC = "zlib-inflate-sync";

  private static final String ZLIB_JS = "zlib.js";

  @Override
  public void initialize(Context ctx) {
    Source jsSource = Source.newBuilder("js", getClass().getResource(ZLIB_JS)).buildLiteral();

    ctx.eval(jsSource).execute(this);
  }

  @Override
  public Object execute(Value... arguments) {
    var command = arguments[0].asString();

    log.debug(Arguments.toString(arguments));

    return switch (command) {
      case BUFFER_FROM -> {
        var text = arguments[1].asString();
        var encoding = arguments[2].asString();

        yield switch (encoding) {
          case ENCODING_BASE64 -> {
            var buffer = StandardCharsets.UTF_8.encode(text);
            yield Base64.getDecoder().decode(buffer);
          }
          case ENCODING_BASE64_URL -> {
            var buffer = StandardCharsets.UTF_8.encode(text);
            yield Base64.getUrlDecoder().decode(buffer);
          }
          case null -> StandardCharsets.UTF_8.encode(text);
          default -> {
            Charset charset;
            try {
              charset = Charset.forName(encoding);
            } catch (IllegalArgumentException ignored) {
              charset = StandardCharsets.UTF_8;
            }
            yield charset.encode(text);
          }
        };
      }
      case BUFFER_TO_STRING -> {
        var byteSequence = arguments[1].as(ByteSequence.class);
        var encoding = arguments[2].asString();

        yield switch (encoding) {
          case ENCODING_BASE64 -> {
            var arr = Base64.getEncoder().encode(byteSequence.toByteArray());
            yield new String(arr, StandardCharsets.UTF_8);
          }
          case ENCODING_BASE64_URL -> {
            var arr = Base64.getUrlEncoder().encode(byteSequence.toByteArray());
            yield new String(arr, StandardCharsets.UTF_8);
          }
          case null -> {
            var buffer = ByteBuffer.wrap(byteSequence.toByteArray());
            yield StandardCharsets.UTF_8.decode(buffer).toString();
          }
          default -> {
            Charset charset;
            try {
              charset = Charset.forName(encoding);
            } catch (IllegalArgumentException ignored) {
              charset = StandardCharsets.UTF_8;
            }
            var buffer = ByteBuffer.wrap(byteSequence.toByteArray());
            yield charset.decode(buffer).toString();
          }
        };
      }
      case ZLIB_DEFLATE_SYNC -> {
        var byteSequence = arguments[1].as(ByteSequence.class);

        var deflater = new Deflater();
        deflater.setInput(byteSequence.toByteArray());
        deflater.finish();

        var output = new ByteArrayOutputStream();
        var buffer = new byte[2048];
        while (!deflater.finished()) {
          int size = deflater.deflate(buffer);
          output.write(buffer, 0, size);
        }
        deflater.end();

        yield ByteBuffer.wrap(output.toByteArray());
      }
      case ZLIB_INFLATE_SYNC -> {
        var byteSequence = arguments[1].as(ByteSequence.class);

        var inflater = new Inflater();
        inflater.setInput(byteSequence.toByteArray());

        var output = new ByteArrayOutputStream();
        var buffer = new byte[2048];
        try {
          while (!inflater.finished()) {
            int size = inflater.inflate(buffer);
            output.write(buffer, 0, size);
          }
        } catch (DataFormatException e) {
          var message = "Failed " + ZLIB_DEFLATE_SYNC;
          log.error(message, e);
          throw new RuntimeException(message, e);
        }

        yield ByteBuffer.wrap(output.toByteArray());
      }

      default -> throw new IllegalStateException(command);
    };
  }
}
