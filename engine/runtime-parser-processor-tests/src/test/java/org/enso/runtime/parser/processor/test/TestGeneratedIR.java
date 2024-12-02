package org.enso.runtime.parser.processor.test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.Assert.fail;

import java.util.List;
import org.enso.compiler.core.ir.DiagnosticStorage;
import org.enso.compiler.core.ir.IdentifiedLocation;
import org.enso.compiler.core.ir.Location;
import org.enso.runtime.parser.processor.test.gen.ir.CopyNameTestIRGen;
import org.enso.runtime.parser.processor.test.gen.ir.ListTestIR;
import org.enso.runtime.parser.processor.test.gen.ir.ListTestIRGen;
import org.enso.runtime.parser.processor.test.gen.ir.NameTestIR;
import org.enso.runtime.parser.processor.test.gen.ir.NameTestIRGen;
import org.enso.runtime.parser.processor.test.gen.ir.OptNameTestIRGen;
import org.junit.Test;
import scala.Option$;

public class TestGeneratedIR {
  @Test
  public void generatedCodeHasBuilder() {
    NameTestIR myIr = NameTestIRGen.builder().name("name").build();
    assertThat(myIr.name(), is("name"));
  }

  @Test
  public void myIRHasNoChildren() {
    NameTestIR myIr = NameTestIRGen.builder().name("name").build();
    assertThat(myIr.children().isEmpty(), is(true));
  }

  @Test
  public void nonChildFieldIsNotNullable() {
    var bldr = NameTestIRGen.builder();
    try {
      bldr.build();
      fail("Expected exception - name field must be specified in the builder");
    } catch (Exception e) {
      assertThat(e, is(notNullValue()));
    }
  }

  @Test
  public void canDuplicate() {
    NameTestIR myIr = NameTestIRGen.builder().name("name").build();
    var duplicated = myIr.duplicate(true, true, true, true);
    assertThat("duplicate returns same type", duplicated, instanceOf(NameTestIR.class));
    assertThat("name was correctly duplicated", ((NameTestIR) duplicated).name(), is("name"));
  }

  @Test
  public void generatedBuilderCanSetMetadata() {
    var diagnostics = DiagnosticStorage.empty();
    var nameIR = NameTestIRGen.builder().name("name").diagnostics(diagnostics).build();
    assertThat(nameIR.diagnostics(), is(diagnostics));
  }

  @Test
  public void canCreateList() {
    var firstName = NameTestIRGen.builder().name("first_name").build();
    var secondName = NameTestIRGen.builder().name("second_name").build();
    scala.collection.immutable.List<NameTestIR> names = asScala(List.of(firstName, secondName));
    var listIr = ListTestIRGen.builder().names(names).build();
    assertThat(listIr.names().size(), is(2));
  }

  @Test
  public void canGetListAsChildren() {
    var firstName = NameTestIRGen.builder().name("first_name").build();
    var secondName = NameTestIRGen.builder().name("second_name").build();
    scala.collection.immutable.List<NameTestIR> names = asScala(List.of(firstName, secondName));
    var listIr = ListTestIRGen.builder().names(names).build();
    assertThat(listIr.children().size(), is(2));
    assertThat(listIr.children().head(), instanceOf(NameTestIR.class));
  }

  @Test
  public void canDuplicateListTestIR() {
    var firstName = NameTestIRGen.builder().name("first_name").build();
    var secondName = NameTestIRGen.builder().name("second_name").build();
    scala.collection.immutable.List<NameTestIR> names = asScala(List.of(firstName, secondName));
    var listIr = ListTestIRGen.builder().names(names).build();
    var duplicated = listIr.duplicate(true, true, true, true);
    assertThat(duplicated, instanceOf(ListTestIR.class));
    assertThat(duplicated.children().size(), is(2));
  }

  @Test
  public void optChildIsNotRequired() {
    var optNameTestIR = OptNameTestIRGen.builder().build();
    assertThat(optNameTestIR, is(notNullValue()));
    assertThat(optNameTestIR.originalName(), is(nullValue()));
  }

  @Test
  public void duplicateRespectsParameters() {
    var location = new IdentifiedLocation(new Location(1, 2));
    var diagnostics = DiagnosticStorage.empty();
    var nameIR =
        NameTestIRGen.builder().name("name").location(location).diagnostics(diagnostics).build();
    var duplicated = nameIR.duplicate(true, false, false, false);
    assertThat("Should have copied location meta", duplicated.location().isDefined(), is(true));
    assertThat("Should have not copied diagnostics", duplicated.diagnostics(), is(nullValue()));

    var duplicated_2 = nameIR.duplicate(false, false, true, false);
    assertThat(
        "Should have not copied location meta", duplicated_2.location().isDefined(), is(false));
    assertThat("Should have copied diagnostics", duplicated_2.diagnostics(), is(notNullValue()));
  }

  @Test
  public void copyMethod() {
    var diagnostics = DiagnosticStorage.empty();
    var nameIR = NameTestIRGen.builder().name("name").build();
    var copyNameIR = CopyNameTestIRGen.builder().diagnostics(diagnostics).name(nameIR).build();
    var otherNameIR = NameTestIRGen.builder().name("other_name").build();
    var copied = copyNameIR.copy(otherNameIR);
    assertThat(copied.name().name(), is("other_name"));
    assertThat("Diagnostics should have been copied", copied.diagnostics(), is(diagnostics));
  }

  private static <T> scala.collection.immutable.List<T> asScala(List<T> list) {
    return scala.jdk.javaapi.CollectionConverters.asScala(list).toList();
  }
}
