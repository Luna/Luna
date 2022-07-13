package org.enso.interpreter.runtime.builtin;

import com.oracle.truffle.api.CompilerDirectives;
import org.enso.interpreter.node.expression.builtin.error.*;
import org.enso.interpreter.node.expression.builtin.error.NoSuchMethodError;
import org.enso.interpreter.runtime.callable.UnresolvedConversion;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.callable.atom.Atom;
import org.enso.interpreter.runtime.callable.atom.AtomConstructor;
import org.enso.interpreter.runtime.data.Array;
import org.enso.interpreter.runtime.data.text.Text;

import static com.oracle.truffle.api.CompilerDirectives.transferToInterpreterAndInvalidate;

/** Container for builtin Error types */
public class Error {

  private final BuiltinType syntaxError;
  private final BuiltinType typeError;
  private final BuiltinType compileError;
  private final BuiltinType inexhaustivePatternMatchError;
  private final BuiltinType uninitializedState;
  private final BuiltinType noSuchMethodError;
  private final BuiltinType noSuchConversionError;
  private final BuiltinType polyglotError;
  private final BuiltinType moduleNotInPackageError;
  private final BuiltinType arithmeticError;
  private final BuiltinType invalidArrayIndexError;
  private final BuiltinType arityError;
  private final BuiltinType unsupportedArgumentsError;
  private final BuiltinType moduleDoesNotExistError;
  private final BuiltinType notInvokableError;
  private final BuiltinType invalidConversionTargetError;
  private final BuiltinType panic;
  private final BuiltinType caughtPanic;

  @CompilerDirectives.CompilationFinal private Atom arithmeticErrorShiftTooBig;

  @CompilerDirectives.CompilationFinal private Atom arithmeticErrorDivideByZero;

  private static final Text shiftTooBigMessage = Text.create("Shift amount too large.");
  private static final Text divideByZeroMessage = Text.create("Cannot divide by zero.");

  /** Creates builders for error Atom Constructors. */
  public Error(Builtins builtins) {
    syntaxError = new BuiltinType(builtins, SyntaxError.class);
    typeError = new BuiltinType(builtins, TypeError.class);
    compileError = new BuiltinType(builtins, CompileError.class);
    inexhaustivePatternMatchError =
        new BuiltinType(builtins, InexhaustivePatternMatchError.class);
    uninitializedState = new BuiltinType(builtins, UninitializedState.class);
    noSuchMethodError = new BuiltinType(builtins, NoSuchMethodError.class);
    noSuchConversionError = new BuiltinType(builtins, NoSuchConversionError.class);
    polyglotError = new BuiltinType(builtins, PolyglotError.class);
    moduleNotInPackageError = new BuiltinType(builtins, ModuleNotInPackageError.class);
    arithmeticError = new BuiltinType(builtins, ArithmeticError.class);
    invalidArrayIndexError = new BuiltinType(builtins, InvalidArrayIndexError.class);
    arityError = new BuiltinType(builtins, ArityError.class);
    unsupportedArgumentsError =
        new BuiltinType(builtins, UnsupportedArgumentTypes.class);
    moduleDoesNotExistError = new BuiltinType(builtins, ModuleDoesNotExist.class);
    notInvokableError = new BuiltinType(builtins, NotInvokableError.class);
    invalidConversionTargetError =
        new BuiltinType(builtins, InvalidConversionTargetError.class);
    panic = new BuiltinType(builtins, Panic.class);
    caughtPanic = new BuiltinType(builtins, CaughtPanic.class);
  }

  public Atom makeSyntaxError(Object message) {
    return syntaxError.newInstance(message);
  }

  public Atom makeCompileError(Object message) {
    return compileError.newInstance(message);
  }

  public Atom makeInexhaustivePatternMatchError(Object message) {
    return inexhaustivePatternMatchError.newInstance(message);
  }

  public Atom makeUninitializedStateError(Object key) {
    return uninitializedState.newInstance(key);
  }

