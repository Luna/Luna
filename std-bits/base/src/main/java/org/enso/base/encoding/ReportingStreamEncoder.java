package org.enso.base.encoding;

import org.enso.base.Encoding_Utils;

import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.Writer;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.Charset;
import java.nio.charset.CharsetEncoder;
import java.nio.charset.CoderResult;
import java.util.Arrays;

public class ReportingStreamEncoder extends Writer {

  /**
   * Creates a writer which encodes characters and writes them to the provided output stream.
   *
   * <p>The encoder reports any malformed or unmappable characters as problems and replaces them
   * with the provided replacement sequence.
   *
   * <p>The encoder must be closed at the end of the encoding process to indicate that no further
   * data will be processed so that it can properly handle the finalization of encoding.
   */
  public ReportingStreamEncoder(
      OutputStream outputStream, CharsetEncoder encoder, byte[] replacementSequence) {
    this.encoder = encoder;
    bufferedOutputStream = new BufferedOutputStream(outputStream);
    this.replacementSequence = replacementSequence;
  }

  private final BufferedOutputStream bufferedOutputStream;
  private final CharsetEncoder encoder;

  /**
   * The buffer keeping any input that has already been written but not encoded yet.
   *
   * <p>Between the calls to write, it satisfies the invariant that it is in 'reading' mode - to be
   * able to write to it, it needs to be reallocated, compacted or flipped.
   */
  private CharBuffer inputBuffer = CharBuffer.allocate(0);

  private long inputCharactersConsumedBeforeCurrentBuffer = 0;

  private final byte[] replacementSequence;

  private boolean wasClosed = false;

  /**
   * The buffer re-used for storing encoded output before writing it to the output stream.
   *
   * <p>It is cleared after each call to write, so that it can be freshly re-used in the following
   * call. It is preserved only to avoid re-allocating a big buffer upon each call.
   */
  private ByteBuffer outputBuffer = ByteBuffer.allocate(0);

  private void ensureInputBufferHasEnoughFreeSpace(int bytesToAppend) {
    int freeSpaceInInputBuffer = inputBuffer.capacity() - inputBuffer.remaining();

    // After either compacting the buffer or reallocating it, any remaining input is shifted to
    // the beginning of the buffer. Thus the bytes that preceded the current position are lost
    // (because they already have been processed), so we increase the counter to keep the global
    // position in the input.
    inputCharactersConsumedBeforeCurrentBuffer += inputBuffer.position();

    if (freeSpaceInInputBuffer < bytesToAppend) {
      var old = inputBuffer;
      inputBuffer = CharBuffer.allocate(old.remaining() + bytesToAppend);
      inputBuffer.put(old);
    } else {
      inputBuffer.compact();
    }
  }

  @Override
  public void write(char[] cbuf, int off, int len) throws IOException {
    if (len < 0) {
      throw new IndexOutOfBoundsException();
    }

    ensureInputBufferHasEnoughFreeSpace(len);
    inputBuffer.put(cbuf, off, len);

    // We flip the input buffer back to reading mode, to be able to pass it to the encoder.
    inputBuffer.flip();

    if (outputBuffer.capacity() == 0) {
      outputBuffer =
          ByteBuffer.allocate((int) (inputBuffer.remaining() * encoder.averageBytesPerChar()));
    }
    runEncoderOnInputBuffer();

    bufferedOutputStream.write(outputBuffer.array(), 0, outputBuffer.position());
    outputBuffer.clear();
  }

  private void runEncoderOnInputBuffer() {
    while (inputBuffer.hasRemaining()) {
      CoderResult cr = encoder.encode(inputBuffer, outputBuffer, false);

      if (cr.isMalformed() || cr.isUnmappable()) {
        reportEncodingProblem();

        while (outputBuffer.remaining() < replacementSequence.length) {
          growOutputBuffer();
        }

        outputBuffer.put(replacementSequence);
        inputBuffer.position(inputBuffer.position() + cr.length());
      } else if (cr.isUnderflow()) {
        break;
      } else if (cr.isOverflow()) {
        growOutputBuffer();
      }
    }
  }

  private void reportEncodingProblem() {
    // TODO
    System.out.println("Encoding problem!");
  }

  private void growOutputBuffer() {
    outputBuffer = Encoding_Utils.resize(outputBuffer, ByteBuffer::allocate, ByteBuffer::put);
  }

  @Override
  public void flush() throws IOException {
    // We don't flush the encoder here, because the flush operation for the encoder is supposed to
    // be run at the very end, and for a Writer the flush may be called whenever and further write
    // operations may follow it. So we do the best we can - flush the underlying stream and keep the
    // encoder intact, ready for possible writes.
    bufferedOutputStream.flush();
  }

  @Override
  public void close() throws IOException {
    if (wasClosed) {
      return;
    }

    while (encoder.encode(inputBuffer, outputBuffer, true).isOverflow()) {
      growOutputBuffer();
    }

    while (encoder.flush(outputBuffer).isOverflow()) {
      growOutputBuffer();
    }

    bufferedOutputStream.write(outputBuffer.array(), 0, outputBuffer.position());
    bufferedOutputStream.flush();
    bufferedOutputStream.close();
    wasClosed = true;
  }
}
