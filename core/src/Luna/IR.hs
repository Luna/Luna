module Luna.IR (module X) where


import OCI.IR               as X hiding (Definition, Import, decls)
import Luna.IR.ToRefactor   as X
import Luna.IR.Layer        as X (Type, UserType, UID, Succs, Requester, Errors)
import Luna.IR.Term.Uni     as X
import Luna.IR.Format       as X
import Luna.IR.Term.Literal as X (HasLiteral, literal)
import Luna.IR.Term.Uni     as X

-- FIXME[WD]:
-- this trick hides constructors:
-- it's needed until we get rid of UniTerm
import Luna.IR.Expr as X hiding (Number, String, FmtString, Acc, App, Lam, Unify, Seq, Match, Monadic, Cons, Var, FieldLens, Grouped, Blank, Star, Missing, ASGFunction, FunctionSig, RootedFunction, ASGRootedFunction, ClsASG, Unit, UnitProxy, UnresolvedImport, UnresolvedImportSrc, World, Typed, RecASG, FieldASG, Invalid, List, LeftSection, RightSection, AccSection, Disabled, Marker, Marked, Metadata)
import Luna.IR.Expr as X        (Number, String, FmtString, Acc, App, Lam, Unify, Seq, Match, Monadic, Cons, Var, FieldLens, Grouped, Blank, Star, Missing, ASGFunction, FunctionSig, RootedFunction, ASGRootedFunction, ClsASG, Unit, UnitProxy, UnresolvedImport, UnresolvedImportSrc, World, Typed, RecASG, FieldASG, Invalid, List, LeftSection, RightSection, AccSection, Disabled, Marker, Marked, Metadata)
