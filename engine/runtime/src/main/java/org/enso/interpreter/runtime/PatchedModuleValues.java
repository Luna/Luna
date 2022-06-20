package org.enso.interpreter.runtime;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.instrumentation.EventBinding;
import com.oracle.truffle.api.instrumentation.EventContext;
import com.oracle.truffle.api.instrumentation.ExecutionEventListener;
import com.oracle.truffle.api.instrumentation.Instrumenter;
import com.oracle.truffle.api.instrumentation.SourceFilter;
import com.oracle.truffle.api.instrumentation.SourceSectionFilter;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.source.Source;
import com.oracle.truffle.api.source.SourceSection;
import java.io.IOException;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.Map;
import java.util.TreeMap;
import org.enso.compiler.context.SimpleUpdate;
import org.enso.interpreter.instrument.IdExecutionService;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.tag.Patchable;
import org.enso.polyglot.LanguageInfo;

/**
 * Keeps patched values for expression in  module. Also keeps mapping of
 * original source offset and new {@link #findDelta(int, boolean) deltas}.
 */
final class PatchedModuleValues {
  private final TreeMap<Integer,int[]> deltas = new TreeMap<>();
  private final Map<Node, Runnable> values = new HashMap<>();
  private final Module module;

  PatchedModuleValues(Module module) {
    this.module = module;
  }

  /** Disposes the binding. No-op currently.
   */
  void dispose() {
  }

  /** Keeps "deltas" for each {@code offset} where a modification happened.
   * Edits are always deleting few characters and inserting another few characters
   * at a given location. The idea here is to use {@code SortedMap} to keep
   * information about "deltas" at each offset of modification. Whenever new
   * edit is made, the delta at its offset is recorded and all deltas after
   * the offset adjusted as they shift too.
   *
   * @param instr instrumenter to attach itself as a ultimate source of values
   *    for {@link Patchable.Tag} nodes
   * @param collect {@link Node} to value map of the values to use
   * @param offset location when a modification happened
   * @param delta positive or negative change at the offset location
   */
  private synchronized void performUpdates(
    Instrumenter instr, Map<Node, Runnable> collect, int offset, int delta
  ) {
    for (var entry : collect.entrySet()) {
      // do the patching
      entry.getValue().run();
    }

    values.putAll(collect);


    if (delta == 0) {
      return;
    }
    Map.Entry<Integer, int[]> previous = deltas.floorEntry(offset);
    if (previous == null) {
      deltas.put(offset, new int[] { delta });
    } else if (previous.getKey() == offset) {
      previous.getValue()[0] += delta;
    } else {
      deltas.put(offset, new int[] { previous.getValue()[0] + delta });
    }
    for (int[] after : deltas.tailMap(offset, false).values()) {
      after[0] += delta;
    }
  }

  /** Checks whether a simple edit is applicable and performs it if so.
   *
   * @param module module providing the source
   * @param update information about the edit to be done
   * @return {@code true} if the edit was applied, {@code false} to proceed with
   *   full re-parse of the source
   */
  boolean simpleUpdate(Module module, SimpleUpdate update) {
    var scope = module.getScope();
    var methods = scope.getMethods();
    var conversions = scope.getConversions();
    var collect = new HashMap<Node, Runnable>();
    for (var n : values.keySet()) {
      updateNode(update, n, collect);
    }
    if (collect.isEmpty()) {
      // only search for new literals when none have been found
      updateFunctionsMap(update, methods.values(), collect);
      updateFunctionsMap(update, conversions.values(), collect);
      if (collect.isEmpty()) {
        return false;
      }
    }

    var ctx = Context.get(collect.keySet().iterator().next());
    var instr = ctx.getEnvironment().lookup(Instrumenter.class);
    final Source src;
    try {
      src = module.getSource();
    } catch (IOException ex) {
      throw new IllegalStateException(ex);
    }
    var edit = update.edit();
    int offset =
        src.getLineStartOffset(edit.range().start().line() + 1) + edit.range().start().character();
    int removed = edit.range().end().character() - edit.range().start().character();
    int delta = edit.text().length() - removed;

    performUpdates(instr, collect, offset, delta);
    return true;
  }

  private static void updateFunctionsMap(SimpleUpdate edit, Collection<? extends Map<?, Function>> values, Map<Node, Runnable> nodeValues) {
    for (Map<?, Function> map : values) {
      for (Function f : map.values()) {
        updateNode(edit, f.getCallTarget().getRootNode(), nodeValues);
      }
    }
  }

  private static void updateNode(SimpleUpdate update, Node root, Map<Node, Runnable> nodeValues) {
    LinkedList<Node> queue = new LinkedList<>();
    queue.add(root);
    var edit = update.edit();
    while (!queue.isEmpty()) {
      var n = queue.removeFirst();
      SourceSection at = n.getSourceSection();
      if (at != null) {
        if (at.getEndLine() - 1 < edit.range().start().line()) {
          continue;
        }
        if (at.getStartLine() - 1 > edit.range().end().line()) {
          continue;
        }
        if (n instanceof Patchable node) {
          if (
            at.getStartLine() - 1 == edit.range().start().line() &&
            at.getStartColumn() - 1 == edit.range().start().character() &&
            at.getEndLine() - 1 == edit.range().end().line() &&
            at.getEndColumn() == edit.range().end().character()
          ) {
            Runnable newValue = node.parsePatch(update.newIr());
            if (newValue != null) {
              nodeValues.put(n, newValue);
            }
          }
        }
      }
      for (var ch : n.getChildren()) {
        queue.add(ch);
      }
    }
  }

  /**
   * Finds difference against location in the original source code.
   *
   * @param offset the original location
   * @param inclusive are modifications at the same location going to count or not
   *   - they count for section ends, but do not count for section starts
   * @return positive or negative delta to apply at given offset
   */
  int findDelta(int offset, boolean inclusive) {
    Map.Entry<Integer, int[]> previous = inclusive ? deltas.floorEntry(offset) : deltas.lowerEntry(offset);
    return previous == null ? 0 : previous.getValue()[0];
  }
}
