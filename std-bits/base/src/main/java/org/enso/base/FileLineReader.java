package org.enso.base;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.enso.base.arrays.LongArrayList;
import org.graalvm.polyglot.Context;

public class FileLineReader {
  private static final Logger LOGGER = Logger.getLogger("enso-file-line-reader");

  // ** Amount of data to read at a time for a single line (4KB). */
  private static final int LINE_BUFFER = 4 * 1024;

  // ** Amount of data to read at a time (4MB). */
  private static final int BUFFER_SIZE = 4 * 1024 * 1024;

  private static boolean moreToRead(int c, MappedByteBuffer buffer) {
    return switch (c) {
      case '\n', -1 -> false;
      case '\r' -> {
        c = buffer.hasRemaining() ? buffer.get() : '\n';
        if (c != '\n') {
          buffer.position(buffer.position() - 1);
        }
        yield false;
      }
      default -> true;
    };
  }

  private static int readByte(MappedByteBuffer buffer) {
    return buffer.hasRemaining() ? buffer.get() : -1;
  }

  // ** Reads a line into an OutputStream.
  //    Returns true if the end of the line was found, false if the buffer finished. */
  private static boolean readLine(MappedByteBuffer buffer, ByteArrayOutputStream result) {
    int c = readByte(buffer);
    while (moreToRead(c, buffer)) {
      result.write(c);
      c = readByte(buffer);
      Context.getCurrent().safepoint();
    }
    return c != -1 && (c != '\r' || buffer.hasRemaining());
  }

  // ** Scans forward one line.
  //    Returns true if the end of the line was found, false if the buffer finished. */
  private static boolean scanLine(MappedByteBuffer buffer) {
    int c = readByte(buffer);
    while (moreToRead(c, buffer)) {
      c = readByte(buffer);
      Context.getCurrent().safepoint();
    }
    return c != -1 && (c != '\r' || buffer.hasRemaining());
  }

  // ** Reads a line from a file at the given index using the existing rowMap. */
  private static String readLineByIndex(File file, LongArrayList rowMap, int index, Charset charset)
      throws IOException {
    if (index >= rowMap.getSize()) {
      throw new IndexOutOfBoundsException(index);
    }

    long length = file.length();
    long position = rowMap.get(index);
    if (position >= length) {
      return null;
    }
    long toRead =
        rowMap.getSize() > index + 1 ? rowMap.get(index + 1) - position : length - position;

    // Output buffer
    var outputStream = new ByteArrayOutputStream(128);

    // Only read what we have to.
    try (var stream = new FileInputStream(file)) {
      var channel = stream.getChannel();
      int bufferSize = (int) Math.min(LINE_BUFFER, toRead);
      long remaining = toRead - bufferSize;
      var buffer = channel.map(FileChannel.MapMode.READ_ONLY, position, bufferSize);
      var result = readLine(buffer, outputStream);
      while (!result && remaining > 0) {
        position += bufferSize;
        bufferSize = (int) Math.min(LINE_BUFFER, remaining);
        remaining -= bufferSize;
        buffer = channel.map(FileChannel.MapMode.READ_ONLY, position, bufferSize);
        result = readLine(buffer, outputStream);
      }
    }

    return outputStream.toString(charset);
  }

  // ** Scans forward in a file and returns the line at the given index. */
  public static String scanAndReadLine(
      File file, LongArrayList rowMap, int index, Charset charset, Function<String, Boolean> filter)
      throws IOException {
    int size = rowMap.getSize();
    if (index != -1 && size > index) {
      return readLineByIndex(file, rowMap, index, charset);
    }

    // Start at the last known line and scan forward.
    return forEachLine(file, rowMap, size - 1, index, charset, filter, null);
  }

  public static List<String> readLines(
      File file,
      LongArrayList rowMap,
      int startAt,
      int endAt,
      Charset charset,
      Function<String, Boolean> filter)
      throws IOException {
    List<String> result = new ArrayList<>();
    forEachLine(file, rowMap, startAt, endAt, charset, filter, (index, line) -> result.add(line));
    return result;
  }

  // ** Scans forward in a file reading line by line.
  // * @param file The file to read.
  // * @param rowMap The rowMap to use.
  // * @param startAt The index to start at.
  // * @param endAt The index to end at (inclusive).
  // * @param charset The charset to use.
  // * @param filter The filter to apply to each line.
  // * @param action The action to apply to each line (optional).
  // * @return The last line read or null if end of file is reached.
  // * *//
  public static String forEachLine(
      File file,
      LongArrayList rowMap,
      int startAt,
      int endAt,
      Charset charset,
      Function<String, Boolean> filter,
      BiFunction<Integer, String, Boolean> action)
      throws IOException {
    LOGGER.log(Level.INFO, "forEachLine: {0} {1}", new Object[] {startAt, endAt});

    if (startAt >= rowMap.getSize()) {
      throw new IndexOutOfBoundsException(startAt);
    }
    int index = action == null ? rowMap.getSize() - 1 : startAt;

    long length = file.length();
    long position = rowMap.get(index);
    if (position >= length) {
      return null;
    }

    boolean readAll = filter != null || action != null || endAt == -1;
    var outputStream = new ByteArrayOutputStream(128);
    String output = null;

    try (var stream = new FileInputStream(file)) {
      var channel = stream.getChannel();

      var bufferSize = (int) Math.min(BUFFER_SIZE, (length - position));
      var truncated = bufferSize != (length - position);
      var buffer = channel.map(FileChannel.MapMode.READ_ONLY, position, bufferSize);

      // Loop until we either reach the required record or run out of data.
      while ((endAt == -1 || index <= endAt) && (truncated || buffer.hasRemaining())) {
        var linePosition = buffer.position() + position;

        // Read a line.
        outputStream.reset();
        boolean success =
            (readAll || index == endAt) ? readLine(buffer, outputStream) : scanLine(buffer);

        if (success || !truncated) {
          String line = null;
          if (filter == null || filter.apply(line = outputStream.toString(charset))) {
            if (index >= rowMap.getSize()) {
              rowMap.add(linePosition);
            }

            if (action != null) {
              line = line == null ? outputStream.toString(charset) : line;
              action.apply(index, line);
            }

            if (index == endAt) {
              output = line == null ? outputStream.toString(charset) : line;
            }

            if (index % 100000 == 0) {
              LOGGER.log(Level.INFO, "Scanned Lines: {0}", index);
            }
            index++;

            // If no filter we can record the start of the next line.
            if (filter == null && index == rowMap.getSize()) {
              rowMap.add(buffer.position() + position);
            }
          }

          // Fast-forward if needed
          if (filter != null && index < rowMap.getSize()) {
            int newPosition = Math.min(bufferSize, (int) (rowMap.get(index) - position));
            buffer.position(newPosition);
          }
        } else {
          // Read more if we need to
          if (!buffer.hasRemaining()) {
            position = linePosition;
            bufferSize = (int) Math.min(BUFFER_SIZE, (length - position));
            truncated = bufferSize != (length - position);
            buffer = channel.map(FileChannel.MapMode.READ_ONLY, position, bufferSize);
          }
        }
      }

      if (!truncated && !buffer.hasRemaining() && rowMap.get(rowMap.getSize() - 1) != length) {
        // Add the last line to mark reached the end.
        rowMap.add(length);
      }

      return output;
    }
  }
}
