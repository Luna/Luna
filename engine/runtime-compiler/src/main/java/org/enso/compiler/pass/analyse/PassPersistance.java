package org.enso.compiler.pass.analyse;

import java.io.IOException;
import org.enso.compiler.core.Persistance;
import org.enso.compiler.pass.analyse.AliasAnalysis.Graph;
import org.enso.compiler.pass.resolve.DocumentationComments;
import org.enso.compiler.pass.resolve.FullyQualifiedNames;
import org.enso.compiler.pass.resolve.IgnoredBindings;
import org.enso.compiler.pass.resolve.ModuleAnnotations;
import org.enso.compiler.pass.resolve.TypeSignatures;
import org.enso.interpreter.dsl.Persistable;
import org.openide.util.lookup.ServiceProvider;
import scala.Option;

@Persistable(clazz = CachePreferenceAnalysis.WeightInfo.class, id = 1111)
@Persistable(clazz = DataflowAnalysis.DependencyInfo.class, id = 1112)
@Persistable(clazz = DataflowAnalysis.DependencyMapping.class, id = 1113)
@Persistable(clazz = GatherDiagnostics.DiagnosticsMeta.class, id = 1114)
@Persistable(clazz = DocumentationComments.Doc.class, id = 1115)
@Persistable(clazz = AliasAnalysis$Info$Occurrence.class, id = 1116)
@Persistable(clazz = TypeSignatures.Signature.class, id = 1117)
@Persistable(clazz = ModuleAnnotations.Annotations.class, id = 1118)
@Persistable(clazz = AliasAnalysis$Info$Scope$Root.class, id = 1120)
@Persistable(clazz = DataflowAnalysis$DependencyInfo$Type$Static.class, id = 1121)
@Persistable(clazz = DataflowAnalysis$DependencyInfo$Type$Dynamic.class, id = 1122)
@Persistable(clazz = AliasAnalysis$Info$Scope$Child.class, id = 1123)
@Persistable(clazz = AliasAnalysis$Graph$Occurrence$Use.class, id = 1125)
@Persistable(clazz = AliasAnalysis$Graph$Occurrence$Def.class, id = 1126)
@Persistable(clazz = AliasAnalysis$Graph$Link.class, id = 1127)
@Persistable(clazz = FullyQualifiedNames.FQNResolution.class, id = 1128)
@Persistable(clazz = FullyQualifiedNames.ResolvedLibrary.class, id = 1129)
@Persistable(clazz = FullyQualifiedNames.ResolvedModule.class, id = 1130)
public final class PassPersistance {
  private PassPersistance() {}

  @ServiceProvider(service = Persistance.class)
  public static final class PersistState extends Persistance<IgnoredBindings.State> {
    public PersistState() {
      super(IgnoredBindings.State.class, true, 1101);
    }

    @Override
    protected void writeObject(IgnoredBindings.State obj, Output out) throws IOException {
      out.writeBoolean(obj.isIgnored());
    }

    @Override
    protected IgnoredBindings.State readObject(Input in)
        throws IOException, ClassNotFoundException {
      var b = in.readBoolean();
      return b
          ? org.enso.compiler.pass.resolve.IgnoredBindings$State$Ignored$.MODULE$
          : org.enso.compiler.pass.resolve.IgnoredBindings$State$NotIgnored$.MODULE$;
    }
  }

  @ServiceProvider(service = Persistance.class)
  public static final class PersistTail extends Persistance<TailCall.TailPosition> {
    public PersistTail() {
      super(TailCall.TailPosition.class, true, 1102);
    }

    @Override
    protected void writeObject(TailCall.TailPosition obj, Output out) throws IOException {
      out.writeBoolean(obj.isTail());
    }

    @Override
    protected TailCall.TailPosition readObject(Input in)
        throws IOException, ClassNotFoundException {
      var b = in.readBoolean();
      return b
          ? org.enso.compiler.pass.analyse.TailCall$TailPosition$Tail$.MODULE$
          : org.enso.compiler.pass.analyse.TailCall$TailPosition$NotTail$.MODULE$;
    }
  }

  @org.openide.util.lookup.ServiceProvider(service = Persistance.class)
  public static final class PersistAliasAnalysisGraphScope
      extends Persistance<org.enso.compiler.pass.analyse.AliasAnalysis$Graph$Scope> {
    public PersistAliasAnalysisGraphScope() {
      super(org.enso.compiler.pass.analyse.AliasAnalysis$Graph$Scope.class, false, 1124);
    }

    @Override
    @SuppressWarnings("unchecked")
    protected org.enso.compiler.pass.analyse.AliasAnalysis$Graph$Scope readObject(Input in)
        throws IOException {
      var childScopes = in.readInline(scala.collection.immutable.List.class);
      var occurrences = (scala.collection.immutable.Set) in.readObject();
      var allDefinitions = in.readInline(scala.collection.immutable.List.class);
      var parent =
          new org.enso.compiler.pass.analyse.AliasAnalysis$Graph$Scope(
              childScopes, occurrences, allDefinitions);
      var optionParent = Option.apply(parent);
      childScopes.forall(
          (object) -> {
            var ch = (org.enso.compiler.pass.analyse.AliasAnalysis$Graph$Scope) object;
            ch.parent_$eq(optionParent);
            return null;
          });
      return parent;
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void writeObject(
        org.enso.compiler.pass.analyse.AliasAnalysis$Graph$Scope obj, Output out)
        throws IOException {
      out.writeInline(scala.collection.immutable.List.class, obj.childScopes());
      out.writeObject(obj.occurrences());
      out.writeInline(scala.collection.immutable.List.class, obj.allDefinitions());
    }
  }

  @org.openide.util.lookup.ServiceProvider(service = Persistance.class)
  public static final class PersistAliasAnalysisGraph extends Persistance<Graph> {
    public PersistAliasAnalysisGraph() {
      super(Graph.class, false, 1119);
    }

    @SuppressWarnings("unchecked")
    protected Graph readObject(Input in) throws IOException {
      var g = new Graph();

      var rootScope = (AliasAnalysis$Graph$Scope) in.readObject();
      assignParents(rootScope);
      g.rootScope_$eq(rootScope);

      var links =
          (scala.collection.immutable.Set) in.readInline(scala.collection.immutable.Set.class);
      g.links_$eq(links);
      return g;
    }

    @SuppressWarnings("unchecked")
    @Override
    protected void writeObject(Graph obj, Output out) throws IOException {
      out.writeObject(obj.rootScope());
      out.writeInline(scala.collection.immutable.Set.class, obj.links());
    }

    private static void assignParents(AliasAnalysis$Graph$Scope scope) {
      var option = Option.apply(scope);
      scope
          .childScopes()
          .foreach(
              (ch) -> {
                assignParents(ch);
                ch.parent_$eq(option);
                return null;
              });
    }
  }
}
