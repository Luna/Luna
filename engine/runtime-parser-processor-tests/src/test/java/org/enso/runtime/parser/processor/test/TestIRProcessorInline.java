package org.enso.runtime.parser.processor.test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

import com.google.testing.compile.Compilation;
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

  private static Compilation compile(String name, String src) {
    var srcObject = JavaFileObjects.forSourceString(name, src);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(srcObject);
    return compilation;
  }

  @Test
  public void simpleIRNodeWithoutFields_CompilationSucceeds() {
    var src =
        JavaFileObjects.forSourceString(
            "JName",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName() {}
        }
        """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).succeeded();
  }

  @Test
  public void onlyFinalClassCanBeAnnotated() {
    var src =
        JavaFileObjects.forSourceString(
            "JName",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        @GenerateIR
        public class JName {}
        """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).failed();
    CompilationSubject.assertThat(compilation).hadErrorCount(1);
    CompilationSubject.assertThat(compilation).hadErrorContaining("final");
  }

  @Test
  public void annotatedClass_MustHaveAnnotatedConstructor() {
    var src =
        JavaFileObjects.forSourceString(
            "JName",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        @GenerateIR
        public final class JName {}
        """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).failed();
    CompilationSubject.assertThat(compilation)
        .hadErrorContaining("must have exactly one constructor annotated with @GenerateFields");
  }

  @Test
  public void annotatedClass_MustExtendGeneratedSuperclass() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName {
          @GenerateFields
          public JName() {}
        }
        """;
    var compilation = compile("JName", src);
    CompilationSubject.assertThat(compilation).failed();
    CompilationSubject.assertThat(compilation).hadErrorContaining("must extend");
  }

  @Test
  public void simpleIRNodeWithUserDefinedFiled_CompilationSucceeds() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRField;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName(@IRField String name) {
            super(name);
          }
        }
        """;
    var genClass = generatedClass("JName", src);
    assertThat(genClass, containsString("class JNameGen"));
    assertThat("Getter for 'name' generated", genClass, containsString("String name()"));
  }

  @Test
  public void generatedClassHasProtectedConstructor() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName() {}
        }
        """;
    var genClass = generatedClass("JName", src);
    assertThat(genClass, containsString("class JNameGen"));
    assertThat(
        "Generate class has protected constructor", genClass, containsString("protected JNameGen"));
  }

  /** The default generated protected constructor has meta parameters */
  @Test
  public void generatedClassHasConstructor_WithMetaFields() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName() {}
        }
        """;
    var genClass = generatedClass("JName", src);
    assertThat(genClass, containsString("class JNameGen"));
    assertThat(
        "Generate class has protected constructor with meta parameters",
        genClass,
        containsString(
            "protected JNameGen(DiagnosticStorage diagnostics, MetadataStorage passData,"
                + " IdentifiedLocation location, UUID id)"));
  }

  /**
   * The second generated protected constructor has user fields as parameters. In this case, it will
   * be an empty constructor.
   */
  @Test
  public void generatedClassHasConstructor_WithUserFields() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName() {}
        }
        """;
    var genClass = generatedClass("JName", src);
    assertThat(genClass, containsString("class JNameGen"));
    assertThat(
        "Generate class has protected constructor with user fields as parameters",
        genClass,
        containsString("protected JNameGen()"));
  }

  @Test
  public void generatedClass_IsAbstract() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName() {}
        }
        """;
    var genClass = generatedClass("JName", src);
    assertThat(genClass, containsString("abstract class JNameGen"));
  }

  @Test
  public void generatedMethod_setLocation_returnsSubClassType() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName() {}
        }
        """;
    var genClass = generatedClass("JName", src);
    assertThat(genClass, containsString("JName setLocation("));
  }

  @Test
  public void annotatedConstructor_MustNotHaveUnannotatedParameters() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName(int param) {}
        }
        """;
    var compilation = compile("JName", src);
    CompilationSubject.assertThat(compilation).failed();
    CompilationSubject.assertThat(compilation).hadErrorContaining("must be annotated");
  }

  @Test
  public void annotatedConstructor_CanHaveMetaParameters() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.compiler.core.ir.MetadataStorage;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName(MetadataStorage passData) {
            super();
          }
        }
        """;
    var compilation = compile("JName", src);
    CompilationSubject.assertThat(compilation).succeeded();
  }

  @Test
  public void simpleIRNodeWithChild() {
    var genSrc =
        generatedClass(
            "MyIR",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.ir.Expression;

        @GenerateIR
        public final class MyIR extends MyIRGen {
          @GenerateFields
          public MyIR(@IRChild Expression expression) {
            super(expression);
          }
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
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.runtime.parser.dsl.IRField;

        @GenerateIR
        public final class MyIR extends MyIRGen {
          @GenerateFields
          public MyIR(@IRField boolean suspended) {
            super(suspended);
          }
        }
        """);
    assertThat(genSrc, containsString("boolean suspended()"));
  }

  @Test
  public void interfacesMustBeSubtypeOfIR() {
    var src =
        JavaFileObjects.forSourceString(
            "MyIR",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        interface MySuperIR {
          boolean suspended();
        }

        @GenerateIR(interfaces = "MySuperIR")
        public final class MyIR extends MyIRGen {
          @GenerateFields
          public MyIR() {}
        }
  """);
    var compiler = Compiler.javac().withProcessors(new IRProcessor());
    var compilation = compiler.compile(src);
    CompilationSubject.assertThat(compilation).failed();
    CompilationSubject.assertThat(compilation).hadErrorContaining("subtype");
  }

  @Test
  public void irNodeWithInheritedField() {
    var src =
        generatedClass(
            "MyIR",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRField;
        import org.enso.compiler.core.IR;

        interface MySuperIR extends IR {
          boolean suspended();
        }

        @GenerateIR(interfaces = "MySuperIR")
        public final class MyIR extends MyIRGen {
          @GenerateFields
          public MyIR(@IRField boolean suspended) {
            super(suspended);
          }
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
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRField;
        import org.enso.compiler.core.IR;

        interface MySuperIR extends IR {
          boolean suspended();
        }

        @GenerateIR
        public final class MyIR extends MyIRGen {
          @GenerateFields
          public MyIR(@IRField boolean suspended) {
            super(suspended);
          }
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
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRField;
        import org.enso.compiler.core.IR;

        interface MySuperSuperIR extends IR {
          boolean suspended();
        }

        interface MySuperIR extends MySuperSuperIR {
        }

        @GenerateIR(interfaces = "MySuperIR")
        public final class MyIR extends MyIRGen {
          @GenerateFields
          public MyIR(@IRField boolean suspended) {
            super(suspended);
          }
        }
        """);
    assertThat(src, containsString("boolean suspended()"));
  }

  @Test
  public void irNodeAsNestedClass() {
    var src =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRField;
        import org.enso.compiler.core.IR;

        public interface JName extends IR {
          String name();

          @GenerateIR(interfaces = "JName")
          public final class JBlank extends JBlankGen {
            @GenerateFields
            public JBlank(@IRField String name) {
              super(name);
            }
          }
        }
        """);
    assertThat(src, containsString("class JBlankGen implements JName"));
    assertThat(src, containsString("String name()"));
  }

  @Test
  public void fieldCanBeScalaList() {
    var src =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;
        import scala.collection.immutable.List;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName(@IRChild List<IR> expressions) {
            super(expressions);
          }
        }
        """);
    assertThat(src, containsString("class JNameGen"));
    assertThat(src, containsString("List<IR> expressions"));
  }

  @Test
  public void fieldCanBeScalaOption() {
    var src =
        generatedClass(
            "JName",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;
        import scala.Option;

        @GenerateIR
        public final class JName extends JNameGen {
          @GenerateFields
          public JName(@IRChild Option<IR> expression) {
            super(expression);
          }
        }
        """);
    assertThat(src, containsString("class JNameGen"));
    assertThat("has getter method for expression", src, containsString("Option<IR> expression()"));
  }

  // TODO: Can contain multiple GenerateIR annotations in single source

  // TODO: Multiple interfaces in the annotation
}
