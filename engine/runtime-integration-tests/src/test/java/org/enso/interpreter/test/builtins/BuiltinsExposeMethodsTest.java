package org.enso.interpreter.test.builtins;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import java.util.ArrayList;
import java.util.List;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.library.dispatch.TypeOfNode;
import org.enso.interpreter.test.ValuesGenerator;
import org.enso.interpreter.test.ValuesGenerator.Language;
import org.enso.test.utils.ContextUtils;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;
import org.junit.AfterClass;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameters;

/**
 * Gathers all the builtin objects from {@link ValuesGenerator}. From their types, gathers all their
 * methods via their {@link org.enso.interpreter.runtime.scope.ModuleScope definition scope} and
 * checks that {@link Value#canInvokeMember(String)} returns true.
 */
@RunWith(Parameterized.class)
public class BuiltinsExposeMethodsTest {
  private static Context ctx;

  private final ValueWithType valueWithType;

  public BuiltinsExposeMethodsTest(ValueWithType valueWithType) {
    this.valueWithType = valueWithType;
  }

  private static Context ctx() {
    if (ctx == null) {
      ctx = ContextUtils.createDefaultContext();
    }
    return ctx;
  }

  @Parameters(name = "{index}: {0}")
  public static Iterable<ValueWithType> generateBuiltinObjects() {
    var valuesGenerator = ValuesGenerator.create(ctx(), Language.ENSO);
    var builtinObjectsWithTypes = new ArrayList<ValueWithType>();
    ContextUtils.executeInContext(
        ctx(),
        () -> {
          valuesGenerator.allValues().stream()
              .map(val -> new ValueWithType(val, getType(val)))
              .filter(valWithType -> !shouldSkipType(valWithType.type))
              .filter(valWithType -> !isPrimitive(valWithType.value))
              .forEach(builtinObjectsWithTypes::add);
          return null;
        });
    return builtinObjectsWithTypes;
  }

  private static Type getType(Value object) {
    var unwrapped = ContextUtils.unwrapValue(ctx(), object);
    return TypeOfNode.getUncached().findTypeOrNull(unwrapped);
  }

  @AfterClass
  public static void disposeCtx() {
    if (ctx != null) {
      ctx.close();
      ctx = null;
    }
  }

  @Test
  public void builtinExposeMethods() {
    ContextUtils.executeInContext(
        ctx(),
        () -> {
          assertThat(valueWithType, is(notNullValue()));
          assertThat(valueWithType.type.isBuiltin(), is(true));
          var typeDefScope = valueWithType.type.getDefinitionScope();
          var methodsDefinedInScope = typeDefScope.getMethodsForType(valueWithType.type);
          if (methodsDefinedInScope != null) {
            for (var methodInScope : methodsDefinedInScope) {
              var methodName = methodInScope.getName();
              if (methodName.contains(".")) {
                var items = methodName.split("\\.");
                methodName = items[items.length - 1];
              }
              assertThat(
                  "Member " + methodName + " should be invocable",
                  valueWithType.value.canInvokeMember(methodName),
                  is(true));
            }
          }
          return null;
        });
  }

  private static boolean isPrimitive(Value object) {
    var unwrapped = ContextUtils.unwrapValue(ctx(), object);
    return unwrapped instanceof Long
        || unwrapped instanceof Boolean
        || unwrapped instanceof Integer
        || unwrapped instanceof Double;
  }

  private static boolean shouldSkipType(Type type) {
    if (type == null) {
      return true;
    }
    if (!type.isBuiltin()) {
      return true;
    }
    var builtins = ContextUtils.leakContext(ctx()).getBuiltins();
    var typesToSkip = List.of(builtins.function(), builtins.dataflowError(), builtins.warning());
    var shouldBeSkipped = typesToSkip.stream().anyMatch(toSkip -> toSkip == type);
    return shouldBeSkipped;
  }

  public record ValueWithType(Value value, Type type) {}
}
