package org.enso.compiler.pass.analyse.alias.graph

import org.enso.compiler.core.CompilerError
import org.enso.compiler.debug.Debug
import org.enso.compiler.pass.analyse.alias.graph.Graph.Scope

import scala.collection.immutable.HashMap
import scala.collection.mutable
import scala.reflect.ClassTag

/** A graph containing aliasing information for a given root scope in Enso. */
sealed class Graph(
  val rootScope: Graph.Scope         = new Graph.Scope(),
  private var _nextIdCounter: Int    = 0,
  private var links: Set[Graph.Link] = Set()
) extends Serializable {
  private var sourceLinks: Map[Graph.Id, Set[Graph.Link]] = new HashMap()
  private var targetLinks: Map[Graph.Id, Set[Graph.Link]] = new HashMap()
  private var frozen: Boolean                             = false

  {
    links.foreach(addSourceTargetLink)
  }

  private var globalSymbols: Map[Graph.Symbol, GraphOccurrence.Global] =
    Map()

  /** @return the next counter value
    */
  def nextIdCounter: Int = _nextIdCounter

  /** @return a deep structural copy of `this` */
  def deepCopy(
    scope_mapping: mutable.Map[Scope, Scope] = mutable.Map()
  ): Graph = {
    val copy = new Graph(
      this.rootScope.deepCopy(scope_mapping),
      this.nextIdCounter
    )
    copy.links         = this.links
    copy.sourceLinks   = this.sourceLinks
    copy.targetLinks   = this.targetLinks
    copy.globalSymbols = this.globalSymbols
    copy
  }

  def getLinks(): Set[Graph.Link] = links

  def freeze(): Unit = {
    frozen = true
  }

  /** Registers a requested global symbol in the aliasing scope.
    *
    * @param sym the symbol occurrence
    */
  def addGlobalSymbol(sym: GraphOccurrence.Global): Unit = {
    assert(!frozen)
    if (!globalSymbols.contains(sym.symbol)) {
      globalSymbols = globalSymbols + (sym.symbol -> sym)
    }
  }

  /** Creates a deep copy of the aliasing graph structure.
    *
    * @return a copy of the graph structure
    */
  def copy: Graph = {
    val graph = new Graph(
      rootScope.deepCopy(mutable.Map()),
      nextIdCounter
    )
    graph.links       = links
    graph.sourceLinks = sourceLinks
    graph.targetLinks = targetLinks

    graph
  }

  /** Determines whether `this` is equal to `obj`.
    *
    * @param obj the object to compare against.
    * @return `true` if `this == obj`, otherwise `false`
    */
  override def equals(obj: Any): Boolean =
    obj match {
      case that: Graph =>
        (this.links == that.links) && (this.rootScope == that.rootScope)
      case _ => false
    }

  /** Generates a new identifier for a node in the graph.
    *
    * @return a unique identifier for this graph
    */
  def nextId(): Graph.Id = {
    val nextId = _nextIdCounter
    _nextIdCounter += 1
    nextId
  }

  /** Resolves any links for the given usage of a symbol, assuming the symbol
    * is a local variable.
    *
    * @param occurrence the symbol usage
    * @return the link, if it exists
    */
  def resolveLocalUsage(
    occurrence: GraphOccurrence.Use
  ): Option[Graph.Link] = {
    scopeFor(occurrence.id).flatMap(_.resolveUsage(occurrence).map { link =>
      addSourceTargetLink(link)
      links += link
      link
    })
  }

  private def addSourceTargetLink(link: Graph.Link): Unit = {
    assert(!frozen)
    sourceLinks = sourceLinks.updatedWith(link.source)(v =>
      v.map(s => s + link).orElse(Some(Set(link)))
    )
    targetLinks = targetLinks.updatedWith(link.target)(v =>
      v.map(s => s + link).orElse(Some(Set(link)))
    )
  }

  /** Resolves any links for the given usage of a symbol, assuming the symbol
    * is global (i.e. method, constructor etc.)
    *
    * @param occurrence the symbol usage
    * @return the link, if it exists
    */
  def resolveGlobalUsage(
    occurrence: GraphOccurrence.Use
  ): Option[Graph.Link] = {
    scopeFor(occurrence.id) match {
      case Some(scope) =>
        globalSymbols
          .get(occurrence.symbol)
          .map(g => Graph.Link(occurrence.id, scope.scopesToRoot + 1, g.id))
      case None => None
    }
  }

  /** Returns a string representation of the graph.
    *
    * @return a string representation of `this`
    */
  override def toString: String =
    s"Graph(links = $links, rootScope = $rootScope)"

  /** Pretty prints the graph.
    *
    * @return a pretty-printed string representation of the graph
    */
  def pprint: String = {
    val original = toString
    Debug.pretty(original)
  }

  /** Gets all links in which the provided `id` is a participant.
    *
    * @param id the identifier for the symbol
    * @return a list of links in which `id` occurs
    */
  def linksFor(id: Graph.Id): Set[Graph.Link] = {
    sourceLinks.getOrElse(id, Set.empty[Graph.Link]) ++ targetLinks.getOrElse(
      id,
      Set()
    )
  }

  /** Finds all links in the graph where `symbol` appears in the role
    * specified by `T`.
    *
    * @param symbol the symbol to find links for
    * @tparam T the role in which `symbol` should occur
    * @return a set of all links in which `symbol` occurs with role `T`
    */
  def linksFor[T <: GraphOccurrence: ClassTag](
    symbol: Graph.Symbol
  ): Set[Graph.Link] = {
    val idsForSym = rootScope.symbolToIds[T](symbol)

    links.filter(l =>
      idsForSym.contains(l.source) || idsForSym.contains(l.target)
    )
  }

  /** Obtains the occurrence for a given ID, from whichever scope in which it
    * occurs.
    *
    * @param id the occurrence identifier
    * @return the occurrence for `id`, if it exists
    */
  def getOccurrence(id: Graph.Id): Option[GraphOccurrence] =
    scopeFor(id).flatMap(_.getOccurrence(id))

  /** Gets the link from an id to the definition of the symbol it represents.
    *
    * @param id the identifier to find the definition link for
    * @return the definition link for `id` if it exists
    */
  def defLinkFor(id: Graph.Id): Option[Graph.Link] = {
    linksFor(id).find { edge =>
      val occ = getOccurrence(edge.target)
      occ match {
        case Some(GraphOccurrence.Def(_, _, _, _, _)) => true
        case _                                        => false
      }
    }
  }

  /** Gets the scope where a given ID is defined in the graph.
    *
    * @param id the id to find the scope for
    * @return the scope where `id` occurs
    */
  def scopeFor(id: Graph.Id): Option[Graph.Scope] = {
    rootScope.scopeFor(id)
  }

  /** Finds the scopes in which a name occurs with a given role.
    *
    * @param symbol the symbol
    * @tparam T the role in which `symbol` occurs
    * @return all the scopes where `symbol` occurs with role `T`
    */
  def scopesFor[T <: GraphOccurrence: ClassTag](
    symbol: Graph.Symbol
  ): List[Graph.Scope] = {
    rootScope.scopesForSymbol[T](symbol)
  }

  /** Counts the number of scopes in this scope.
    *
    * @return the number of scopes that are either this scope or children of
    *         it
    */
  def numScopes: Int = {
    rootScope.scopeCount
  }

  /** Determines the maximum nesting depth of scopes through this scope.
    *
    * @return the maximum nesting depth of scopes through this scope.
    */
  def nesting: Int = {
    rootScope.maxNesting
  }

  /** Determines if the provided ID is capable of shadowing other bindings
    *
    * @param id the occurrence identifier
    * @return `true` if `id` shadows other bindings, otherwise `false`
    */
  def canShadow(id: Graph.Id): Boolean = {
    scopeFor(id)
      .flatMap(
        _.getOccurrence(id).flatMap {
          case d: GraphOccurrence.Def => Some(d)
          case _                      => None
        }
      )
      .isDefined
  }

  /** Computes the bindings that are shadowed by the binding with the provided
    * `definition`.
    *
    * Please note that just because [[canShadow]] states that an identifier is
    * _capable_ of shadowing, that does not mean that it is necessarily known
    * to do so.
    *
    * @param definition the definition to find the 'shadowees' of
    * @return the bindings shadowed by `definition`
    */
  def knownShadowedDefinitions(
    definition: GraphOccurrence
  ): Set[GraphOccurrence] = {
    def getShadowedIds(
      scope: Graph.Scope
    ): Set[GraphOccurrence] = {
      scope.occurrences.values.collect {
        case d: GraphOccurrence.Def if d.symbol == definition.symbol    => d
        case g: GraphOccurrence.Global if g.symbol == definition.symbol => g
      } ++ scope.parent.map(getShadowedIds).getOrElse(Set())
    }.toSet

    definition match {
      case d: GraphOccurrence.Def =>
        scopeFor(d.id).flatMap(_.parent) match {
          case Some(scope) => getShadowedIds(scope) // + globals
          case None        => Set()
        }
      case _: GraphOccurrence.Global => Set()
      case _: GraphOccurrence.Use    => Set()
    }
  }

  /** Determines if the provided id is linked to a binding that shadows
    * another binding.
    *
    * @param id the identifier to check
    * @return `true` if the definition of the symbol for `id` shadows another
    *        binding for the same symbol, `false`, otherwise
    */
  def linkedToShadowingBinding(id: Graph.Id): Boolean = {
    defLinkFor(id).isDefined
  }

  /** Gets all symbols defined in the graph.
    *
    * @return the set of symbols defined in this graph
    */
  def symbols: Set[Graph.Symbol] = {
    rootScope.symbols
  }

  /** Goes from a symbol to all identifiers that relate to that symbol in
    * the role specified by `T`.
    *
    * @param symbol the symbol to find identifiers for
    * @tparam T the role in which `symbol` should occur
    * @return a list of identifiers for that symbol
    */
  def symbolToIds[T <: GraphOccurrence: ClassTag](
    symbol: Graph.Symbol
  ): List[Graph.Id] = {
    rootScope.symbolToIds[T](symbol)
  }

  /** Goes from an identifier to the associated symbol.
    *
    * @param id the identifier of an occurrence
    * @return the symbol associated with `id`, if it exists
    */
  def idToSymbol(
    id: Graph.Id
  ): Option[Graph.Symbol] = {
    rootScope.idToSymbol(id)
  }
}
object Graph {

