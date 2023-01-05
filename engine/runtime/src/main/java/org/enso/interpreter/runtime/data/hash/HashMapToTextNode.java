package org.enso.interpreter.runtime.data.hash;

import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.StopIterationException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;

@BuiltinMethod(
    type = "Hash_Map",
    name = "to_text",
    description = """
        Returns text representation of this hash map
        """,
    autoRegister = false
)
public abstract class HashMapToTextNode extends Node {

  public static HashMapToTextNode build() {
    return HashMapToTextNodeGen.create();
  }

  abstract Object execute(Object hashMap);

  @TruffleBoundary
  @Specialization(guards = "interop.hasHashEntries(hashMap)")
  Object hashMapToText(Object hashMap,
      @CachedLibrary(limit = "5") InteropLibrary interop) {
    var sb = new StringBuilder();
    sb.append("{");
    try {
      Object entryIterator = interop.getHashEntriesIterator(hashMap);
      while (interop.hasIteratorNextElement(entryIterator)) {
        Object key = interop.getIteratorNextElement(entryIterator);
        Object value = interop.getIteratorNextElement(entryIterator);
        sb.append(key).append("=").append(value).append(", ");
      }
      if (interop.getHashSize(hashMap) > 0) {
        // Delete last comma
        sb.delete(sb.length() - 2, sb.length());
      }
    } catch (UnsupportedMessageException | StopIterationException e) {
      throw new IllegalStateException(
          "hashMap " + hashMap + " probably implements interop API incorrectly",
          e
      );
    }
    sb.append("}");
    return sb.toString();
  }
}

