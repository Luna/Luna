package org.enso.runtime.parser.processor.test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

import com.google.testing.compile.CompilationSubject;
import com.google.testing.compile.Compiler;
import com.google.testing.compile.JavaFileObjects;
import java.io.IOException;
import org.enso.runtime.parser.processor.IRProcessor;
import org.junit.Test;

/**
 * Basic tests of {@link IRProcessor} that compiles snippets of annotated code, and checks the
 * generated classes. The compiler (along with the processor) is invoked in the unit tests.
 */
public class TestIRProcessorInline {
  /**
   * Compiles the code given in {@code src} with {@link IRProcessor} and returns the contents of the
   * generated java source file.
   *
   * @param name FQN of the Java source file
   * @param src
   * @return
   */
  private static String generatedClass(String name, String src) {
    var srcObject = JavaFileObjects.forSourceString(name, src);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(srcObject);
    CompilationSubject.assertThat(compilation).succeeded();
    assertThat("Generated just one source", compilation.generatedSourceFiles().size(), is(1));
    var generatedSrc = compilation.generatedSourceFiles().get(0);
    try {
      return generatedSrc.getCharContent(false).toString();
    } catch (IOException e) {
      throw new AssertionError(e);
    }
  }

  private static void expectCompilationFailure(String src) {
    var srcObject = JavaFileObjects.forSourceString("TestHello", src);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(srcObject);
    CompilationSubject.assertThat(compilation).failed();
  }

  @Test
  public void simpleIRNodeWithoutChildren_CompilationSucceeds() {
    var src =
        JavaFileObjects.forSourceString(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;
        @IRNode
        public interface JName extends IR {}
        """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).succeeded();
  }

  @Test
  public void annotatedInterfaceMustExtendIR() {
    var src =
        JavaFileObjects.forSourceString(
            "Hello",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        @IRNode
        public interface Hello {}
        """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).failed();
  }

  @Test
  public void annotatedInterfaceMustNotExtendTwoIRInterfaces() {
    var src =
        JavaFileObjects.forSourceString(
            "Hello",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;
        import org.enso.compiler.core.ir.Expression;

        @IRNode
        public interface Hello extends IR, Expression {}
        """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).failed();
    CompilationSubject.assertThat(compilation).hadErrorCount(1);
    CompilationSubject.assertThat(compilation)
        .hadErrorContaining("must extend only a single IR interface");
  }

  @Test
  public void annotationCanOnlyBeAppliedToInterface() {
    var src =
        JavaFileObjects.forSourceString(
            "Hello",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        @IRNode
        public class Hello {}
        """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).failed();
  }

  @Test
  public void childAnnotation_MustBeAppliedToIRField() {
    expectCompilationFailure(
        """
      import org.enso.runtime.parser.dsl.IRNode;
      import org.enso.runtime.parser.dsl.IRChild;
      import org.enso.compiler.core.IR;

      @IRNode
      public interface MyIR extends IR {
        @IRChild String expression();
      }
      """);
  }

  @Test
  public void simpleIRNodeWithoutChildren_GeneratesSource() {
    var src =
        JavaFileObjects.forSourceString(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;
        @IRNode
        public interface JName extends IR {}
        """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).succeeded();
    CompilationSubject.assertThat(compilation).generatedSourceFile("JNameGen").isNotNull();
    var srcSubject =
        CompilationSubject.assertThat(compilation)
            .generatedSourceFile("JNameGen")
            .contentsAsUtf8String();
    srcSubject.containsMatch("");
    var genSrc = compilation.generatedSourceFile("JNameGen");
    assertThat(genSrc.isPresent(), is(true));
    assertThat("Generated just one source", compilation.generatedSourceFiles().size(), is(1));
  }

  @Test
  public void doesNotOverrideStaticParameterlessMethod() {
    var src =
        generatedClass(
            "Hello",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;

        @IRNode
        public interface Hello extends IR {
          static String name() {
            return "Hello";
          }
        }
        """);
    assertThat(src, not(containsString("\"Hello\"")));
  }

