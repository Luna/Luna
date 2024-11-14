package org.enso.interpreter.node.typecheck;

import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.ExplodeLoop;
import java.util.Arrays;
import java.util.stream.Collectors;

final class OneOfNode extends TypeCheckValueNode {

  @Children private TypeCheckValueNode[] checks;

  OneOfNode(String name, TypeCheckValueNode[] checks) {
    super(name);
    this.checks = checks;
  }

  @Override
  @ExplodeLoop
  final Object findDirectMatch(VirtualFrame frame, Object value) {
    for (org.enso.interpreter.node.typecheck.TypeCheckValueNode n : checks) {
      java.lang.Object result = n.findDirectMatch(frame, value);
      if (result != null) {
        return result;
      }
    }
    return null;
  }

  @Override
  @ExplodeLoop
  Object executeCheckOrConversion(VirtualFrame frame, Object value) {
    java.lang.Object direct = findDirectMatch(frame, value);
    if (direct != null) {
      return direct;
    }
    for (org.enso.interpreter.node.typecheck.TypeCheckValueNode n : checks) {
      java.lang.Object result = n.executeCheckOrConversion(frame, value);
      if (result != null) {
        return result;
      }
    }
    return null;
  }

  @Override
  String expectedTypeMessage() {
    java.util.List<java.lang.String> parts =
        Arrays.stream(checks)
            .map(TypeCheckValueNode::expectedTypeMessage)
            .collect(Collectors.toList());
    return joinTypeParts(parts, "|");
  }
}
