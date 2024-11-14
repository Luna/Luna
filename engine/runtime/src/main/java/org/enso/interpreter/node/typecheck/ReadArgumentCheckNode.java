package org.enso.interpreter.node.typecheck;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.Node;
import java.util.Arrays;
import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.enso.interpreter.node.ExpressionNode;
import org.enso.interpreter.node.expression.builtin.meta.AtomWithAHoleNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.UnresolvedConstructor;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.error.DataflowError;
import org.enso.interpreter.runtime.error.PanicException;
import org.enso.interpreter.runtime.util.CachingSupplier;

public abstract class ReadArgumentCheckNode extends Node {
  private final String comment;
  @CompilerDirectives.CompilationFinal private String expectedTypeMessage;

  ReadArgumentCheckNode(String comment) {
    this.comment = comment;
  }

  /** */
  public static ExpressionNode wrap(ExpressionNode original, ReadArgumentCheckNode check) {
    return new TypeCheckExpressionNode(original, check);
  }

  /**
   * Executes check or conversion of the value.
   *
   * @param frame frame requesting the conversion
   * @param value the value to convert
   * @return {@code null} when the check isn't satisfied and conversion isn't possible or non-{@code
   *     null} value that can be used as a result
   */
  public final Object handleCheckOrConversion(VirtualFrame frame, Object value) {
    var result = executeCheckOrConversion(frame, value);
    if (result == null) {
      throw panicAtTheEnd(value);
    }
    return result;
  }

  abstract Object findDirectMatch(VirtualFrame frame, Object value);

  abstract Object executeCheckOrConversion(VirtualFrame frame, Object value);

  abstract String expectedTypeMessage();

  protected final String joinTypeParts(List<String> parts, String separator) {
    assert !parts.isEmpty();
    if (parts.size() == 1) {
      return parts.get(0);
    }

    var separatorWithSpace = " " + separator + " ";
    var builder = new StringBuilder();
    boolean isFirst = true;
    for (String part : parts) {
      if (isFirst) {
        isFirst = false;
      } else {
        builder.append(separatorWithSpace);
      }

      // If the part contains a space, it means it is not a single type but already a more complex
      // expression with a separator.
      // So to ensure we don't mess up the expression layers, we need to add parentheses around it.
      boolean needsParentheses = part.contains(" ");
      if (needsParentheses) {
        builder.append("(");
      }
      builder.append(part);
      if (needsParentheses) {
        builder.append(")");
      }
    }

    return builder.toString();
  }

  final PanicException panicAtTheEnd(Object v) {
    if (expectedTypeMessage == null) {
      CompilerDirectives.transferToInterpreterAndInvalidate();
      expectedTypeMessage = expectedTypeMessage();
    }
    var ctx = EnsoContext.get(this);
    Text msg;
    if (v instanceof UnresolvedConstructor) {
      msg = Text.create("Cannot find constructor {got} among {exp}");
    } else {
      var where = Text.create(comment == null ? "expression" : comment);
      var exp = Text.create("expected ");
      var got = Text.create(" to be {exp}, but got {got}");
      msg = Text.create(exp, Text.create(where, got));
    }
    var err = ctx.getBuiltins().error().makeTypeErrorOfComment(expectedTypeMessage, v, msg);
    throw new PanicException(err, this);
  }

  public static ReadArgumentCheckNode allOf(String argumentName, ReadArgumentCheckNode... checks) {
    var list = Arrays.asList(checks);
    var flatten =
        list.stream()
            .flatMap(
                n ->
                    n instanceof AllOfNode all
                        ? Arrays.asList(all.getChecks()).stream()
                        : Stream.of(n))
            .toList();
    var arr = toArray(flatten);
    return switch (arr.length) {
      case 0 -> null;
      case 1 -> arr[0];
      default -> new AllOfNode(argumentName, arr);
    };
  }

  public static ReadArgumentCheckNode oneOf(String comment, List<ReadArgumentCheckNode> checks) {
    var arr = toArray(checks);
    return switch (arr.length) {
      case 0 -> null;
      case 1 -> arr[0];
      default -> new OneOfNode(comment, arr);
    };
  }

  public static ReadArgumentCheckNode build(EnsoContext ctx, String comment, Type expectedType) {
    assert ctx.getBuiltins().any() != expectedType : "Don't check for Any: " + expectedType;
    return TypeCheckNodeGen.create(comment, expectedType);
  }

  public static ReadArgumentCheckNode meta(
      String comment, Supplier<? extends Object> metaObjectSupplier) {
    var cachingSupplier = CachingSupplier.wrap(metaObjectSupplier);
    return MetaCheckNodeGen.create(comment, cachingSupplier);
  }

  public static boolean isWrappedThunk(Function fn) {
    if (fn.getSchema() == LazyCheckRootNode.SCHEMA) {
      return fn.getPreAppliedArguments()[0] instanceof Function wrappedFn && wrappedFn.isThunk();
    }
    return false;
  }

  static boolean isAllFitValue(Object v) {
    return v instanceof DataflowError || AtomWithAHoleNode.isHole(v);
  }

  private static ReadArgumentCheckNode[] toArray(List<ReadArgumentCheckNode> list) {
    if (list == null) {
      return new ReadArgumentCheckNode[0];
    }
    var cnt = (int) list.stream().filter(n -> n != null).count();
    var arr = new ReadArgumentCheckNode[cnt];
    var it = list.iterator();
    for (int i = 0; i < cnt; ) {
      var element = it.next();
      if (element != null) {
        arr[i++] = element;
      }
    }
    return arr;
  }
}
