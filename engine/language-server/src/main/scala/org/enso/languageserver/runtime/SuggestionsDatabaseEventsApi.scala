package org.enso.languageserver.runtime

object SuggestionsDatabaseEventsApi {

  /** A search suggestion. */
  sealed trait Suggestion
  object Suggestion {

    /** An argument of an atom or a function.
      *
      * @param name the argument name
      * @param reprType the type of the argument
      * @param isSuspended is the argument lazy
      * @param hasDefault does the argument have a default
      * @param defaultValue optional default value
      */
    case class Argument(
      name: String,
      reprType: String,
      isSuspended: Boolean,
      hasDefault: Boolean,
      defaultValue: Option[String]
    )

    /** The definition scope.
      *
      * @param start the start of the definition scope
      * @param end the end of the definition scope
      */
    case class Scope(start: Int, end: Int)

    /** A value constructor.
      *
      * @param name the atom name
      * @param arguments the list of arguments
      * @param returnType the type of an atom
      * @param documentation the documentation string
      */
    case class Atom(
      name: String,
      arguments: Seq[Argument],
      returnType: String,
      documentation: Option[String]
    ) extends Suggestion

    /** A function defined on a type or a module.
      *
      * @param name the method name
      * @param arguments the function arguments
      * @param selfType the self type of a method
      * @param returnType the return type of a method
      * @param documentation the documentation string
      */
    case class Method(
      name: String,
      arguments: Seq[Argument],
      selfType: String,
      returnType: String,
      documentation: Option[String]
    ) extends Suggestion

    /** A local function definition.
      *
      * @param name the function name
      * @param arguments the function arguments
      * @param returnType the return type of a function
      * @param scope the scope where the function is defined
      */
    case class Function(
      name: String,
      arguments: Seq[Argument],
      returnType: String,
      scope: Scope
    ) extends Suggestion

    /** A local value.
      *
      * @param name the name of a value
      * @param returnType the type of a local value
      * @param scope the scope where the value is defined
      */
    case class Local(name: String, returnType: String, scope: Scope)
        extends Suggestion

  }

  sealed trait SuggestionsDatabaseUpdate
  object SuggestionsDatabaseUpdate {

    /** Create or replace the database entry.
      *
      * @param id suggestion id
      * @param suggestion the new suggestion
      */
    case class Add(id: Long, suggestion: Suggestion)
        extends SuggestionsDatabaseUpdate

    /** Remove the database entry.
      *
      * @param id the suggestion id
      */
    case class Remove(id: Long) extends SuggestionsDatabaseUpdate

    /** Modify the database entry.
      *
      * @param id the suggestion id
      * @param name the new suggestion name
      * @param arguments the new suggestion arguments
      * @param selfType the new self type of the suggestion
      * @param returnType the new return type of the suggestion
      * @param documentation the new documentation string
      */
    case class Modify(
      id: Long,
      name: Option[String],
      arguments: Option[Seq[Suggestion.Argument]],
      selfType: Option[String],
      returnType: Option[String],
      documentation: Option[String],
      scope: Option[Suggestion.Scope]
    )

  }
}
