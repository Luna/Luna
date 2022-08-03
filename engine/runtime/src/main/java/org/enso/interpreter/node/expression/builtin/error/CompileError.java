package org.enso.interpreter.node.expression.builtin.error;

import org.enso.interpreter.dsl.BuiltinType;
import org.enso.interpreter.node.expression.builtin.Builtin;

import java.util.List;

@BuiltinType
public class CompileError extends Builtin {
    @Override
    protected List<Cons> getDeclaredConstructors() {
        return List.of(new Cons("Make_Compile_Error", "message"));
    }
}
