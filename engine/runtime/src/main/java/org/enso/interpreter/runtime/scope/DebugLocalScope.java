package org.enso.interpreter.runtime.scope;

import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.TruffleLanguage;
import com.oracle.truffle.api.frame.MaterializedFrame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.InvalidArrayIndexException;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.source.SourceSection;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.stream.Collectors;
import org.enso.compiler.pass.analyse.FramePointer;
import org.enso.interpreter.EnsoLanguage;
import org.enso.interpreter.node.EnsoRootNode;
import org.enso.interpreter.node.callable.resolver.HostMethodCallNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.data.EnsoDate;
import org.enso.interpreter.runtime.data.EnsoDateTime;
import org.enso.interpreter.runtime.data.EnsoDuration;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.data.EnsoTimeOfDay;
import org.enso.interpreter.runtime.data.EnsoTimeZone;
import org.enso.interpreter.runtime.data.hash.EnsoHashMap;
import org.enso.interpreter.runtime.data.hash.HashMapInsertNode;
import org.enso.interpreter.runtime.data.hash.HashMapToVectorNode;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.data.vector.ArrayLikeAtNode;
import org.enso.interpreter.runtime.data.vector.ArrayLikeHelpers;
import org.enso.interpreter.runtime.data.vector.ArrayLikeLengthNode;
import org.enso.interpreter.runtime.error.DataflowError;
import org.enso.interpreter.runtime.number.EnsoBigInteger;

/**
 * This class serves as a basic support for debugging with Chrome inspector. Currently, only
 * function scopes are supported.
 *
 * <p>Some of the features that remain to be implemented are:
 *
 * <ul>
 *   <li>Module scopes. How to display imports in chrome devtools? Get inspiration from Python?
 *   <li>Evaluation of an arbitrary expression
 * </ul>
 */
@ExportLibrary(InteropLibrary.class)
public class DebugLocalScope implements EnsoObject {
  private final EnsoRootNode rootNode;

  /** All the bindings, including the parent scopes. */
  private final Map<String, FramePointer> allBindings;

  /**
   * The inner lists represent particular scope in a scope hierarchy. For example, for the following
   * snippet:
   *
   * <pre>
   * func =
   *     x = 1
   *     inner_func =
   *         y = 2
   *         y
   *     inner_func
   * </pre>
   *
   * <p>the value of this field (for `inner_func` scope) would be {@code [['x'], ['y']]}
   */
  private final List<List<String>> bindingsByLevels;

  /** Index of the current scope into {@link #bindingsByLevels} list. */
  private final int bindingsByLevelsIdx;

  private final MaterializedFrame frame;

  private DebugLocalScope(
      EnsoRootNode rootNode,
      MaterializedFrame frame,
      List<List<String>> bindingsByLevels,
      int bindingsByLevelsIdx) {
    assert bindingsByLevels != null;
    this.rootNode = rootNode;
    this.frame = frame;
    this.allBindings = rootNode.getLocalScope().flattenBindings();
    this.bindingsByLevels = bindingsByLevels;
    this.bindingsByLevelsIdx = bindingsByLevelsIdx;
    assert this.bindingsByLevels.isEmpty()
        || (0 <= this.bindingsByLevelsIdx
            && this.bindingsByLevelsIdx < this.bindingsByLevels.size());
  }

  @TruffleBoundary
  public static DebugLocalScope createFromFrame(EnsoRootNode rootNode, MaterializedFrame frame) {
    return new DebugLocalScope(
        rootNode, frame, gatherBindingsByLevels(rootNode.getLocalScope().flattenBindings()), 0);
  }

  @TruffleBoundary
  private static DebugLocalScope createParent(DebugLocalScope childScope) {
    return new DebugLocalScope(
        childScope.rootNode,
        childScope.frame,
        childScope.bindingsByLevels,
        childScope.bindingsByLevelsIdx + 1);
  }

  private static List<List<String>> gatherBindingsByLevels(Map<String, FramePointer> bindings) {
    if (bindings.isEmpty()) {
      return List.of();
    }

    int maxParentLevel =
        bindings.values().stream()
            .max(Comparator.comparingInt(FramePointer::parentLevel))
            .orElseThrow()
            .parentLevel();

    // Get all binding names for a particular parent level
    List<List<String>> bindingsByLevels = new ArrayList<>(maxParentLevel + 1);
    for (int level = 0; level < maxParentLevel + 1; level++) {
      final int finalLevel = level;
      List<String> levelBindings =
          bindings.entrySet().stream()
              .filter(entry -> entry.getValue().parentLevel() == finalLevel)
              .map(Entry::getKey)
              .collect(Collectors.toList());
      bindingsByLevels.add(levelBindings);
    }
    return bindingsByLevels;
  }

