{-# LANGUAGE UndecidableInstances #-}

module Luna.Syntax.Term.Atom where

import Prelude.Luna

import Data.Base
import Luna.Syntax.Term.Function (Arg)
import Luna.Pretty.Styles  (HeaderOnly, StaticNameOnly(StaticNameOnly))

import qualified Luna.Syntax.Term.Lit as Lit
import Type.Applicative
import           Luna.Runtime.Dynamics      (ByDynamics)


-- TODO[WD]: move to issue tracker after releasing Luna to github

--------------------------------------------
-- === Enhancement proposals & issues === --
--------------------------------------------

-- Status: pending | accepted | rejected

-- Reporter  Status   Description
-- wdanilo   pending  ACCESSORS AND FUNCTIONS UNIFICATION
--                    Check if we can throw away accessors in terms. Let's consider the following Luna code:
--                        a  = x.bar
--                        a' = acc x "bar"
--                    These lines should mean exactly the same with the followings rules:
--                        - both forms have to be distinguishable to provide Term <-> Text conversion
--                        - the performance of STATIC Luna compilation should be as fast as in current solution
--                        - accessors should be first class objects, althought we can easily make a workaround like `myacc = a : a.x`


type DynName d a = NameByDynamics d a
type NameByDynamics dyn d = ByDynamics dyn Lit.String d


-------------------
-- === Atoms === --
-------------------

-- === Types === --

data Var'    = Var'    deriving (Show, Eq, Ord)
data Cons'   = Cons'   deriving (Show, Eq, Ord)
data Acc'    = Acc'    deriving (Show, Eq, Ord)
data App'    = App'    deriving (Show, Eq, Ord)
data Unify'  = Unify'  deriving (Show, Eq, Ord)
data Match'  = Match'  deriving (Show, Eq, Ord)
data Lam'    = Lam'    deriving (Show, Eq, Ord)
data Native' = Native' deriving (Show, Eq, Ord)
data Blank'  = Blank'  deriving (Show, Eq, Ord)


-- === Definitions === --

data family Atom  t  dyn a
type        Atoms ts dyn a = Atom <$> ts <*> '[dyn] <*> '[a]

type family AtomArgs t dyn a
class Atomic t where atom :: AtomArgs t d a -> Atom t d a


-- === Instances === --

type instance Base (Atom t dyn a) = t

newtype instance Atom Var'    dyn a = Atom_Var     (DynName dyn a)
newtype instance Atom Cons'   dyn a = Atom_Cons    (DynName dyn a)
data    instance Atom Acc'    dyn a = Atom_Acc    !(DynName dyn a) !a
data    instance Atom App'    dyn a = Atom_App                     !a ![Arg a]
data    instance Atom Unify'  dyn a = Atom_Unify                   !a !a
data    instance Atom Match'  dyn a = Atom_Match                   !a !a
data    instance Atom Lam'    dyn a = Atom_Lam                     ![Arg a] !a
data    instance Atom Native' dyn a = Atom_Native !(DynName dyn a)
data    instance Atom Blank'  dyn a = Atom_Blank

type instance AtomArgs Var'    dyn a = OneTuple (DynName dyn a)
type instance AtomArgs Cons'   dyn a = OneTuple (DynName dyn a)
type instance AtomArgs Acc'    dyn a =          (DynName dyn a, a)
type instance AtomArgs App'    dyn a =          (a, [Arg a])
type instance AtomArgs Unify'  dyn a =          (a, a)
type instance AtomArgs Match'  dyn a =          (a, a)
type instance AtomArgs Lam'    dyn a =          ([Arg a], a)
type instance AtomArgs Native' dyn a = OneTuple (DynName dyn a)
type instance AtomArgs Blank'  dyn a =          ()

instance Atomic Var'    where atom = uncurry Atom_Var    ; {-# INLINE atom #-}
instance Atomic Cons'   where atom = uncurry Atom_Cons   ; {-# INLINE atom #-}
instance Atomic Acc'    where atom = uncurry Atom_Acc    ; {-# INLINE atom #-}
instance Atomic App'    where atom = uncurry Atom_App    ; {-# INLINE atom #-}
instance Atomic Unify'  where atom = uncurry Atom_Unify  ; {-# INLINE atom #-}
instance Atomic Match'  where atom = uncurry Atom_Match  ; {-# INLINE atom #-}
instance Atomic Lam'    where atom = uncurry Atom_Lam    ; {-# INLINE atom #-}
instance Atomic Native' where atom = uncurry Atom_Native ; {-# INLINE atom #-}
instance Atomic Blank'  where atom = uncurry Atom_Blank  ; {-# INLINE atom #-}


--------------------------------------------------------------------------------------
-- OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD OLD
--------------------------------------------------------------------------------------

-- === Definition === --
-- | Type parameter `t` defines the term type
--   Type parameter `n` defines


-- LEGEND --
--   N   - Name
--   S   - Source
--   A/P - Args / Params

-- Layout                    N  S  A/P
newtype Var    n   = Var     n             deriving (Show, Eq, Ord, Functor, Foldable, Traversable)
data    Cons   n t = Cons    n    ![Arg t] deriving (Show, Eq, Ord, Functor, Foldable, Traversable)
data    Acc    n t = Acc    !n !t          deriving (Show, Eq, Ord, Functor, Foldable, Traversable)
data    App      t = App       !t ![Arg t] deriving (Show, Eq, Ord, Functor, Foldable, Traversable)
data    Unify    t = Unify     !t !t       deriving (Show, Eq, Ord, Functor, Foldable, Traversable)
data    Match    t = Match     !t !t       deriving (Show, Eq, Ord, Functor, Foldable, Traversable)
data    Lam      t = Lam       ![Arg t] !t deriving (Show, Eq, Ord, Functor, Foldable, Traversable)
data    Native n   = Native !n             deriving (Show, Eq, Ord, Functor, Foldable, Traversable)
data    Blank      = Blank                 deriving (Show, Eq, Ord)


-- === Properties === --

type family Name   a
type family Source a
type family Target a
type family Args   a

class HasName   a where name   :: Lens' a (Name   a)
class HasSource a where source :: Lens' a (Source a)
class HasTarget a where target :: Lens' a (Target a)
class HasArgs   a where args   :: Lens' a (Args   a)



-- === N / T Folding === --
-- | NFunctor and TFunctor allow mapping components over the `n` and `t` type parameters respectively.

class NFunctor n m a a' | n m a -> a' where fmapN :: (n -> m) -> a -> a'
class TFunctor t r a a' | t r a -> a' where fmapT :: (t -> r) -> a -> a'
class MonoTFunctor t a where monoTMap :: (t -> t) -> a -> a

class NFoldable a t where foldrN :: (a -> b -> b) -> b -> t -> b
class TFoldable a t where foldrT :: (a -> b -> b) -> b -> t -> b

instance {-# OVERLAPPABLE #-}           TFoldable t Lit.Star      where foldrT _ = const ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-}           TFoldable t Lit.String    where foldrT _ = const ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-}           TFoldable t Lit.Number    where foldrT _ = const ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-}           TFoldable t Blank         where foldrT _ = const ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-}           TFoldable t (Var    n   ) where foldrT _ = const ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-} t ~ t' => TFoldable t (Cons   n t') where foldrT   = foldr ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-} t ~ t' => TFoldable t (Acc    n t') where foldrT   = foldr ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-} t ~ t' => TFoldable t (App      t') where foldrT   = foldr ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-} t ~ t' => TFoldable t (Unify    t') where foldrT   = foldr ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-} t ~ t' => TFoldable t (Match    t') where foldrT   = foldr ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-} t ~ t' => TFoldable t (Lam      t') where foldrT   = foldr ; {-# INLINE foldrT #-}
instance {-# OVERLAPPABLE #-}           TFoldable t (Native n   ) where foldrT _ = const ; {-# INLINE foldrT #-}


-- === Instances ===

-- Bases
type instance Base Lit.Star    = Lit.Star
type instance Base Lit.String  = Lit.String
type instance Base Lit.Number  = Lit.Number

type instance Base (Lam      t) = Proxy Lam
type instance Base (Cons   n t) = Proxy Cons
type instance Base (Acc    n t) = Proxy Acc
type instance Base (App      t) = Proxy App
type instance Base (Var    n  ) = Proxy Var
type instance Base (Unify    t) = Proxy Unify
type instance Base (Match    t) = Proxy Match
type instance Base Blank        = Proxy Blank
type instance Base (Native n  ) = Proxy Native

-- Wrappers
makeWrapped ''Var
makeWrapped ''Native

-- Properties
type instance Name   (Var    n  ) = n
type instance Name   (Cons   n t) = n
type instance Name   (Acc    n t) = n
type instance Name   (Native n  ) = n
type instance Source (Acc    n t) = t
type instance Source (App      t) = t
type instance Source (Unify    t) = t
type instance Source (Match    t) = t
type instance Target (Lam      t) = t
type instance Target (Unify    t) = t
type instance Target (Match    t) = t
type instance Args   (Cons   n t) = [Arg t]
type instance Args   (App      t) = [Arg t]
type instance Args   (Lam      t) = [Arg t]

instance HasName   (Var    n  ) where name   = wrapped'                                                  ; {-# INLINE name   #-}
instance HasName   (Cons   n t) where name   = lens (\(Cons   n _) -> n) (\(Cons   _ t) n -> Cons   n t) ; {-# INLINE name   #-}
instance HasName   (Acc    n t) where name   = lens (\(Acc    n _) -> n) (\(Acc    _ t) n -> Acc    n t) ; {-# INLINE name   #-}
instance HasName   (Native n  ) where name   = wrapped'                                                  ; {-# INLINE name   #-}
instance HasSource (Acc    n t) where source = lens (\(Acc    _ s) -> s) (\(Acc    n _) s -> Acc    n s) ; {-# INLINE source #-}
instance HasSource (App      t) where source = lens (\(App    s _) -> s) (\(App    _ a) s -> App    s a) ; {-# INLINE source #-}
instance HasSource (Unify    t) where source = lens (\(Unify  s _) -> s) (\(Unify  _ t) s -> Unify  s t) ; {-# INLINE source #-}
instance HasSource (Match    t) where source = lens (\(Match  s _) -> s) (\(Match  _ t) s -> Match  s t) ; {-# INLINE source #-}
instance HasTarget (Lam      t) where target = lens (\(Lam    _ t) -> t) (\(Lam    s _) t -> Lam    s t) ; {-# INLINE target #-}
instance HasTarget (Unify    t) where target = lens (\(Unify  _ t) -> t) (\(Unify  s _) t -> Unify  s t) ; {-# INLINE target #-}
instance HasTarget (Match    t) where target = lens (\(Match  _ t) -> t) (\(Match  s _) t -> Match  s t) ; {-# INLINE target #-}
instance HasArgs   (Cons   n t) where args   = lens (\(Cons   _ a) -> a) (\(Cons   n _) a -> Cons   n a) ; {-# INLINE args   #-}
instance HasArgs   (App      t) where args   = lens (\(App    _ a) -> a) (\(App    s _) a -> App    s a) ; {-# INLINE args   #-}
instance HasArgs   (Lam      t) where args   = lens (\(Lam    a _) -> a) (\(Lam    _ o) a -> Lam    a o) ; {-# INLINE args   #-}

-- Mapping
instance n ~ n' => NFunctor n m (Var    n'  ) (Var    m  ) where fmapN = (wrapped %~)                ; {-# INLINE fmapN #-}
instance n ~ n' => NFunctor n m (Cons   n' t) (Cons   m t) where fmapN f (Cons n t)   = Cons (f n) t ; {-# INLINE fmapN #-}
instance n ~ n' => NFunctor n m (Acc    n' t) (Acc    m t) where fmapN f (Acc n t)    = Acc (f n) t  ; {-# INLINE fmapN #-}
instance n ~ n' => NFunctor n m (Native n'  ) (Native m  ) where fmapN f (Native n)   = Native (f n) ; {-# INLINE fmapN #-}
instance           NFunctor n m (Lam       t) (Lam      t) where fmapN = flip const                  ; {-# INLINE fmapN #-}
instance           NFunctor n m (App       t) (App      t) where fmapN = flip const                  ; {-# INLINE fmapN #-}
instance           NFunctor n m (Unify     t) (Unify    t) where fmapN = flip const                  ; {-# INLINE fmapN #-}
instance           NFunctor n m (Match     t) (Match    t) where fmapN = flip const                  ; {-# INLINE fmapN #-}
instance           NFunctor n m Blank         Blank        where fmapN = flip const                  ; {-# INLINE fmapN #-}

instance t ~ t' => TFunctor t r (Lam      t') (Lam      r) where fmapT = fmap       ; {-# INLINE fmapT #-}
instance t ~ t' => TFunctor t r (Acc    n t') (Acc    n r) where fmapT = fmap       ; {-# INLINE fmapT #-}
instance           TFunctor t r (Native n   ) (Native n  ) where fmapT = flip const ; {-# INLINE fmapT #-}
instance t ~ t' => TFunctor t r (App      t') (App      r) where fmapT = fmap       ; {-# INLINE fmapT #-}
instance t ~ t' => TFunctor t r (Unify    t') (Unify    r) where fmapT = fmap       ; {-# INLINE fmapT #-}
instance t ~ t' => TFunctor t r (Match    t') (Match    r) where fmapT = fmap       ; {-# INLINE fmapT #-}
instance           TFunctor t r (Var    n   ) (Var    n  ) where fmapT = flip const ; {-# INLINE fmapT #-}
instance t ~ t' => TFunctor t r (Cons   n t') (Cons   n r) where fmapT = fmap       ; {-# INLINE fmapT #-}
instance           TFunctor t r Blank         Blank        where fmapT = flip const ; {-# INLINE fmapT #-}

instance           MonoTFunctor t Lit.Star      where monoTMap = flip const ; {-# INLINE monoTMap #-}
instance           MonoTFunctor t Lit.String    where monoTMap = flip const ; {-# INLINE monoTMap #-}
instance           MonoTFunctor t Lit.Number    where monoTMap = flip const ; {-# INLINE monoTMap #-}
instance t ~ t' => MonoTFunctor t (Lam      t') where monoTMap = fmap       ; {-# INLINE monoTMap #-}
instance t ~ t' => MonoTFunctor t (Acc    n t') where monoTMap = fmap       ; {-# INLINE monoTMap #-}
instance           MonoTFunctor t (Native n   ) where monoTMap = flip const ; {-# INLINE monoTMap #-}
instance t ~ t' => MonoTFunctor t (App      t') where monoTMap = fmap       ; {-# INLINE monoTMap #-}
instance t ~ t' => MonoTFunctor t (Unify    t') where monoTMap = fmap       ; {-# INLINE monoTMap #-}
instance t ~ t' => MonoTFunctor t (Match    t') where monoTMap = fmap       ; {-# INLINE monoTMap #-}
instance           MonoTFunctor t (Var    n   ) where monoTMap = flip const ; {-# INLINE monoTMap #-}
instance t ~ t' => MonoTFunctor t (Cons   n t') where monoTMap = fmap       ; {-# INLINE monoTMap #-}
instance           MonoTFunctor t Blank         where monoTMap = flip const ; {-# INLINE monoTMap #-}

-- Representations

-- Default
instance {-# OVERLAPPABLE #-}                   Repr s Lit.Star     where repr _                = "*"
instance {-# OVERLAPPABLE #-}                   Repr s Lit.String   where repr (Lit.String s  ) = "Str"    <+> repr s
instance {-# OVERLAPPABLE #-}                   Repr s Lit.Number   where repr (Lit.Number r n) = "Num"    <+> repr r <+> repr n
instance {-# OVERLAPPABLE #-} Repr  s n      => Repr s (Var    n  ) where repr (Var        n  ) = "Var"    <+> repr n
instance {-# OVERLAPPABLE #-} Reprs s '[n,t] => Repr s (Cons   n t) where repr (Cons       n t) = "Cons"   <+> repr n <+> repr t
instance {-# OVERLAPPABLE #-} Repr  s t      => Repr s (Lam      t) where repr (Lam        s t) = "Lam  "  <+> repr s <+> repr t
instance {-# OVERLAPPABLE #-} Reprs s '[n,t] => Repr s (Acc    n t) where repr (Acc        n s) = "Acc"    <+> repr n <+> repr s
instance {-# OVERLAPPABLE #-} Repr  s t      => Repr s (App      t) where repr (App        s a) = "App"    <+> repr s <+> repr a
instance {-# OVERLAPPABLE #-} Repr  s t      => Repr s (Unify    t) where repr (Unify      s t) = "Unify"  <+> repr s <+> repr t
instance {-# OVERLAPPABLE #-} Repr  s t      => Repr s (Match    t) where repr (Match      s t) = "Match"  <+> repr s <+> repr t
instance {-# OVERLAPPABLE #-} Repr  s n      => Repr s (Native n  ) where repr (Native     n  ) = "Native" <+> repr n
instance {-# OVERLAPPABLE #-}                   Repr s  Blank       where repr _                = "Blank"
instance {-# OVERLAPPABLE #-}                   Repr s Lit.System   where repr                  = \case Lit.Rational r -> repr r
                                                                                                        Lit.Integer  i -> repr i
                                                                                                        Lit.Double   d -> repr d

-- HeaderOnly
instance {-# OVERLAPPABLE #-} Repr StaticNameOnly n => Repr HeaderOnly (Var   n    ) where repr (Var n) = "Var" <+> fromString (reprStyled StaticNameOnly n)
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Cons   n          t) where repr _ = "Cons"
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Cons   Lit.String t) where repr (Cons s _) = fromString $ "Cons " <>  show (unwrap' s)
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Lam               t) where repr _ = "Lam"
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Acc    n          t) where repr _ = "Acc"
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Acc    Lit.String t) where repr (Acc s _) = fromString $ "Acc " <>  show (unwrap' s)
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (App               t) where repr _ = "App"
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Unify             t) where repr _ = "Unify"
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Match             t) where repr _ = "Match"
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Native n           ) where repr _ = "Native"
instance {-# OVERLAPPABLE #-} Repr HeaderOnly (Native Lit.String  ) where repr (Native s) = fromString $ "Native " <> show (unwrap' s)