  @Test
  public void simpleIRNodeWithChild() {
    var genSrc =
        generatedClass(
            "MyIR",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;
        import org.enso.compiler.core.ir.Expression;

        @IRNode
        public interface MyIR extends IR {
          @IRChild Expression expression();
        }
        """);
    assertThat(genSrc, containsString("Expression expression()"));
  }

  @Test
  public void irNodeWithMultipleFields_PrimitiveField() {
    var genSrc =
        generatedClass(
            "MyIR",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;

        @IRNode
        public interface MyIR extends IR {
          boolean suspended();
        }
        """);
    assertThat(genSrc, containsString("boolean suspended()"));
  }

  @Test
  public void irNodeWithInheritedField() {
    var src =
        generatedClass(
            "MyIR",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;

        interface MySuperIR extends IR {
          boolean suspended();
        }

        @IRNode
        public interface MyIR extends MySuperIR {
        }

        """);
    assertThat(src, containsString("boolean suspended()"));
  }

  @Test
  public void irNodeWithInheritedField_Override() {
    var src =
        generatedClass(
            "MyIR",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;

        interface MySuperIR extends IR {
          boolean suspended();
        }

        @IRNode
        public interface MyIR extends MySuperIR {
          boolean suspended();
        }

        """);
    assertThat(src, containsString("boolean suspended()"));
  }

  @Test
  public void irNodeWithInheritedField_Transitive() {
    var src =
        generatedClass(
            "MyIR",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;

        interface MySuperSuperIR extends IR {
          boolean suspended();
        }

        interface MySuperIR extends MySuperSuperIR {
        }

        @IRNode
        public interface MyIR extends MySuperIR {
        }
        """);
    assertThat(src, containsString("boolean suspended()"));
  }

  @Test
  public void irNodeAsNestedInterface() {
    var src =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;

        @IRNode
        public interface JName extends IR {
          String name();

          interface JBlank extends JName {}
        }
        """);
    assertThat(src, containsString("public final class JNameGen"));
    assertThat(src, containsString("public static final class JBlankGen implements JName.JBlank"));
  }

