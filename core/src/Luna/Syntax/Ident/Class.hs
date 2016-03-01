module Luna.Syntax.Ident.Class (module Luna.Syntax.Ident.Class, module X) where

import Prelude.Luna

import Data.Char                   (isLower, isUpper)
import Luna.Data.Name

import qualified Luna.Syntax.Ident.Type as Type
import           Luna.Syntax.Ident.Type as X (IdentType)


-------------------
-- === Ident === --
-------------------

-- === Definition === --

type    Ident' a = Ident (IdentType a)
newtype Ident  t = Ident MultiName deriving (Show, Read, Eq, Ord)
makeWrapped ''Ident

type Var  = Ident Type.Var
type Type = Ident Type.Type

class HasIdent    a where ident    :: Lens' a        (Ident' a)
class HasOptIdent a where optIdent :: Lens' a (Maybe (Ident' a))


-- === Utils === --

var :: String -> Var
var = fromString ; {-# INLINE var #-}

tp  :: String -> Type
tp  = fromString ; {-# INLINE tp  #-}

named :: HasOptIdent a => Ident' a -> a -> a
named = set optIdent ∘ Just

unnamed :: HasOptIdent a => a -> a
unnamed = set optIdent Nothing


-- === Instances === --

-- Basic
type instance IdentType (Ident t) = t
instance      HasIdent  (Ident t) where ident = id ; {-# INLINE ident #-}

-- Strings
instance IsString     (Ident t) where fromString = wrap' ∘ fromString ; {-# INLINE fromString #-}
instance HasMultiName (Ident t) where multiName  = wrapped'           ; {-# INLINE multiName  #-}
instance Repr s       (Ident t) where repr       = repr ∘ unwrap'     ; {-# INLINE repr       #-}
