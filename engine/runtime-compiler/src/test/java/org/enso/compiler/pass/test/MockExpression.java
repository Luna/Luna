package org.enso.compiler.pass.test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.enso.compiler.core.IR;
import org.enso.compiler.core.Identifier;
import org.enso.compiler.core.ir.DiagnosticStorage;
import org.enso.compiler.core.ir.Expression;
import org.enso.compiler.core.ir.IdentifiedLocation;
import org.enso.compiler.core.ir.MetadataStorage;
import scala.Option;
import scala.PartialFunction;
import scala.jdk.javaapi.CollectionConverters;

final class MockExpression implements Expression {
  private boolean isTransformed;
  private boolean isPrepared;
  private final boolean hasParent;
  private List<MockExpression> exprChildren = new ArrayList<>();

  MockExpression(boolean hasParent) {
    this.hasParent = hasParent;
  }

  boolean isTransformed() {
    return isTransformed;
  }

  void setTransformed(boolean transformed) {
    this.isTransformed = transformed;
  }

  boolean hasParent() {
    return hasParent;
  }

  void addChild(MockExpression child) {
    exprChildren.add(child);
  }

  boolean isPrepared() {
    return isPrepared;
  }

  void setPrepared(boolean prepared) {
    this.isPrepared = prepared;
  }

  @Override
  public Expression transformExpressions(PartialFunction<Expression, Expression> fn) {
    return this;
  }

  @Override
  public Expression mapExpressions(Function<Expression, Expression> fn) {
    for (var child : exprChildren) {
      fn.apply(child);
    }
    return this;
  }

  @Override
  public scala.collection.immutable.List<IR> children() {
    var lst = CollectionConverters.asScala(exprChildren).toList();
    var ret = lst.map(item -> (IR) item);
    return ret;
  }

  @Override
  public @Identifier UUID getId() {
    return null;
  }

  @Override
  public DiagnosticStorage diagnostics() {
    return null;
  }

  @Override
  public DiagnosticStorage getDiagnostics() {
    return null;
  }

  @Override
  public MetadataStorage passData() {
    return null;
  }

  @Override
  public IdentifiedLocation identifiedLocation() {
    return null;
  }

  @Override
  public Expression setLocation(Option<IdentifiedLocation> location) {
    throw new UnsupportedOperationException("unimplemented");
  }

  @Override
  public Expression duplicate(
      boolean keepLocations,
      boolean keepMetadata,
      boolean keepDiagnostics,
      boolean keepIdentifiers) {
    throw new UnsupportedOperationException("unimplemented");
  }

  @Override
  public String showCode(int indent) {
    throw new UnsupportedOperationException("unimplemented");
  }
}
