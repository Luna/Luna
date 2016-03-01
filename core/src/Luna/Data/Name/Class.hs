{-# LANGUAGE UndecidableInstances #-}

module Luna.Data.Name.Class where

import Prelude.Luna
import Luna.Data.Name.FastString
import Data.Data
import Outputable
import Unique
import Binary


------------------
-- === Name === --
------------------

newtype Name = Name FastString deriving (Data, Show, Read, Eq, Ord, Typeable, Outputable, Uniquable, Binary, Monoid, IsString, ToString, Repr s)
makeWrapped ''Name

class HasName    a where name    :: Lens' a Name
class HasOptName a where optName :: Lens' a (Maybe Name)


-- === Instances === --

-- Basic
instance HasName Name where name = id ; {-# INLINE name #-}

-- Conversions
instance Convertible String Name   where convert = wrap'   ∘ convert ; {-# INLINE convert #-}
instance Convertible Name   String where convert = convert ∘ unwrap' ; {-# INLINE convert #-}



-------------------------
-- === SegmentName === --
-------------------------

-- TODO[WD]: make the implementation faster - we can use the same technique as the one used to implement FastString here
data MultiName = MultiName Name [Name] deriving (Show, Read, Eq, Ord)

class HasMultiName    a where multiName    :: Lens' a MultiName
class HasOptMultiName a where optMultiName :: Lens' a (Maybe MultiName)


-- === Instances === --

-- Basic
instance HasMultiName MultiName where multiName = id ; {-# INLINE multiName #-}

-- Strings
instance IsString MultiName where fromString = flip MultiName mempty ∘ fromString ; {-# INLINE fromString #-}

-- Repr
instance Repr s MultiName where repr = const "<multiname repr>" ; {-# INLINE repr #-}
