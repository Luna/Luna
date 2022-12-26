package org.enso.interpreter.runtime.callable.atom;


import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.*;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.ExplodeLoop;
import com.oracle.truffle.api.nodes.UnexpectedResultException;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.data.Array;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;
import org.enso.interpreter.runtime.type.TypesGen;

import java.util.Map;

/**
 * A runtime representation of an Atom in Enso.
 */
@ExportLibrary(InteropLibrary.class)
@ExportLibrary(TypesLibrary.class)
public abstract class Atom implements TruffleObject {
  public final Object[] getFields() {
    return StructsLibrary.getUncached().getFields(this);
  }

  private void toString(StringBuilder builder, boolean shouldParen, int depth) {
    if (depth <= 0) {
      builder.append("...");
      return;
    }
    boolean parensNeeded = shouldParen && getFields().length > 0;
    if (parensNeeded) {
      builder.append("(");
    }
    builder.append(StructsLibrary.getUncached().getConstructor(this).getName());
    for (var obj : getFields()) {
      builder.append(" ");
      if (obj instanceof Atom atom) {
        atom.toString(builder, true, depth - 1);
      } else {
        builder.append(obj);
      }
    }
    if (parensNeeded) {
      builder.append(")");
    }
  }

  /**
   * Creates a textual representation of this Atom, useful for debugging.
   *
   * @return a textual representation of this Atom.
   */
  @Override
  public String toString() {
    return toString(10);
  }

  @CompilerDirectives.TruffleBoundary
  private String toString(int depth) {
    StringBuilder sb = new StringBuilder();
    toString(sb, false, depth);
    return sb.toString();
  }

  @ExportMessage
  public boolean hasMembers() {
    return true;
  }

  @ExportMessage
  @CompilerDirectives.TruffleBoundary
  public Array getMembers(boolean includeInternal, @CachedLibrary("this") StructsLibrary structs) {
    var constructor = structs.getConstructor(this);
    Map<String, Function> members = constructor.getDefinitionScope().getMethods().get(constructor.getType());
    if (members == null) {
      return new Array(0);
    }
    Object[] mems = members.keySet().toArray();
    return new Array(mems);
  }

  @ExportMessage
  @CompilerDirectives.TruffleBoundary
  public boolean isMemberInvocable(String member, @CachedLibrary("this") StructsLibrary structs) {
    var constructor = structs.getConstructor(this);
    Map<String, ?> members = constructor.getDefinitionScope().getMethods().get(constructor.getType());
    return members != null && members.containsKey(member);
  }

  @ExportMessage
  @ExplodeLoop
  public boolean isMemberReadable(String member, @CachedLibrary("this") StructsLibrary structs) {
    var constructor = structs.getConstructor(this);
    for (int i = 0; i < constructor.getArity(); i++) {
      if (member.equals(constructor.getFields()[i].getName())) {
        return true;
      }
    }
    return false;
  }

  @ExportMessage
  @ExplodeLoop
  public Object readMember(String member, @CachedLibrary("this") StructsLibrary structs) throws UnknownIdentifierException {
    var constructor = structs.getConstructor(this);
    for (int i = 0; i < constructor.getArity(); i++) {
      if (member.equals(constructor.getFields()[i].getName())) {
        return getFields()[i];
      }
    }
    throw UnknownIdentifierException.create(member);
  }

  @ExportMessage
  static class InvokeMember {

    static UnresolvedSymbol buildSym(AtomConstructor cons, String name) {
      return UnresolvedSymbol.build(name, cons.getDefinitionScope());
    }

    @Specialization(
        guards = {"structs.getConstructor(receiver) == cachedConstructor", "member.equals(cachedMember)"})
    static Object doCached(
        Atom receiver,
        String member,
        Object[] arguments,
        @CachedLibrary("receiver") StructsLibrary structs,
        @Cached(value = "structs.getConstructor(receiver)") AtomConstructor cachedConstructor,
        @Cached(value = "member") String cachedMember,
        @Cached(value = "buildSym(cachedConstructor, cachedMember)") UnresolvedSymbol cachedSym,
        @CachedLibrary("cachedSym") InteropLibrary symbols
    ) throws UnsupportedMessageException, ArityException, UnsupportedTypeException {
      Object[] args = new Object[arguments.length + 1];
      args[0] = receiver;
      System.arraycopy(arguments, 0, args, 1, arguments.length);
      return symbols.execute(cachedSym, args);
    }

    @Specialization(replaces = "doCached")
    static Object doUncached(
        Atom receiver,
        String member,
        Object[] arguments,
        @CachedLibrary(limit = "1") InteropLibrary symbols, @CachedLibrary("receiver") StructsLibrary structs)
        throws UnsupportedMessageException, ArityException, UnsupportedTypeException {
      UnresolvedSymbol symbol = buildSym(structs.getConstructor(receiver), member);
      return doCached(
          receiver, member, arguments, structs, structs.getConstructor(receiver), member, symbol, symbols);
    }
  }

  @ExportMessage
  Text toDisplayString(boolean allowSideEffects, @CachedLibrary("this") InteropLibrary atoms) {
    try {
      return TypesGen.expectText(atoms.invokeMember(this, "to_text"));
    } catch (UnsupportedMessageException
             | ArityException
             | UnknownIdentifierException
             | UnsupportedTypeException
             | UnexpectedResultException e) {
      return Text.create(this.toString(10));
    }
  }

  @ExportMessage
  boolean hasType() {
    return true;
  }

  @ExportMessage
  Type getType(@CachedLibrary("this") StructsLibrary structs) {
    return structs.getConstructor(this).getType();
  }
}