  /** The type of symbols on the graph. */
  type Symbol = String

  /** The type of identifiers on the graph. */
  type Id = Int

  /** A representation of a local scope in Enso.
    *
    * @param childScopes all scopes that are _direct_ children of `this`
    * @param occurrences all symbol occurrences in `this` scope indexed by the identifier of the name
    * @param allDefinitions all definitions in this scope, including synthetic ones.
    *                       Note that there may not be a link for all these definitions.
    */
  sealed class Scope(
    var childScopes: List[Scope]                  = List(),
    var occurrences: Map[Id, GraphOccurrence]     = HashMap(),
    var allDefinitions: List[GraphOccurrence.Def] = List()
  ) extends Serializable {

    var parent: Option[Scope] = None

    /** Counts the number of scopes from this scope to the root.
      *
      * This count includes the root scope, but not the current scope.
      *
      * @return the number of scopes from this scope to the root
      */
    def scopesToRoot: Int = {
      parent.flatMap(scope => Some(scope.scopesToRoot + 1)).getOrElse(0)
    }

    /** Sets the parent of the scope.
      *
      * The parent scope must not be redefined.
      *
      * @return this scope with parent scope set
      */
    def withParent(parentScope: Scope): this.type = {
      assert(parent.isEmpty)
      this.parent = Some(parentScope)
      this
    }

    /** Creates a structural copy of this scope, ensuring that replicated
      * scopes are memoised.
      *
      * @return a copy of `this`
      */
    def deepCopy(
      mapping: mutable.Map[Scope, Scope] = mutable.Map()
    ): Scope = {
      mapping.get(this) match {
        case Some(newCorrespondingScope) => newCorrespondingScope
        case None =>
          val childScopeCopies: mutable.ListBuffer[Scope] =
            mutable.ListBuffer()
          this.childScopes.foreach(scope =>
            childScopeCopies += scope.deepCopy(mapping)
          )
          val newScope =
            new Scope(childScopeCopies.toList, occurrences, allDefinitions)
          mapping.put(this, newScope)
          newScope
      }
    }

    /** Checks whether `this` is equal to `obj`.
      *
      * @param obj the object to compare `this` against
      * @return `true` if `this == obj`, otherwise `false`
      */
    override def equals(obj: Any): Boolean =
      obj match {
        case that: Scope =>
          if (this.childScopes.length == that.childScopes.length) {
            val childScopesEqual =
              this.childScopes.zip(that.childScopes).forall(t => t._1 == t._2)
            val occurrencesEqual = this.occurrences == that.occurrences

            childScopesEqual && occurrencesEqual
          } else {
            false
          }
        case _ => false
      }

    /** Creates and returns a scope that is a child of this one.
      *
      * @return a scope that is a child of `this`
      */
    def addChild(): Scope = {
      val scope = new Scope()
      scope.parent = Some(this)
      childScopes ::= scope

      scope
    }

    /** Adds the specified symbol occurrence to this scope.
      *
      * @param occurrence the occurrence to add
      */
    def add(occurrence: GraphOccurrence): Unit = {
      if (occurrences.contains(occurrence.id)) {
        throw new CompilerError(
          s"Multiple occurrences found for ID ${occurrence.id}."
        )
      } else {
        occurrences += ((occurrence.id, occurrence))
      }
    }

    /** Adds a definition, including a definition with synthetic name, without
      * any links.
      *
      * @param definition The definition to add.
      */
    def addDefinition(definition: GraphOccurrence.Def): Unit = {
      allDefinitions = allDefinitions ++ List(definition)
    }

    /** Finds an occurrence for the provided ID in the current scope, if it
      * exists.
      *
      * @param id the occurrence identifier
      * @return the occurrence for `id`, if it exists
      */
    def getOccurrence(id: Graph.Id): Option[GraphOccurrence] = {
      occurrences.get(id)
    }

    /** Finds any occurrences for the provided symbol in the current scope, if
      * it exists.
      *
      * @param symbol the symbol of the occurrence
      * @tparam T the role for the symbol
      * @return the occurrences for `name`, if they exist
      */
    def getOccurrences[T <: GraphOccurrence: ClassTag](
      symbol: Graph.Symbol
    ): Set[GraphOccurrence] = {
      occurrences.values.collect {
        case o: T if o.symbol == symbol => o
      }.toSet
    }

    /** Unsafely gets the occurrence for the provided ID in the current scope.
      *
      * Please note that this will crash if the ID is not defined in this
      * scope.
      *
      * @param id the occurrence identifier
      * @return the occurrence for `id`
      */
    def unsafeGetOccurrence(id: Graph.Id): GraphOccurrence = {
      getOccurrence(id).get
    }

    /** Checks whether a symbol occurs in a given role in the current scope.
      *
      * @param symbol the symbol to check for
      * @tparam T the role for it to occur in
      * @return `true` if `symbol` occurs in role `T` in this scope, `false`
      *         otherwise
      */
    def hasSymbolOccurrenceAs[T <: GraphOccurrence: ClassTag](
      symbol: Graph.Symbol
    ): Boolean = {
      occurrences.values.collectFirst {
        case x: T if x.symbol == symbol => x
      }.nonEmpty
    }

    /** Resolves usages of symbols into links where possible, creating an edge
      * from the usage site to the definition site.
      *
      * @param occurrence the symbol usage
      * @param parentCounter the number of scopes that the link has traversed
      * @return the link from `occurrence` to the definition of that symbol, if it
      *         exists
      */
    def resolveUsage(
      occurrence: GraphOccurrence.Use,
      parentCounter: Int = 0
    ): Option[Graph.Link] = {
      val definition = occurrences.values.find {
        case GraphOccurrence.Def(_, name, _, _, _) =>
          name == occurrence.symbol
        case _ => false
      }

      definition match {
        case None =>
          parent.flatMap(_.resolveUsage(occurrence, parentCounter + 1))
        case Some(target) =>
          Some(Graph.Link(occurrence.id, parentCounter, target.id))
      }
    }

    /** Creates a string representation of the scope.
      *
      * @return a string representation of `this`
      */
    override def toString: String =
      s"Scope(occurrences = ${occurrences.values}, childScopes = $childScopes)"

    /** Counts the number of scopes in this scope.
      *
      * @return the number of scopes that are either this scope or children of
      *         it
      */
    def scopeCount: Int = {
      childScopes.map(_.scopeCount).sum + 1
    }

    /** Determines the maximum nesting depth of scopes through this scope.
      *
      * @return the maximum nesting depth of scopes through this scope.
      */
    def maxNesting: Int = {
      childScopes.map(_.maxNesting).foldLeft(0)(Math.max) + 1
    }

    /** Gets the scope where a given ID is defined in the graph.
      *
      * @param id the id to find the scope for
      * @return the scope where `id` occurs
      */
    def scopeFor(id: Graph.Id): Option[Scope] = {
      if (!occurrences.contains(id)) {
        if (childScopes.isEmpty) {
          None
        } else {
          var childCandidate: Scope = null
          val iter                  = childScopes.iterator
          var moreThanOne           = false
          while (iter.hasNext && !moreThanOne) {
            iter.next().scopeFor(id) match {
              case Some(s) =>
                if (childCandidate == null) {
                  childCandidate = s
                } else {
                  moreThanOne = true
                }
              case None =>
            }
          }

          if (childCandidate == null) {
            None
          } else if (moreThanOne) {
            throw new CompilerError(s"ID $id defined in multiple scopes.")
          } else {
            Some(childCandidate)
          }
        }
      } else {
        Some(this)
      }
    }

    /** Gets the n-th parent of `this` scope.
      *
      * @param n the number of scopes to walk up
      * @return the n-th parent of `this` scope, if present
      */
    def nThParent(n: Int): Option[Scope] = {
      if (n == 0) Some(this) else this.parent.flatMap(_.nThParent(n - 1))
    }

    /** Finds the scopes in which a symbol occurs with a given role.
      *
      * Users of this function _must_ explicitly specify `T`, otherwise the
      * results will be an empty list.
      *
      * @param symbol the symbol
      * @tparam T the role in which `name` occurs
      * @return all the scopes where `name` occurs with role `T`
      */
    def scopesForSymbol[T <: GraphOccurrence: ClassTag](
      symbol: Graph.Symbol
    ): List[Scope] = {
      val occursInThisScope = hasSymbolOccurrenceAs[T](symbol)

      val occurrencesInChildScopes =
        childScopes.flatMap(_.scopesForSymbol[T](symbol))

      if (occursInThisScope) {
        this +: occurrencesInChildScopes
      } else {
        occurrencesInChildScopes
      }
    }

    /** Gets the set of all symbols in this scope and its children.
      *
      * @return the set of symbols
      */
    def symbols: Set[Graph.Symbol] = {
      val symbolsInThis        = occurrences.values.map(_.symbol).toSet
      val symbolsInChildScopes = childScopes.flatMap(_.symbols)

      symbolsInThis ++ symbolsInChildScopes
    }

    /** Goes from a symbol to all identifiers that relate to that symbol in
      * the role specified by `T`.
      *
      * @param symbol the symbol to find identifiers for
      * @tparam T the role in which `symbol` should occur
      * @return a list of identifiers for that symbol
      */
    def symbolToIds[T <: GraphOccurrence: ClassTag](
      symbol: Graph.Symbol
    ): List[Graph.Id] = {
      val scopes =
        scopesForSymbol[T](symbol).flatMap(_.getOccurrences[T](symbol))
      scopes.map(_.id)
    }

    /** Goes from an identifier to the associated symbol.
      *
      * @param id the identifier of an occurrence
      * @return the symbol associated with `id`, if it exists
      */
    def idToSymbol(
      id: Graph.Id
    ): Option[Graph.Symbol] = {
      scopeFor(id).flatMap(_.getOccurrence(id)).map(_.symbol)
    }

    /** Checks if `this` scope is a child of the provided `scope`.
      *
      * @param scope the potential parent scope
      * @return `true` if `this` is a child of `scope`, otherwise `false`
      */
    def isChildOf(scope: Scope): Boolean = {
      val isDirectChildOf = scope.childScopes.contains(this)

      val isChildOfChildren = scope.childScopes
        .map(scope => this.isChildOf(scope))
        .foldLeft(false)(_ || _)

      isDirectChildOf || isChildOfChildren
    }

    private def removeScopeFromParent(scope: Scope): Unit = {
      childScopes = childScopes.filter(_ != scope)
    }

    /** Disassociates this Scope from its parent.
      */
    def removeScopeFromParent(): Unit = {
      assert(this.parent.nonEmpty)
      this.parent.foreach(_.removeScopeFromParent(this))
    }
  }

  /** A link in the [[Graph]].
    *
    * The source of the link should always be an [[GraphOccurrence.Use]] while the
    * target of the link should always be an [[GraphOccurrence.Def]].
    *
    * @param source the source ID of the link in the graph
    * @param scopeCount the number of scopes that the link traverses
    * @param target the target ID of the link in the graph
    */
  sealed case class Link(source: Id, scopeCount: Int, target: Id)
      extends Serializable
}