  @ExportMessage
  boolean hasLanguage() {
    return true;
  }

  @ExportMessage
  Class<? extends TruffleLanguage<?>> getLanguage() {
    return EnsoLanguage.class;
  }

  @ExportMessage
  boolean isScope() {
    return true;
  }

  @ExportMessage
  boolean hasMembers() {
    return true;
  }

  /** Returns the members from the current local scope and all the parent scopes. */
  @ExportMessage
  @TruffleBoundary
  ScopeMembers getMembers(boolean includeInternal) {
    List<String> members = new ArrayList<>();
    bindingsByLevels.stream().skip(bindingsByLevelsIdx).forEach(members::addAll);
    return new ScopeMembers(members);
  }

  @ExportMessage
  @TruffleBoundary
  boolean isMemberModifiable(String memberName) {
    return allBindings.containsKey(memberName);
  }

  @ExportMessage
  boolean isMemberInsertable(String memberName) {
    return false;
  }

  @ExportMessage
  boolean isMemberInvocable(String memberName) {
    // TODO
    return false;
  }

  @ExportMessage
  boolean hasMemberReadSideEffects(String member) {
    return false;
  }

  @ExportMessage
  boolean hasMemberWriteSideEffects(String member) {
    return false;
  }

  @ExportMessage
  @TruffleBoundary
  boolean isMemberReadable(String memberName) {
    // When a value in a frame is null, it means that the corresponding
    // AssignmentNode was not run yet, and the slot kind of the
    // FrameDescriptor would be Illegal.
    return allBindings.containsKey(memberName)
        && getValue(frame, allBindings.get(memberName)) != null;
  }

  @ExportMessage
  @TruffleBoundary
  Object readMember(String member, @CachedLibrary("this") InteropLibrary interop)
      throws UnknownIdentifierException, UnsupportedMessageException {
    if (!allBindings.containsKey(member)) {
      throw UnknownIdentifierException.create(member);
    }
    FramePointer framePtr = allBindings.get(member);
    var value = getValue(frame, framePtr);
    if (value != null && isHostObject(value)) {
      // Determine if the host object can be converted to corresponding Enso value.
      var interopUncached = InteropLibrary.getUncached();
      var conversionType = HostMethodCallNode.getPolyglotConversionType(value, interopUncached);
      try {
        switch (conversionType) {
          case CONVERT_TO_DATE -> {
            var localDate = interopUncached.asDate(value);
            return new EnsoDate(localDate);
          }
          case CONVERT_TO_ARRAY -> {
            return ArrayLikeHelpers.asVectorFromArray(value);
          }
          case CONVERT_TO_BIG_INT -> {
            return new EnsoBigInteger(interopUncached.asBigInteger(value));
          }
          case CONVERT_TO_DATE_TIME, CONVERT_TO_ZONED_DATE_TIME -> {
            var date = interopUncached.asDate(value);
            var time = interopUncached.asTime(value);
            var zonedDt = date.atTime(time).atZone(ZoneId.systemDefault());
            return new EnsoDateTime(zonedDt);
          }
          case CONVERT_TO_DURATION -> {
            return new EnsoDuration(interopUncached.asDuration(value));
          }
          case CONVERT_TO_HASH_MAP -> {
            var ensoHash = EnsoHashMap.empty();
            var insertNode = HashMapInsertNode.getUncached();
            var vec = HashMapToVectorNode.getUncached().execute(value);
            var arrayAtNode = ArrayLikeAtNode.getUncached();
            var size = ArrayLikeLengthNode.getUncached().executeLength(vec);
            for (long i = 0; i < size; i++) {
              var pair = arrayAtNode.executeAt(vec, i);
              var key = arrayAtNode.executeAt(pair, 0);
              var val = arrayAtNode.executeAt(pair, 1);
              ensoHash = insertNode.execute(null, ensoHash, key, val);
            }
            return ensoHash;
          }
          case CONVERT_TO_TEXT -> {
            return Text.create(interopUncached.asString(value));
          }
          case CONVERT_TO_TIME_ZONE -> {
            return new EnsoTimeZone(interopUncached.asTimeZone(value));
          }
          case CONVERT_TO_TIME_OF_DAY -> {
            var time = interopUncached.asTime(value);
            return new EnsoTimeOfDay(time);
          }
          case NO_CONVERSION -> {
            return value;
          }
        }
      } catch (UnsupportedMessageException e) {
        throw e;
      } catch (InvalidArrayIndexException e) {
        throw UnsupportedMessageException.create(e);
      }
    }
    return value != null ? value : DataflowError.UNINITIALIZED;
  }

