package org.enso.interpreter.runtime.callable.atom.unboxing;

import com.oracle.truffle.api.dsl.*;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.ExplodeLoop;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.runtime.callable.argument.ArgumentDefinition;
import org.enso.interpreter.runtime.callable.atom.Atom;
import org.enso.interpreter.runtime.callable.atom.AtomConstructor;
import org.enso.interpreter.runtime.callable.atom.StructsLibrary;

/**
 * This is a common superclass for atoms that know their arity and are able to unbox some fields.
 * The concrete subclasses are autogenerated due to huge amounts of code repetition. See {@link
 * Layout} for how all these elements are tied together.
 *
 * <p>A typical generated subclass, adhering to naming conventions chosen here, will look like this
 * (certain node implementations are omitted, see further documentation or jump to the generated
 * code {@link Layout_Atom_2_1}):
 *
 * <pre>
 *   public class Layout_Atom_2_1 extends UnboxingAtom {
 *     private long field0;
 *     private long field1;
 *     private Object field2;
 *
 *     public Layout_Atom_2_1(AtomConstructor constructor, Layout layout, long field0, long field1, Object field2) {
 *       super(constructor, layout);
 *       this.field0 = field0;
 *       this.field1 = field1;
 *       this.field2 = field2;
 *     }
 *
 *     // Additional code omitted here and documented in the body of UnboxedAtom...
 *   }
 * </pre>
 *
 * There are a few things to note here:
 *
 * <ul>
 *   <li>The naming convention for these subclasses includes the number of unboxed and boxed fields
 *       in the name. I.e. {@code Atom_m_n} is an atom holding {@code m} unboxed and {@code n} boxed
 *       fields.
 *   <li>"Unboxed" always means {@code long}. Storage for {@code double} fields is facilitated by
 *       usage of {@link Double#doubleToRawLongBits(double)} and {@link
 *       Double#longBitsToDouble(long)} in getters and during construction. This is governed by the
 *       relevant {@link Layout} instance.
 *   <li>The subclasses only specify the _number_ of fields and always store them in the order of
 *       unboxed fields first, then boxed fields. This is not necessarily compatible with the
 *       logical ordering of fields as defined by the {@link AtomConstructor}. This reordering is
 *       governed by the {@link Layout} class and it is impossible to interpret the atom without
 *       knowing the layout. NB: the layout class also makes an additional choice to always store
 *       {@link Double} fields before the {@link Long} fields, but this is not required or enforced
 *       by this class.
 *   <li>These design choices mean that to enable optimal storage of N-field atoms, we need N+1
 *       different subclasses.
 * </ul>
 */
@ExportLibrary(StructsLibrary.class)
public abstract class UnboxingAtom extends Atom {
  protected final Layout layout;

  protected UnboxingAtom(AtomConstructor constructor, Layout layout) {
    super(constructor);
    this.layout = layout;
  }

  @ExportMessage
  static class GetField {
    @Specialization(
        guards = {"cachedLayout == atom.layout", "cachedIndex == index"},
        limit = "10")
    static Object doCached(
        UnboxingAtom atom,
        int index,
        @Cached("atom.layout") Layout cachedLayout,
        @Cached("index") int cachedIndex,
        @Cached(value = "cachedLayout.buildGetter(cachedIndex)") FieldGetterNode getter) {
      return getter.execute(atom);
    }

    @Specialization(replaces = "doCached")
    static Object doUncached(UnboxingAtom atom, int index) {
      return atom.layout.getUncachedFieldGetter(index).execute(atom);
    }
  }

  @ExportMessage
  static class SetField {
    @Specialization(
        guards = {"cachedLayout == atom.layout", "cachedIndex == index"},
        limit = "10")
    static void doCached(
        UnboxingAtom atom,
        int index,
        Object value,
        @Cached("atom.layout") Layout cachedLayout,
        @Cached("index") int cachedIndex,
        @Cached(value = "cachedLayout.buildSetter(cachedIndex)") FieldSetterNode setter) {
      setter.execute(atom, value);
    }

    @Specialization(replaces = "doCached")
    static void doUncached(UnboxingAtom atom, int index, Object value) {
      atom.layout.getUncachedFieldSetter(index).execute(atom, value);
    }
  }

  @ExportMessage(name = "getFields")
  static class GetFields {
    @Specialization(guards = "cachedLayout == atom.layout", limit = "10")
    @ExplodeLoop
    static Object[] doCached(
        UnboxingAtom atom,
        @Cached("atom.layout") Layout cachedLayout,
        @Cached(value = "cachedLayout.buildGetters()") FieldGetterNode[] getters) {
      Object[] result = new Object[getters.length];
      for (int i = 0; i < getters.length; i++) {
        result[i] = getters[i].execute(atom);
      }
      return result;
    }

    @Specialization(replaces = "doCached")
    static Object[] doUncached(UnboxingAtom atom) {
      var getters = atom.layout.getUncachedFieldGetters();
      var result = new Object[getters.length];
      for (int i = 0; i < getters.length; i++) {
        result[i] = getters[i].execute(atom);
      }
      return result;
    }
  }