  @Test
  public void returnValueCanBeScalaList() {
    var src =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;
        import scala.collection.immutable.List;

        @IRNode
        public interface JName extends IR {
          @IRChild
          List<IR> expressions();
        }
        """);
    assertThat(src, containsString("public final class JNameGen"));
    assertThat(src, containsString("List<IR> expressions"));
  }

  @Test
  public void processorDoesNotGenerateOverridenMethods() {
    var src =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;

        @IRNode
        public interface JName extends IR {
          String name();

          interface JQualified extends JName {
            @Override
            default String name() {
              return null;
            }
          }
        }
        """);
    assertThat(src, containsString("public final class JNameGen"));
    assertThat(src, not(containsString("String name()")));
  }

  @Test
  public void overrideCorrectMethods() {
    var src =
        generatedClass(
            "JExpression",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;

        @IRNode
        public interface JExpression extends IR {

          interface JBlock extends JExpression {
            boolean suspended();
          }

          interface JBinding extends JExpression {
            String name();
          }
        }
        """);
    assertThat(src, containsString("class JBlockGen"));
    assertThat(src, containsString("class JBindingGen"));
  }

  @Test
  public void canOverrideMethodsFromIR() {
    var src =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;

        @IRNode
        public interface JName extends IR {
          @Override
          JName duplicate(boolean keepLocations, boolean keepMetadata, boolean keepDiagnostics, boolean keepIdentifiers);

          interface JSelf extends JName {}
        }
        """);
    assertThat(src, containsString("JName duplicate"));
    assertThat(src, containsString("JSelfGen"));
  }

  @Test
  public void canDefineCopyMethod_WithUserDefinedField() {
    var genSrc =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRCopyMethod;
        import org.enso.compiler.core.IR;

        @IRNode
        public interface JName extends IR {
          String nameField();

          @IRCopyMethod
          JName copy(String nameField);
        }
        """);
    assertThat(genSrc, containsString("JName copy(String nameField"));
  }

  @Test
  public void canDefineCopyMethod_WithMetaField() {
    var genSrc =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRCopyMethod;
        import org.enso.compiler.core.IR;
        import org.enso.compiler.core.ir.MetadataStorage;

        @IRNode
        public interface JName extends IR {
          String nameField();

          @IRCopyMethod
          JName copy(MetadataStorage passData);
        }
        """);
    assertThat(genSrc, containsString("JName copy(MetadataStorage"));
  }

  @Test
  public void canDefineMultipleCopyMethods() {
    var genSrc =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRCopyMethod;
        import org.enso.compiler.core.IR;
        import org.enso.compiler.core.ir.MetadataStorage;

        @IRNode
        public interface JName extends IR {
          String nameField();

          @IRCopyMethod
          JName copy(MetadataStorage passData);

          @IRCopyMethod
          JName copy(String nameField);
        }
        """);
    assertThat(genSrc, containsString("JName copy(MetadataStorage"));
    assertThat(genSrc, containsString("JName copy(String"));
  }

  @Test
  public void copyMethod_WithArbitraryArgumentOrder() {
    var genSrc =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRCopyMethod;
        import org.enso.compiler.core.IR;
        import org.enso.compiler.core.ir.MetadataStorage;
        import org.enso.compiler.core.ir.DiagnosticStorage;

        @IRNode
        public interface JName extends IR {
          String nameField();

          @IRCopyMethod
          JName copy(String nameField, MetadataStorage passData, DiagnosticStorage diagnostics);
        }
        """);
    assertThat(genSrc, containsString("JName copy("));
  }

  @Test
  public void copyMethod_MustContainValidFieldsAsParameters_1() {
    expectCompilationFailure(
        """
      import org.enso.runtime.parser.dsl.IRNode;
      import org.enso.runtime.parser.dsl.IRCopyMethod;
      import org.enso.compiler.core.IR;
      import org.enso.compiler.core.ir.MetadataStorage;
      import org.enso.compiler.core.ir.DiagnosticStorage;

      @IRNode
      public interface JName extends IR {
        String nameField();

        @IRCopyMethod
        JName copy(String NON_EXISTING_FIELD_NAME);
      }
      """);
  }

  @Test
  public void copyMethod_MustContainValidFieldsAsParameters_2() {
    expectCompilationFailure(
        """
      import org.enso.runtime.parser.dsl.IRNode;
      import org.enso.runtime.parser.dsl.IRCopyMethod;
      import org.enso.compiler.core.IR;
      import org.enso.compiler.core.ir.MetadataStorage;
      import org.enso.compiler.core.ir.DiagnosticStorage;

      @IRNode
      public interface JName extends IR {
        String nameField();

        @IRCopyMethod
        JName copy(String nameField, String ANOTHER_NON_EXISTING);
      }
      """);
  }

  @Test
  public void copyMethod_WithMoreFieldsOfSameType() {
    var genSrc =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.runtime.parser.dsl.IRCopyMethod;
        import org.enso.compiler.core.IR;
        import org.enso.compiler.core.ir.MetadataStorage;
        import org.enso.compiler.core.ir.DiagnosticStorage;

        @IRNode
        public interface JName extends IR {
          String nameField_1();
          String nameField_2();

          @IRCopyMethod
          JName copy(String nameField_1, String nameField_2);
        }
        """);
    assertThat(genSrc, containsString("JName copy("));
  }

  @Test
  public void mapExpressions_CanOverride() {
    var genSrc =
        generatedClass(
            "JExpression",
            """
        import org.enso.runtime.parser.dsl.IRNode;
        import org.enso.compiler.core.IR;
        import org.enso.compiler.core.ir.Expression;
        import java.util.function.Function;

        @IRNode
        public interface JExpression extends IR {

          @Override
          JExpression mapExpressions(Function<Expression, Expression> fn);
        }
        """);
    assertThat(genSrc, containsString("JExpression mapExpressions("));
  }
}
