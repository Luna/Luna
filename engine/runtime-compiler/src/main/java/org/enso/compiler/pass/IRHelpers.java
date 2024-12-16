package org.enso.compiler.pass;

import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.Set;
import org.enso.compiler.core.IR;
import org.enso.scala.wrapper.ScalaConversions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class IRHelpers {
  private static final Logger LOG = LoggerFactory.getLogger(IRHelpers.class);
  private static HashSet<Integer> reportedIdentityHashCodes;

  private IRHelpers() {}

  /**
   * Processes whole IR subtree to find (top most) elements that are referenced multiple times.
   *
   * @param root the root of IR tree to process
   * @return set of IR elements that appear at least twice
   */
  private static Set<IR> findTopMostDuplicates(IR root) {
    var foundIR = new IdentityHashMap<IR, Integer>();
    var irToProcess = new ArrayDeque<IR>();
    irToProcess.add(root);
    while (!irToProcess.isEmpty()) {
      var ir = irToProcess.remove();
      if (foundIR.containsKey(ir)) {
        foundIR.put(ir, 1);
      } else {
        foundIR.put(ir, 0);
        irToProcess.addAll(ScalaConversions.asJava(ir.children()));
      }
    }
    var it = foundIR.entrySet().iterator();
    while (it.hasNext()) {
      if (it.next().getValue() == 0) {
        it.remove();
      }
    }
    return foundIR.keySet();
  }

  static <IRType extends IR> IRType checkDuplicates(String msg, IRType ir) {
    var duplicates = findTopMostDuplicates(ir);
    if (duplicates.isEmpty()) {
      return ir;
    } else {
      if (reportedIdentityHashCodes == null) {
        reportedIdentityHashCodes = new HashSet<>();
      }
      var all = ir.preorder();
      for (var dupl : duplicates) {
        if (!reportedIdentityHashCodes.add(System.identityHashCode(dupl))) {
          continue;
        }
        LOG.error("Duplicate found after " + msg + ": " + toString(dupl));
        all.foreach(
            e -> {
              if (e.children().contains(dupl)) {
                LOG.error("  referenced by " + toString(e));
              }
              return null;
            });
      }
    }
    return ir;
  }

  private static String toString(IR ir) {
    return ir.getClass().getName()
        + "@"
        + Integer.toHexString(System.identityHashCode(ir))
        + ":"
        + ir.showCode();
  }
}
