package org.enso.interpreter.arrow.runtime;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Bind;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.GenerateInline;
import com.oracle.truffle.api.dsl.GenerateUncached;
import com.oracle.truffle.api.dsl.NeverDefault;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.profiles.InlinedExactClassProfile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import org.enso.interpreter.arrow.LogicalLayout;
import org.enso.interpreter.arrow.runtime.ByteBufferDirect.DataBufferNode;
import org.enso.interpreter.arrow.util.MemoryUtil;

final class ByteBufferDirect implements AutoCloseable {
  private final ByteBuffer allocated;
  private final ByteBuffer dataBuffer;
  private ByteBuffer bitmapBuffer;

  /**
   * Creates a fresh buffer with an empty non-null bitmap..
   *
   * @param valueCount number of elements in the buffer
   * @param unit size of the new buffer for the elements of the requested type
   */
  private ByteBufferDirect(int valueCount, SizeInBytes unit) {
    var padded = RoundingUtil.forValueCount(valueCount, unit);
    var buffer = ByteBuffer.allocate(padded.getTotalSizeInBytes());

    this.allocated = buffer;
    this.dataBuffer = buffer.slice(0, padded.getDataBufferSizeInBytes());
    this.bitmapBuffer = null;
  }

  /**
   * Creates a new buffer from memory-mapped buffer and a corresponding memory-mapped non-null
   * bitmap.
   *
   * @param dataBuffer memory-mapped data buffer
   * @param bitmapBuffer memory-mapped buffer representing null bitmaps
   */
  private ByteBufferDirect(ByteBuffer allocated, ByteBuffer dataBuffer, ByteBuffer bitmapBuffer) {
    this.allocated = allocated;
    this.dataBuffer = dataBuffer;
    this.bitmapBuffer = bitmapBuffer;
  }

  /**
   * Creates a new buffer from memory-mapped buffer of a given size assuming it has only non-null
   * values.
   *
   * @param dataBuffer memory-mapped buffer
   * @param bitmapSizeInBytes size of the bitmap buffer (in bytes)
   */
  private ByteBufferDirect(ByteBuffer allocated, ByteBuffer dataBuffer, int bitmapSizeInBytes) {
    this.allocated = allocated;
    this.dataBuffer = dataBuffer;
    this.bitmapBuffer = allocated.slice(dataBuffer.capacity(), bitmapSizeInBytes);
    for (int i = 0; i < bitmapBuffer.capacity(); i++) {
      bitmapBuffer.put(i, (byte) 0xff);
    }
    bitmapBuffer.rewind();
  }

  static ByteBufferDirect forBuffer(ByteBuffer buf) {
    return new ByteBufferDirect(buf, buf, null);
  }

  /**
   * Creates a new buffer being able to store `valueCount` number of elements.
   *
   * @param valueCount number of elements to store in the buffer
   * @param unit size of a single element in bytes
   */
  public static ByteBufferDirect forSize(int valueCount, SizeInBytes unit) {
    return new ByteBufferDirect(valueCount, unit);
  }

  /**
   * Creates a new buffer from a given memory address range..
   *
   * @param dataAddress address of a data buffer
   * @param unit size of a single element in bytes
   */
  public static ByteBufferDirect fromAddress(long dataAddress, int valueCount, SizeInBytes unit) {
    var padded = RoundingUtil.forValueCount(valueCount, unit);
    ByteBuffer buffer = MemoryUtil.directBuffer(dataAddress, padded.getTotalSizeInBytes());
    ByteBuffer dataBuffer = buffer.slice(0, padded.getDataBufferSizeInBytes());
    dataBuffer.order(ByteOrder.LITTLE_ENDIAN);
    return new ByteBufferDirect(buffer, dataBuffer, padded.getValidityBitmapSizeInBytes());
  }

  public static ByteBufferDirect fromAddress(
      long dataAddress, long bitmapAddress, int size, SizeInBytes unit) {
    var padded = RoundingUtil.forValueCount(size, unit);
    ByteBuffer allocated = MemoryUtil.directBuffer(dataAddress, padded.getTotalSizeInBytes());
    assert dataAddress + padded.getDataBufferSizeInBytes() == bitmapAddress;
    ByteBuffer dataBuffer = allocated.slice(0, padded.getDataBufferSizeInBytes());
    dataBuffer.order(ByteOrder.LITTLE_ENDIAN);
    ByteBuffer bitmapBuffer =
        allocated.slice(dataBuffer.capacity(), padded.getValidityBitmapSizeInBytes());
    return new ByteBufferDirect(allocated, dataBuffer, bitmapBuffer);
  }

  @CompilerDirectives.TruffleBoundary
  ByteBuffer initializeBitmapBuffer() {
    assert bitmapBuffer == null;
    bitmapBuffer =
        allocated.slice(dataBuffer.capacity(), allocated.capacity() - dataBuffer.capacity());
    for (var i = 0; i < bitmapBuffer.capacity(); i++) {
      bitmapBuffer.put(i, (byte) 0xff);
    }
    return bitmapBuffer;
  }

  final ByteBuffer getDataBuffer() {
    return dataBuffer;
  }

  final ByteBuffer getBitmapBuffer() {
    return bitmapBuffer;
  }

  @GenerateInline(false)
  @GenerateUncached
  abstract static class DataBufferNode extends Node {
    static DataBufferNode create() {
      return ByteBufferDirectFactory.DataBufferNodeGen.create();
    }