  private String readFirstMember(Object object) {
    var interop = InteropLibrary.getUncached();
    try {
      if (interop.hasMembers(object)) {
        var members = interop.getMembers(object, true);
        var firstMember = interop.readArrayElement(members, 0);
        return interop.asString(firstMember);
      }
    } catch (UnsupportedMessageException | InvalidArrayIndexException e) {
      return null;
    }
    return null;
  }

  private boolean isHostObject(Object object) {
    return EnsoContext.get(null).isJavaPolyglotObject(object);
  }

  @ExportMessage
  @TruffleBoundary
  void writeMember(String member, Object value) throws UnknownIdentifierException {
    if (!allBindings.containsKey(member)) {
      throw UnknownIdentifierException.create(member);
    }
    FramePointer framePtr = allBindings.get(member);
    setValue(frame, framePtr, value);
  }

  @ExportMessage
  Object invokeMember(String member, Object[] args) throws UnsupportedMessageException {
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean hasScopeParent() {
    return bindingsByLevelsIdx < bindingsByLevels.size() - 1;
  }

  /**
   * Returns the parent scope. ModuleScopes are not supported yet.
   *
   * @return Parent scope (outer method).
   * @throws UnsupportedMessageException if there is no parent scope.
   */
  @ExportMessage
  Object getScopeParent() throws UnsupportedMessageException {
    if (!hasScopeParent()) {
      throw UnsupportedMessageException.create();
    } else {
      return createParent(this);
    }
  }

  @ExportMessage
  boolean hasSourceLocation() {
    return true;
  }

  @ExportMessage
  @TruffleBoundary
  SourceSection getSourceLocation() {
    return rootNode.getSourceSection();
  }

  @ExportMessage
  @TruffleBoundary
  String toDisplayString(boolean allowSideEffects) {
    return rootNode.toString();
  }

  @Override
  @TruffleBoundary
  public String toString() {
    return String.format(
        "DebugLocalScope{rootNode = '%s', bindingsByLevels = %s, idx = %d}",
        rootNode.toString(), bindingsByLevels.toString(), bindingsByLevelsIdx);
  }

  private Object getValue(MaterializedFrame frame, FramePointer ptr) {
    return ptr == null ? null : getProperFrame(frame, ptr).getValue(ptr.frameSlotIdx());
  }

  private void setValue(MaterializedFrame frame, FramePointer ptr, Object value) {
    assert ptr != null;
    MaterializedFrame properFrame = getProperFrame(frame, ptr);
    properFrame.setObject(ptr.frameSlotIdx(), value);
  }

  private MaterializedFrame getProperFrame(MaterializedFrame frame, FramePointer ptr) {
    MaterializedFrame currentFrame = frame;
    for (int i = 0; i < ptr.parentLevel(); i++) {
      currentFrame = Function.ArgumentsHelper.getLocalScope(currentFrame.getArguments());
    }
    return currentFrame;
  }

  /** Simple interop wrapper for a list of strings. */
  @ExportLibrary(InteropLibrary.class)
  static final class ScopeMembers implements EnsoObject {
    private final List<String> memberNames;

    ScopeMembers(List<String> memberNames) {
      this.memberNames = memberNames;
    }

    @ExportMessage
    boolean hasArrayElements() {
      return true;
    }

    @ExportMessage
    long getArraySize() {
      return memberNames.size();
    }

    @ExportMessage
    boolean isArrayElementReadable(long index) {
      return 0 <= index && index < memberNames.size();
    }

    @ExportMessage
    String readArrayElement(long index) {
      return memberNames.get((int) index);
    }

    @Override
    public String toString() {
      return memberNames.toString();
    }
  }
}
