package org.enso.interpreter.node.expression.builtin.immutable;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.builtin.Builtins;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.data.vector.Array;
import org.enso.interpreter.runtime.data.vector.ArrayLikeCopyToArrayNode;
import org.enso.interpreter.runtime.data.vector.ArrayLikeHelpers;
import org.enso.interpreter.runtime.data.vector.Vector;
import org.enso.interpreter.runtime.error.PanicException;

@BuiltinMethod(
    type = "Vector",
    name = "remove_builtin",
    description = "Removes a value for the vector at the specified index.",
    autoRegister = false)
public abstract class RemoveAtVectorNode extends Node {
  static RemoveAtVectorNode build() {
    return RemoveAtVectorNodeGen.create();
  }

  abstract EnsoObject execute(Object vec, long index);

  @Specialization
  EnsoObject fromVector(
      Vector vec,
      long index,
      @Shared("copyNode") @Cached ArrayLikeCopyToArrayNode copyNode,
      @Shared("interop") @CachedLibrary(limit = "3") InteropLibrary interop) {
    try {
      return removeAtIndex(ArrayLikeHelpers.vectorToArray(vec), index, copyNode, interop);
    } catch (UnsupportedMessageException e) {
      CompilerDirectives.transferToInterpreter();
      Builtins builtins = EnsoContext.get(this).getBuiltins();
      throw new PanicException(builtins.error().makeTypeError(builtins.vector(), vec, "vec"), this);
    }
  }

  @Specialization
  EnsoObject fromArray(
      Array vec,
      long index,
      @Shared("copyNode") @Cached ArrayLikeCopyToArrayNode copyNode,
      @Shared("interop") @CachedLibrary(limit = "3") InteropLibrary interop) {
    try {
      return removeAtIndex(vec, index, copyNode, interop);
    } catch (UnsupportedMessageException e) {
      throw unsupportedException(vec);
    }
  }

  @Specialization(guards = "interop.hasArrayElements(vec)")
  EnsoObject fromArrayLike(
      Object vec,
      long index,
      @Shared("copyNode") @Cached ArrayLikeCopyToArrayNode copyNode,
      @Shared("interop") @CachedLibrary(limit = "3") InteropLibrary interop) {
    try {
      return removeAtIndex(vec, index, copyNode, interop);
    } catch (UnsupportedMessageException e) {
      throw unsupportedException(vec);
    }
  }

  @Fallback
  Vector fromUnknown(Object vec, long index) {
    throw unsupportedException(vec);
  }

  private PanicException unsupportedException(Object vec) {
    CompilerDirectives.transferToInterpreter();
    var ctx = EnsoContext.get(this);
    var err = ctx.getBuiltins().error().makeTypeError("polyglot array", vec, "vec");
    throw new PanicException(err, this);
  }

  private EnsoObject removeAtIndex(
      Object storage, long index, ArrayLikeCopyToArrayNode copyArrayNode, InteropLibrary interop)
      throws UnsupportedMessageException {
    long length = interop.getArraySize(storage);
    long actualIndex = index < 0 ? index + length : index;
    Array array = ArrayLikeHelpers.allocate(length - 1);
    copyArrayNode.execute(storage, 0, array, 0, actualIndex);
    copyArrayNode.execute(storage, actualIndex + 1, array, actualIndex, length - actualIndex - 1);
    return ArrayLikeHelpers.asVectorFromArray(array);
  }
}
