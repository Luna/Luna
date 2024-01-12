package org.enso.compiler;

import org.enso.compiler.context.FreshNameSupply;
import org.enso.compiler.context.ModuleContext;
import org.enso.compiler.core.IR;
import org.enso.compiler.core.ir.*;
import org.enso.compiler.core.ir.Module;
import org.enso.compiler.core.ir.module.scope.definition.Method;
import org.enso.compiler.data.CompilerConfig;
import org.enso.compiler.pass.PassConfiguration;
import org.enso.compiler.pass.PassManager;
import org.enso.compiler.pass.analyse.types.InferredType;
import org.enso.compiler.pass.analyse.types.TypeInference;
import org.enso.compiler.pass.analyse.types.TypeRepresentation;
import org.enso.compiler.test.CompilerRunner;
import org.enso.pkg.QualifiedName;
import org.graalvm.polyglot.Source;
import org.junit.Ignore;
import org.junit.Test;
import scala.Option;
import scala.collection.immutable.Seq;
import scala.collection.immutable.Seq$;
import scala.jdk.javaapi.CollectionConverters;

import java.net.URI;
import java.util.List;
import java.util.Optional;

import static org.junit.Assert.*;

public class TypeInferenceTest extends CompilerTest {
  @Ignore
  @Test
  public void zeroAryCheck() throws Exception {
    final URI uri = new URI("memory://zeroAryCheck.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value x
                    
                const -> My_Type = My_Type.Value 42
                    
                foo =
                    x = const
                    y = My_Type.Value 23
                    _ = y
                    x
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    Module module = compile(src);
    Method foo = findStaticMethod(module, "foo");
    var x = findAssignment(foo.body(), "x");
    TypeRepresentation xType = getInferredType(x.expression());
    TypeRepresentation.AtomType asAtom = (TypeRepresentation.AtomType) xType;
    assertTrue("The type of `x` should be `My_Type`.", asAtom.fqn().item().equals("My_Type"));
  }

  @Ignore("TODO resolution of local function application")
  @Test
  public void functionReturnCheck() throws Exception {
    final URI uri = new URI("memory://functionReturnCheck.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value x
                    
                add x y -> My_Type = My_Type.Value (x.x+y.x)
                    
                foo z =
                    a = My_Type.Value 42
                    b = add a z
                    b
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var foo = findStaticMethod(module, "foo");
    var b = findAssignment(foo.body(), "b");
    TypeRepresentation myType = TypeRepresentation.fromQualifiedName("functionReturnCheck.My_Type");

    // The result of `add a z` should be `My_Type` as guaranteed by the return type check of `add`.
    assertEquals(myType, getInferredType(b.expression()));
  }

  @Ignore("TODO resolving local bindings/arguments")
  @Test
  public void argChecks() throws Exception {
    final URI uri = new URI("memory://argChecks.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value v
                    
                f1 (x1 : My_Type) =
                  y1 = x1
                  My_Type.Value (y2.v + y2.v)
                                
                f2 : My_Type -> My_Type
                f2 x2 =
                  y2 = x2
                  My_Type.Value (y2.v + y2.v)
                                
                f3 (x3 : My_Type) -> My_Type = My_Type.Value (x3.v + x3.v)
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);

    var myType = TypeRepresentation.fromQualifiedName("argChecks.My_Type");
    assertEquals(myType, getInferredType(findAssignment(findStaticMethod(module, "f1"), "y1").expression()));
    assertNoInferredType(findAssignment(findStaticMethod(module, "f2"), "y2").expression());

    // TODO also checks for types of whole functions
  }

  @Test
  public void ascribedExpressions() throws Exception {
    final URI uri = new URI("memory://ascribedExpressions.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value x
                    
                f x =
                    y = (x : My_Type)
                    My_Type.Value (y.x + y.x)
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    Module module = compile(src);
    Method f = findStaticMethod(module, "f");

    TypeRepresentation myType = TypeRepresentation.fromQualifiedName("ascribedExpressions.My_Type");
    TypeRepresentation yType = getInferredType(findAssignment(f.body(), "y").expression());
    assertEquals(myType, yType);
  }


  @Test
  public void advancedAscribedExpressions() throws Exception {
    final URI uri = new URI("memory://advancedAscribedExpressions.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value x
                type Other_Type
                    Value y
                f z =
                    y1 = (z : My_Type | Other_Type)
                    y2 = (z : My_Type & Other_Type)
                    My_Type.Value (y1.x + y2.x)
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    Module module = compile(src);
    Method f = findStaticMethod(module, "f");

    TypeRepresentation myType = TypeRepresentation.fromQualifiedName("advancedAscribedExpressions.My_Type");
    TypeRepresentation otherType = TypeRepresentation.fromQualifiedName("advancedAscribedExpressions.Other_Type");
    TypeRepresentation sum = new TypeRepresentation.SumType(List.of(myType, otherType));
    assertEquals(sum, getInferredType(findAssignment(f.body(), "y1").expression()));

    TypeRepresentation intersection = new TypeRepresentation.IntersectionType(List.of(myType, otherType));
    assertEquals(intersection, getInferredType(findAssignment(f.body(), "y2").expression()));
  }

  @Test
  public void ascribedFunctionType() throws Exception {
    final URI uri = new URI("memory://ascribedFunctionType.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value x
                type Other_Type
                    Value y
                f z w =
                    f1 = (z : My_Type -> Other_Type)
                    f2 = (w : My_Type -> My_Type -> Other_Type)
                    f2 (f1 (My_Type.Value 42))
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    Module module = compile(src);
    Method f = findStaticMethod(module, "f");

    // Here we will only know that both f1 and f2 are Any -> Any - because the ascribed check only really performs a
    // `is_a Function` check, we do not know anything about the argument nor return type of this function,
    // unfortunately.
    TypeRepresentation primitiveFunctionType = new TypeRepresentation.ArrowType(TypeRepresentation.ANY, TypeRepresentation.ANY);
    assertEquals(primitiveFunctionType, getInferredType(findAssignment(f.body(), "f1").expression()));
    assertEquals(primitiveFunctionType, getInferredType(findAssignment(f.body(), "f2").expression()));
  }

  @Test
  public void literals() throws Exception {
    final URI uri = new URI("memory://literals.enso");
    final Source src =
        Source.newBuilder("enso", """
                f =
                    x = 42
                    y = "foo"
                    z = 1.5
                    w = [1, 2, 3]
                    x.to_text + y + z.to_text + w.to_text
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    Module module = compile(src);
    Method f = findStaticMethod(module, "f");

    assertEquals(TypeRepresentation.INTEGER, getInferredType(findAssignment(f.body(), "x").expression()));
    assertEquals(TypeRepresentation.TEXT, getInferredType(findAssignment(f.body(), "y").expression()));
    assertEquals(TypeRepresentation.FLOAT, getInferredType(findAssignment(f.body(), "z").expression()));
    assertEquals(TypeRepresentation.VECTOR, getInferredType(findAssignment(f.body(), "w").expression()));
  }

  @Test
  public void bindingsFlow() throws Exception {
    final URI uri = new URI("memory://bindingsFlow.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value v
                foo x =
                    y = (x : My_Type)
                    z = y
                    w = z
                    w
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var foo = findStaticMethod(module, "foo");

    var myType = TypeRepresentation.fromQualifiedName("bindingsFlow.My_Type");

    assertEquals(myType, getInferredType(findAssignment(foo, "w").expression()));
  }

  @Test
  public void checkedArgumentTypes() throws Exception {
    final URI uri = new URI("memory://checkedArgumentTypes.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value v
                foo (x1 : My_Type) x2 =
                    y1 = x1
                    y2 = x2
                    [y1, y2]
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var foo = findStaticMethod(module, "foo");

    var myType = TypeRepresentation.fromQualifiedName("checkedArgumentTypes.My_Type");

    // Type from argument
    assertEquals(myType, getInferredType(findAssignment(foo, "y1").expression()));

    // No type
    assertNoInferredType(findAssignment(foo, "y2").expression());
  }

  @Test
  public void zeroArgConstructor() throws Exception {
    final URI uri = new URI("memory://zeroArgConstructor.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Singleton
                foo =
                    x = My_Type.Singleton
                    x
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var foo = findStaticMethod(module, "foo");

    var myType = TypeRepresentation.fromQualifiedName("zeroArgConstructor.My_Type");
    assertEquals(myType, getInferredType(findAssignment(foo, "x").expression()));
  }

  @Test
  public void multiArgConstructor() throws Exception {
    final URI uri = new URI("memory://multiArgConstructor.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value x y z
                foo =
                    x = My_Type.Value 1 2 3
                    x
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var foo = findStaticMethod(module, "foo");

    var myType = TypeRepresentation.fromQualifiedName("multiArgConstructor.My_Type");
    assertEquals(myType, getInferredType(findAssignment(foo, "x").expression()));
  }

  @Test
  public void constructorWithDefaults() throws Exception {
    final URI uri = new URI("memory://constructorWithDefaults.enso");
    final Source src =
        Source.newBuilder("enso", """
                type My_Type
                    Value x y=100 z=200
                    All_Defaults a=1000 b=2000
                foo =
                    x1 = My_Type.Value 1 2 3
                    x2 = My_Type.Value 1 2
                    x3 = My_Type.Value 1
                    x4 = My_Type.Value
                    x5 = My_Type.Value 1 ...
                    x6 = My_Type.All_Defaults
                    x7 = My_Type.All_Defaults ...
                    [x1, x2, x3, x4, x5, x6, x7]
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var foo = findStaticMethod(module, "foo");

    var myType = TypeRepresentation.fromQualifiedName("constructorWithDefaults.My_Type");

    // The commented out expressions document the desired behaviour - we correctly infer which arguments were defaulted.
    // Before that is working, we just ensure we did not infer any 'unexpected' type for the results.
    // assertEquals(myType, getInferredType(findAssignment(foo, "x1").expression()));
    assertNoInferredType(findAssignment(foo, "x1").expression());

    // assertEquals(myType, getInferredType(findAssignment(foo, "x2").expression()));
    assertNoInferredType(findAssignment(foo, "x2").expression());

    // assertEquals(myType, getInferredType(findAssignment(foo, "x3").expression()));
    assertNoInferredType(findAssignment(foo, "x3").expression());

    assertNotEquals(Optional.of(myType), getInferredTypeOption(findAssignment(foo, "x4").expression()));
    assertNotEquals(Optional.of(myType), getInferredTypeOption(findAssignment(foo, "x5").expression()));

    // assertEquals(myType, getInferredType(findAssignment(foo, "x6").expression()));
    assertNoInferredType(findAssignment(foo, "x6").expression());

    assertNotEquals(Optional.of(myType), getInferredTypeOption(findAssignment(foo, "x7").expression()));
  }

  @Ignore("TODO: ifte")
  @Test
  public void commonIfThenElse() throws Exception {
    final URI uri = new URI("memory://commonIfThenElse.enso");
    final Source src =
        Source.newBuilder("enso", """
                f x =
                  y = if x == 10 then 1 else 2
                  y
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var f = findStaticMethod(module, "f");
    assertEquals(TypeRepresentation.INTEGER, getInferredType(findAssignment(f, "y").expression()));
  }

  @Ignore
  @Test
  public void commonCase() throws Exception {
    final URI uri = new URI("memory://commonCase.enso");
    final Source src =
        Source.newBuilder("enso", """
                f x =
                  y = case x of
                    i : Integer -> i
                    _ -> 0
                  y
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var f = findStaticMethod(module, "f");
    assertEquals(TypeRepresentation.INTEGER, getInferredType(findAssignment(f, "y").expression()));
  }

  @Ignore
  @Test
  public void inferBoundsFromCase() throws Exception {
    final URI uri = new URI("memory://inferBoundsFromCase.enso");
    final Source src =
        Source.newBuilder("enso", """
                f x =
                  y = case x of
                    _ : Integer -> x
                    _ -> 0
                  y
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var f = findStaticMethod(module, "f");
    assertEquals(TypeRepresentation.INTEGER, getInferredType(findAssignment(f, "y").expression()));
  }

  @Ignore
  @Test
  public void sumTypeFromIf() throws Exception {
    final URI uri = new URI("memory://sumTypeFromIf.enso");
    final Source src =
        Source.newBuilder("enso", """
                f x =
                  y = if x == 1 then "foo" else 42
                  y
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var f = findStaticMethod(module, "f");
    var expectedType = new TypeRepresentation.SumType(List.of(TypeRepresentation.TEXT, TypeRepresentation.INTEGER));
    assertEquals(expectedType, getInferredType(findAssignment(f, "y").expression()));
  }

  @Ignore
  @Test
  public void sumTypeFromIfWithoutElse() throws Exception {
    final URI uri = new URI("memory://sumTypeFromIf.enso");
    final Source src =
        Source.newBuilder("enso", """
                f x =
                  y = if x == 1 then "foo"
                  y
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var f = findStaticMethod(module, "f");
    var expectedType = new TypeRepresentation.SumType(List.of(TypeRepresentation.TEXT, TypeRepresentation.NOTHING));
    assertEquals(expectedType, getInferredType(findAssignment(f, "y").expression()));
  }

  @Test
  public void notInvokable() throws Exception {
    final URI uri = new URI("memory://notInvokable.enso");
    final Source src =
        Source.newBuilder("enso", """
                foo unknown =
                    x1 = 1 2
                    x2 = "a" x1
                    x3 = unknown x2
                    [x1]
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = compile(src);
    var foo = findStaticMethod(module, "foo");

    var x1 = findAssignment(foo, "x1");
    assertEquals(List.of(new Warning.NotInvokable(x1.expression().location(), "Integer")), getImmediateDiagnostics(x1.expression()));

    var x2 = findAssignment(foo, "x2");
    assertEquals(List.of(new Warning.NotInvokable(x2.expression().location(), "Text")), getImmediateDiagnostics(x2.expression()));

    var x3 = findAssignment(foo, "x3");
    assertEquals("x3 should not contain any warnings", List.of(), getImmediateDiagnostics(x3.expression()));
  }

  private List<Diagnostic> getImmediateDiagnostics(IR ir) {
    return CollectionConverters.asJava(ir.diagnostics().toList());
  }

  private Method findStaticMethod(Module module, String name) {
    var option = module.bindings().find(
        (def) ->
            (def instanceof Method binding)
                && binding.methodReference().typePointer().isEmpty()
                && binding.methodReference().methodName().name().equals(name)
    );

    assertTrue("The method " + name + " should exist within the IR.", option.isDefined());
    return (Method) option.get();
  }

  private Expression.Binding findAssignment(IR ir, String name) {
    var option = ir.preorder().find(
        (node) ->
            (node instanceof Expression.Binding binding)
                && binding.name().name().equals(name)
    );
    assertTrue("The binding `" + name + " = ...` should exist within the IR.", option.isDefined());
    return (Expression.Binding) option.get();
  }

  private TypeRepresentation getInferredType(IR ir) {
    var option = getInferredTypeOption(ir);
    assertTrue("Expecting " + ir.showCode() + " to contain an inferred type within metadata.", option.isPresent());
    return option.get();
  }

  private Optional<TypeRepresentation> getInferredTypeOption(IR ir) {
    Option<ProcessingPass.Metadata> metadata = ir.passData().get(TypeInference.INSTANCE);
    if (metadata.isEmpty()) {
      return Optional.empty();
    } else {
      InferredType inferred = (InferredType) metadata.get();
      return Optional.of(inferred.type());
    }
  }

  private void assertNoInferredType(IR ir) {
    Option<ProcessingPass.Metadata> metadata = ir.passData().get(TypeInference.INSTANCE);
    assertTrue("Expecting " + ir.showCode() + " to contain no inferred type within metadata, but it has " + metadata, metadata.isEmpty());
  }

  private Module compile(Source src) {
    System.out.println("\n\n\n=========================================\nSOURCE " + src.getURI().toString() + "\n");
    Module rawModule = parse(src.getCharacters());

    var compilerConfig = new CompilerConfig(false, true, true, true, true, Option.empty());
    var passes = new Passes(compilerConfig, Option.empty());
    @SuppressWarnings("unchecked") var passConfig = new PassConfiguration((Seq<PassConfiguration.ConfigPair<?>>) Seq$.MODULE$.empty());
    PassManager passManager = new PassManager(passes.passOrdering(), passConfig);
    var compilerRunner = new CompilerRunner() {
      @Override
      public CompilerConfig defaultConfig() {
        return compilerConfig;
      }

      @Override
      public void org$enso$compiler$test$CompilerRunner$_setter_$defaultConfig_$eq(CompilerConfig x$1) {
      }
    };
    var moduleName = QualifiedName.simpleName(src.getName().replace(".enso", ""));
    ModuleContext moduleContext = compilerRunner.buildModuleContext(moduleName, Option.apply(new FreshNameSupply()), Option.empty(), compilerConfig, false);
    Module processedModule = passManager.runPassesOnModule(rawModule, moduleContext);
    return processedModule;
  }
}
