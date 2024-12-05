package org.enso.runtime.parser.processor.test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

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
  public void simpleIRNodeWithoutFields_CompilationSucceeds() {
    var src =
        JavaFileObjects.forSourceString(
            "JName",
            """
        import org.enso.runtime.parser.dsl.GenerateIR;
        import org.enso.runtime.parser.dsl.GenerateFields;

        @GenerateIR
        public final class JName {
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
  public void annotatedClassMustHaveAnnotatedConstructor() {
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
  public void simpleIRNodeWithUserDefinedFiled_CompilationSucceeds() {
    var src =
        """
        import org.enso.runtime.parser.dsl.GenerateIR;

        @GenerateIR
        public final class JName {
          public JName(String name) {}
        }
        """;
    var genClass = generatedClass("JName", src);
    assertThat(genClass, containsString("class JNameGen"));
    assertThat("Getter for 'name' generated", genClass, containsString("String name()"));
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
        public final class MyIR {
          @GenerateFields
          public MyIR(@IRChild Expression expression) {}
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

        @GenerateIR
        public final class MyIR {
          @GenerateFields
          public MyIR(boolean suspended) {}
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
        public final class MyIR {
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
        import org.enso.compiler.core.IR;

        interface MySuperIR extends IR {
          boolean suspended();
        }

        @GenerateIR(interfaces = "MySuperIR")
        public final class MyIR {
          @GenerateFields
          public MyIR() {}
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
        public final class MyIR {
          @GenerateFields
          public MyIR(@IRField boolean suspended) {}
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
        public final class MyIR {
          @GenerateFields
          public MyIR(@IRField boolean suspended) {}
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
        import org.enso.compiler.core.IR;

        public interface JName extends IR {
          String name();

          @GenerateIR(interfaces = "JName")
          public final class JBlank {
            @GenerateFields
            public JBlank(@IRField String name) {}
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
        import org.enso.runtime.parser.dsl.IRChild;
        import org.enso.compiler.core.IR;
        import scala.collection.immutable.List;

        @GenerateIR
        public final class JName {
          public JName(@IRChild List<IR> expressions) {}
        }
        """);
    assertThat(src, containsString("class JNameGen"));
    assertThat(src, containsString("List<IR> expressions"));
  }

  // TODO: Can contain multiple GenerateIR annotations in single source

  // TODO: Multiple interfaces in the annotation
}