  /**
   * A node that gets a field from an atom. Note that the index is not specified as a parameter.
   * That is because the notion of n-th field is only defined by the {@link Layout} and the storage
   * order inside the concrete atom instance may be different from the logical ordering of fields.
   * Therefore, to get an instance of this node for a particular atom, use {@link
   * Layout#buildGetter(int)}.
   *
   * <p>Generated subclasses will generate two versions of these node for each unboxed field (one
   * for double storage and one for long storage) and one for each boxed field. For example, {@link
   * Layout_Atom_2_1} will generate the following nodes:
   *
   * <ul>
   *   <li>{@link Layout_Atom_1_2.FieldGetter_0D_Node} getting the first (unboxed) field assuming it
   *       holds a {@link Double};
   *   <li>{@link Layout_Atom_1_2.FieldGetter_0L_Node} getting the first (unboxed) field assuming it
   *       holds a {@link Long};
   *   <li>{@link Layout_Atom_1_2.FieldGetter_1_Node} getting the second (boxed) field;
   *   <li>{@link Layout_Atom_1_2.FieldGetter_2_Node} getting the third (boxed) field.
   * </ul>
   *
   * The concrete subclass will also generate a method allowing to obtain a factory for these nodes
   * based on dynamically-passed index, i.e. with the following signature: {@code public static
   * NodeFactory<? extends FieldGetterNode> getFieldGetterNodeFactory(int storageIndex, boolean
   * isDoubleIfUnboxed)}
   */
  @GenerateNodeFactory
  @GenerateUncached(inherit = true)
  public abstract static class FieldGetterNode extends Node {
    public abstract Object execute(Atom atom);
  }

  /**
   * A node creating a new atom instance. Note that the ordering of {@code args} must correspond to
   * the storage ordering of fields, not the logical ordering that would stem from the atom's
   * definition in code. Therefore, this node is not usable directly and must be mediated by {@link
   * DirectCreateLayoutInstanceNode}.
   */
  @GenerateNodeFactory
  @GenerateUncached(inherit = true)
  abstract static class InstantiatorNode extends Node {
    public abstract Atom execute(AtomConstructor constructor, Layout layout, Object[] args);
  }

  /**
   * A node that mutably sets a field in an atom. Note that, similarly to {@link FieldGetterNode},
   * the index is not specified as a parameter. Moreover, these nodes are only generated for boxed
   * fields. It is the responsibility of the user of these facilities to ensure that only boxed
   * fields are modified.
   */
  @GenerateNodeFactory
  @GenerateUncached(inherit = true)
  abstract static class FieldSetterNode extends Node {
    public abstract void execute(Atom atom, Object value);
  }

  /**
   * Wraps an {@link InstantiatorNode} to provide an externally usable interface for creating nodes.
   * It performs field reordering and casting based on the {@link Layout} to make sure it creates an
   * instance that can be understood based on the particular layout instance.
   */
  static class DirectCreateLayoutInstanceNode extends Node {
    final Layout layout;
    final AtomConstructor constructor;
    private @Children ReadAtIndexNode[] argReaderNodes;
    private @Child InstantiatorNode instantiator;

    public DirectCreateLayoutInstanceNode(AtomConstructor constructor, Layout layout) {
      this.constructor = constructor;
      this.layout = layout;
      this.argReaderNodes = new ReadAtIndexNode[layout.arity()];
      for (int i = 0; i < layout.arity(); i++) {
        this.argReaderNodes[layout.getFieldToStorage()[i]] =
            ReadAtIndexNode.create(i, layout.isDoubleAt(i));
      }
      this.instantiator = layout.getInstantiatorFactory().createNode();
    }

    @ExplodeLoop
    public Atom execute(Object[] args) {
      var arguments = new Object[argReaderNodes.length];
      for (int i = 0; i < argReaderNodes.length; i++) {
        arguments[i] = argReaderNodes[i].execute(args);
      }
      return instantiator.execute(constructor, layout, arguments);
    }

    abstract static class ReadAtIndexNode extends Node {
      final int index;

      public static ReadAtIndexNode create(int fieldIndex, boolean isDouble) {
        return isDouble
            ? new ReadDoubleAtIndexNode(fieldIndex)
            : new ReadObjectAtIndexNode(fieldIndex);
      }

      public ReadAtIndexNode(int index) {
        this.index = index;
      }

      public abstract Object execute(Object[] args);
    }

    static class ReadObjectAtIndexNode extends ReadAtIndexNode {
      ReadObjectAtIndexNode(int index) {
        super(index);
      }

      @Override
      public Object execute(Object[] args) {
        return args[index];
      }
    }

    static class ReadDoubleAtIndexNode extends ReadAtIndexNode {
      ReadDoubleAtIndexNode(int index) {
        super(index);
      }

      @Override
      public Object execute(Object[] args) {
        return Double.doubleToRawLongBits((double) args[index]);
      }
    }
  }
}