  public Atom makeModuleNotInPackageError() {
    return moduleNotInPackageError.newInstance();
  }

  public AtomConstructor panic() {
    return panic.getType();
  }

  public AtomConstructor caughtPanic() {
    return caughtPanic.getType();
  }

  /**
   * Creates an instance of the runtime representation of a {@code No_Such_Method_Error}.
   *
   * @param target the method call target
   * @param symbol the method being called
   * @return a runtime representation of the error
   */
  public Atom makeNoSuchMethodError(Object target, UnresolvedSymbol symbol) {
    return noSuchMethodError.newInstance(target, symbol);
  }

  public Atom makeNoSuchConversionError(
      Object target, Object that, UnresolvedConversion conversion) {
    return noSuchConversionError.newInstance(target, that, conversion);
  }

  public Atom makeInvalidConversionTargetError(Object target) {
    return invalidConversionTargetError.newInstance(target);
  }

  /**
   * Creates an instance of the runtime representation of a {@code Type_Error}.
   *
   * @param expected the expected type
   * @param actual the actual type
   * @param name the name of the variable that is a type error
   * @return a runtime representation of the error.
   */
  public Atom makeTypeError(Object expected, Object actual, String name) {
    return typeError.newInstance(expected, actual, Text.create(name));
  }

  /**
   * Creates an instance of the runtime representation of a {@code Polyglot_Error}.
   *
   * @param cause the cause of the error.
   * @return a runtime representation of the polyglot error.
   */
  public Atom makePolyglotError(Object cause) {
    return polyglotError.newInstance(cause);
  }

  /**
   * Create an instance of the runtime representation of an {@code Arithmetic_Error}.
   *
   * @param reason the reason that the error is being thrown for
   * @return a runtime representation of the arithmetic error
   */
  private Atom makeArithmeticError(Text reason) {
    return arithmeticError.newInstance(reason);
  }

  /** @return An arithmetic error representing a too-large shift for the bit shift. */
  public Atom getShiftAmountTooLargeError() {
    if (arithmeticErrorShiftTooBig == null) {
      transferToInterpreterAndInvalidate();
      arithmeticErrorShiftTooBig = makeArithmeticError(shiftTooBigMessage);
    }
    return arithmeticErrorShiftTooBig;
  }

  /** @return An Arithmetic error representing a division by zero. */
  public Atom getDivideByZeroError() {
    if (arithmeticErrorDivideByZero == null) {
      transferToInterpreterAndInvalidate();
      arithmeticErrorDivideByZero = makeArithmeticError(divideByZeroMessage);
    }
    return arithmeticErrorDivideByZero;
  }

  /**
   * @param array the array
   * @param index the index
   * @return An error representing that the {@code index} is not valid in {@code array}
   */
  public Atom makeInvalidArrayIndexError(Object array, Object index) {
    return invalidArrayIndexError.newInstance(array, index);
  }

  /**
   * @param expected_min the minimum expected arity
   * @param expected_max the maximum expected arity
   * @param actual the actual arity
   * @return an error informing about the arity being mismatched
   */
  public Atom makeArityError(long expected_min, long expected_max, long actual) {
    return arityError.newInstance(expected_min, expected_max, actual);
  }

  /**
   * @param args an array containing objects
   * @return an error informing about the particular assortment of arguments not being valid for a
   *     given method callp
   */
  public Atom makeUnsupportedArgumentsError(Object[] args) {
    return unsupportedArgumentsError.newInstance(new Array(args));
  }

  /**
   * @param name the name of the module that doesn't exist
   * @return a module does not exist error
   */
  public Atom makeModuleDoesNotExistError(String name) {
    return moduleDoesNotExistError.newInstance(Text.create(name));
  }

  /**
   * @param target the target attempted to be invoked
   * @return a not invokable error
   */
  public Atom makeNotInvokableError(Object target) {
    return notInvokableError.newInstance(target);
  }
}
