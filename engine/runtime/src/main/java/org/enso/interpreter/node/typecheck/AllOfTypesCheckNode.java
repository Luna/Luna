package org.enso.interpreter.node.typecheck;

import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.ExplodeLoop;
import java.util.Arrays;
import java.util.stream.Collectors;
import org.enso.interpreter.node.ExpressionNode;
import org.enso.interpreter.runtime.data.EnsoMultiValue;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;

final class AllOfTypesCheckNode extends AbstractTypeCheckNode {

  @Children private AbstractTypeCheckNode[] checks;
  @Child private TypesLibrary types;

  AllOfTypesCheckNode(String name, AbstractTypeCheckNode[] checks) {
    super(name);
    this.checks = checks;
    this.types = TypesLibrary.getFactory().createDispatched(checks.length);
  }

  AbstractTypeCheckNode[] getChecks() {
    return checks;
  }

  @Override
  Object findDirectMatch(VirtualFrame frame, Object value) {
    return null;
  }

  @Override
  @ExplodeLoop
  Object executeCheckOrConversion(VirtualFrame frame, Object value, ExpressionNode expr) {
    var values = new Object[checks.length];
    var valueTypes = new Type[checks.length];
    var at = 0;
    for (var n : checks) {
      var result = n.executeCheckOrConversion(frame, value, expr);
      if (result == null) {
        return null;
      }
      valueTypes[at] = types.getType(result);
      if (result instanceof EnsoMultiValue emv) {
        result =
            EnsoMultiValue.CastToNode.getUncached()
                .findTypeOrNull(valueTypes[at], emv, false, true);
      }
      if (result == null) {
        return null;
      }
      values[at] = result;
      at++;
    }
    return EnsoMultiValue.NewNode.getUncached().newValue(valueTypes, valueTypes.length, values);
  }

  @Override
  String expectedTypeMessage() {
    var parts =
        Arrays.stream(checks)
            .map(AbstractTypeCheckNode::expectedTypeMessage)
            .collect(Collectors.toList());
    return joinTypeParts(parts, "&");
  }
}
