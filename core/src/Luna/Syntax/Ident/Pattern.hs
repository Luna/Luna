module Luna.Syntax.Ident.Pattern where

import Prelude.Luna
import Luna.Data.Name
import Luna.Syntax.AST.Arg


data Pattern a = Pattern [ArgDef a] [Segment a] deriving (Generic, Show, Read, Eq, Ord, Functor, Foldable, Traversable)
data Segment a = Segment Name [ArgDef a]        deriving (Generic, Show, Read, Eq, Ord, Functor, Foldable, Traversable)



