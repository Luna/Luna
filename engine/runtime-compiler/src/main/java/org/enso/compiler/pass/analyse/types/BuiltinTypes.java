package org.enso.compiler.pass.analyse.types;

import org.enso.pkg.QualifiedName;
import org.enso.pkg.QualifiedName$;

/** A helper class providing the builtin types. */
public final class BuiltinTypes {
  private BuiltinTypes() {}

  public static final String numberQualifiedName = "Standard.Base.Data.Numbers.Number";
  private static final String integerQualifiedName = "Standard.Base.Data.Numbers.Integer";
  private static final String floatQualifiedName = "Standard.Base.Data.Numbers.Float";
  public static final TypeRepresentation TEXT = fromQualifiedName("Standard.Base.Data.Text.Text");
  public static final TypeRepresentation BOOLEAN =
      fromQualifiedName("Standard.Base.Data.Boolean.Boolean");
  public static final TypeRepresentation VECTOR =
      fromQualifiedName("Standard.Base.Data.Vector.Vector");
  public static final TypeRepresentation NOTHING =
      fromQualifiedName("Standard.Base.Nothing.Nothing");

  private static TypeRepresentation fromQualifiedName(String qualifiedName) {
    var fqn = QualifiedName$.MODULE$.fromString(qualifiedName);
    return new TypeRepresentation.AtomType(fqn, null);
  }

  public static boolean isAny(QualifiedName qualifiedName) {
    var str = qualifiedName.toString();
    return str.equals(anyQualifiedName) || str.equals("Standard.Base.Any");
  }

  public static boolean isFunction(QualifiedName qualifiedName) {
    var str = qualifiedName.toString();
    return str.equals(functionQualifiedName);
  }

  public static final TypeRepresentation INTEGER = fromQualifiedName(integerQualifiedName);

  static final String anyQualifiedName = "Standard.Base.Any.Any";
  static final String functionQualifiedName = "Standard.Base.Function.Function";
  public static final TypeRepresentation FLOAT = fromQualifiedName(floatQualifiedName);
  public static final TypeRepresentation NUMBER = fromQualifiedName(numberQualifiedName);

  public static boolean isInteger(QualifiedName qualifiedName) {
    return qualifiedName.toString().equals(integerQualifiedName);
  }

  public static boolean isFloat(QualifiedName qualifiedName) {
    return qualifiedName.toString().equals(floatQualifiedName);
  }
}