    static DataBufferNode getUncached() {
      return ByteBufferDirectFactory.DataBufferNodeGen.getUncached();
    }

    abstract ByteBuffer executeDataBuffer(ByteBufferDirect direct);

    @Specialization
    static ByteBuffer profiledDataBuffer(
        ByteBufferDirect direct,
        @Bind("$node") Node node,
        @Cached InlinedExactClassProfile bufferClazz) {
      return bufferClazz.profile(node, direct.dataBuffer);
    }
  }

  @GenerateInline(false)
  @GenerateUncached
  abstract static class BitmapBufferNode extends Node {
    static BitmapBufferNode create() {
      return ByteBufferDirectFactory.BitmapBufferNodeGen.create();
    }

    static BitmapBufferNode getUncached() {
      return ByteBufferDirectFactory.BitmapBufferNodeGen.getUncached();
    }

    abstract ByteBuffer executeBitmapBuffer(ByteBufferDirect direct, boolean forceCreation);

    @Specialization
    static ByteBuffer profiledBitmapBuffer(
        ByteBufferDirect direct,
        boolean forceCreation,
        @Bind("$node") Node node,
        @Cached InlinedExactClassProfile bufferClazz) {

      if (direct.bitmapBuffer == null) {
        if (forceCreation) {
          direct.bitmapBuffer = direct.initializeBitmapBuffer();
        } else {
          return null;
        }
      }
      return bufferClazz.profile(node, direct.bitmapBuffer);
    }
  }

  static final class PutNode extends Node {
    private static final PutNode UNCACHED =
        new PutNode(DataBufferNode.getUncached(), BitmapBufferNode.getUncached());
    private @Child DataBufferNode dataBuffer;
    private @Child BitmapBufferNode bitmapBuffer;

    private PutNode(DataBufferNode dbn, BitmapBufferNode bbn) {
      this.dataBuffer = dbn;
      this.bitmapBuffer = bbn;
    }

    @NeverDefault
    static PutNode create() {
      return new PutNode(DataBufferNode.create(), BitmapBufferNode.create());
    }

    @NeverDefault
    static PutNode getUncached() {
      return UNCACHED;
    }

    final void put(ByteBufferDirect direct, byte b) {
      var db = dataBuffer.executeDataBuffer(direct);
      addValidityBitmap(direct, db.position(), 1);
      db.put(b);
    }

    final void putNull(ByteBufferDirect direct, LogicalLayout unit) {
      var db = dataBuffer.executeDataBuffer(direct);
      var index = db.position() / unit.sizeInBytes();

      var bb = bitmapBuffer.executeBitmapBuffer(direct, true);

      var bufferIndex = index >> 3;
      var slot = bb.get(bufferIndex);
      var byteIndex = index & BYTE_MASK;
      var mask = ~(1 << byteIndex);
      bb.put(bufferIndex, (byte) (slot & mask));

      db.position(db.position() + unit.sizeInBytes());
    }

    final void putShort(ByteBufferDirect direct, short value) {
      var db = dataBuffer.executeDataBuffer(direct);
      addValidityBitmap(direct, db.position(), 2);
      db.putShort(value);
    }

    final void putInt(ByteBufferDirect direct, int value) {
      var db = dataBuffer.executeDataBuffer(direct);
      addValidityBitmap(direct, db.position(), 4);
      db.putInt(value);
    }

    final void putLong(ByteBufferDirect direct, long value) throws UnsupportedMessageException {
      var db = dataBuffer.executeDataBuffer(direct);
      addValidityBitmap(direct, db.position(), 8);
      db.putLong(value);
    }

    private void addValidityBitmap(ByteBufferDirect direct, int pos, int size) {
      var bb = bitmapBuffer.executeBitmapBuffer(direct, false);
      if (bb == null) {
        return;
      }
      var index = pos / size;
      var bufferIndex = index >> 3;
      var slot = bb.get(bufferIndex);
      var byteIndex = index & BYTE_MASK;

      var mask = 1 << byteIndex;
      var updated = (slot | mask);
      bb.put(bufferIndex, (byte) (updated));
    }
  }

  public byte get(int index) throws UnsupportedMessageException {
    return dataBuffer.get(index);
  }

  public short getShort(int index) throws UnsupportedMessageException {
    return dataBuffer.getShort(index);
  }

  public int getInt(int index) throws UnsupportedMessageException {
    return dataBuffer.getInt(index);
  }

  public long getLong(int index) throws UnsupportedMessageException {
    return dataBuffer.getLong(index);
  }

  public long getLong(int index, Node node, InlinedExactClassProfile profile)
      throws UnsupportedMessageException {
    var buf = profile.profile(node, dataBuffer);
    return buf.getLong(index);
  }

  public int capacity() throws UnsupportedMessageException {
    return dataBuffer.capacity();
  }

  boolean hasNulls() {
    return bitmapBuffer != null;
  }

  public boolean isNull(int index) {
    if (bitmapBuffer == null) {
      return false;
    }
    return checkForNull(index);
  }

  private boolean checkForNull(int index) {
    var bufferIndex = index >> 3;
    var slot = bitmapBuffer.get(bufferIndex);
    var byteIndex = index & BYTE_MASK;
    var mask = 1 << byteIndex;
    return (slot & mask) == 0;
  }

  private static final int BYTE_MASK = ~(~(1 << 3) + 1); // 7

  @Override
  public void close() throws Exception {
    this.dataBuffer.clear();
    this.bitmapBuffer.clear();
    this.allocated.clear();
  }
}
