{-# LANGUAGE UndecidableInstances #-}
{-# LANGUAGE OverloadedLists      #-}

module Data.TreeMap where

import Prologue hiding (null)

import qualified Prelude  as P
import qualified Data.Map as Map
import           Data.Map (Map)
import qualified GHC.Exts as GHC
import           Data.List.NonEmpty (NonEmpty ((:|)))



------------------------------
-- === Value containers === --
------------------------------

-- === Definition === --

class Traversable t => IsValue t where
    ixVal    :: forall a. Traversal' (t a) a
    mkVal    :: forall a. a   -> t a
    checkVal :: forall a. t a -> Maybe a

class IsValue t => IsSparseValue t where
    emptyVal :: forall a. t a


-- === Utils === --

valExists :: IsValue t => t a -> Bool
valExists = isJust . checkVal

fromValWith :: IsValue t => b -> (a -> b) -> t a -> b
fromValWith b f = fromMaybeWith b f . checkVal

fromVal :: IsValue t => a -> t a -> a
fromVal a = fromMaybe a . checkVal


-- === JustValue === --

newtype JustValue a = JustValue a deriving (Show, Functor, Foldable, Traversable, Default, Mempty, Semigroup)
makeLenses ''JustValue

instance IsValue JustValue where
    checkVal = Just . unwrap
    mkVal    = JustValue
    ixVal    = wrapped


-- === Maybe === --

instance IsSparseValue Maybe where emptyVal = Nothing
instance IsValue       Maybe where checkVal = id
                                   mkVal    = Just
                                   ixVal    = _Just



---------------------
-- === TreeMap === --
---------------------

-- === Definition === --

type SparseTreeMap = TreeMap Maybe
type SolidTreeMap  = TreeMap JustValue

newtype TreeMap    t k a = TreeMap    { _branches :: Map k (TreeBranch t k a) } deriving (Show, Read, Functor, Foldable, Traversable, Mempty, Default, Semigroup, P.Monoid)
data    TreeBranch t k a = TreeBranch { _value    :: !(t a)
                                      , _subtree  :: !(TreeMap t k a)
                                      } deriving (Show, Read, Functor, Foldable, Traversable)

makeLenses ''TreeMap
makeLenses ''TreeBranch


-- === Helpers === --

justIfNotNullBranch :: IsValue t => TreeBranch t k a -> Maybe (TreeBranch t k a)
justIfNotNullBranch t = justIf (not $ nullBranch t) t


-- === Construction === --

singleton :: (IsValue t, Ord k) => k -> a -> TreeMap t k a
singleton k a = mempty & branches . at k .~ Just (TreeBranch (mkVal a) mempty)

singletonBranch :: IsValue t => a -> TreeBranch t k a
singletonBranch a = TreeBranch (mkVal a) mempty

instance Mempty  (t a) => Mempty  (TreeBranch t k a) where mempty = TreeBranch mempty mempty
instance Default (t a) => Default (TreeBranch t k a) where def    = TreeBranch def mempty


-- === Attributes === --

null :: TreeMap t k a -> Bool
null = Map.null . unwrap

nullBranch :: IsValue t => TreeBranch t k a -> Bool
nullBranch t = (not . valExists $ t ^. value) && (null $ t ^. subtree)

keys   :: TreeMap t k a -> [k]
elems  :: TreeMap t k a -> [TreeBranch t k a]
assocs :: TreeMap t k a -> [(k, TreeBranch t k a)]
keys   = Map.keys   . unwrap
elems  = Map.elems  . unwrap
assocs = Map.assocs . unwrap

paths_ :: IsValue t => TreeMap t k a -> [NonEmpty k]
paths  :: IsValue t => TreeMap t k a -> [(NonEmpty k, a)]
paths_ = fst <∘> paths
paths t = concat $ (\(k,v) -> branchPaths (pure k) v) <$> assocs t where
    treePaths   path tree             = concat $ (\(k,v) -> branchPaths (path <> [k]) v) <$> assocs tree
    branchPaths path (TreeBranch v s) = fromValWith id ((:) . (path,)) v $ treePaths path s


-- === Modification === --

insertDef :: (IsValue       t, Ord k) => t a -> NonEmpty k -> a -> TreeMap t k a -> TreeMap t k a
insert    :: (IsSparseValue t, Ord k) =>        NonEmpty k -> a -> TreeMap t k a -> TreeMap t k a
insert = insertDef emptyVal
insertDef d ks a t = t & branches . nestedDefAt emptyBranch ks %~ (Just . set value (mkVal a) . fromMaybe emptyBranch) where
    emptyBranch = TreeBranch d mempty

deleteAtSubbranch :: (Ord k, IsSparseValue t) => [k] -> TreeBranch t k a -> TreeBranch t k a
deleteAtSubbranch (k:ks) t = t & fromMaybeWith id (set (at k) . justIfNotNullBranch) (deleteAtSubbranch ks <$> t ^. at k)
deleteAtSubbranch []     t = t & value .~ emptyVal

deleteSubbranch :: (Ord k, IsValue t) => [k] -> TreeBranch t k a -> Maybe (TreeBranch t k a)
deleteSubbranch (k:ks) t = justIfNotNullBranch $ t & at k %~ (join . fmap (deleteSubbranch ks))
deleteSubbranch []     t = Nothing

delete        :: (Ord k, IsSparseValue t) => NonEmpty k -> TreeMap t k a -> TreeMap t k a
deleteSubtree :: (Ord k, IsValue       t) => NonEmpty k -> TreeMap t k a -> TreeMap t k a
delete        (k :| ks) = branches . at k %~ join . fmap (justIfNotNullBranch . deleteAtSubbranch ks)
deleteSubtree (k :| ks) = branches . at k %~ join . fmap (deleteSubbranch ks)

modify :: (IsValue t, Ord k) => NonEmpty k -> (a -> a) -> TreeMap t k a -> TreeMap t k a
modify ks f = focus ks %~ f

-- Semigroup
instance (Semigroup (t a), Ord k) => Semigroup (TreeBranch t k a) where
    TreeBranch v s <> TreeBranch v' s' = TreeBranch (v <> v') (s <> s')
instance (Monoid (t a), Ord k) => P.Monoid (TreeBranch t k a) where
    mempty  = mempty
    mappend = (<>)

-- TreeBranch Indexing
type instance Index    (TreeBranch t k a) = k
type instance IxValue  (TreeBranch t k a) = TreeBranch t k a
instance Ord k => At   (TreeBranch t k a) where at s = subtree . wrapped . at s
instance Ord k => Ixed (TreeBranch t k a) where ix s = subtree . wrapped . ix s

-- TreeMap Indexing
type instance Index    (TreeMap t k a) = k
type instance IxValue  (TreeMap t k a) = TreeMap t k a
instance Ord k => Ixed (TreeMap t k a) where ix s = wrapped . ix s . subtree


-- === Traversals === --

mapWithKey  :: IsValue t =>          (k -> a -> b) -> TreeMap t k a -> TreeMap t k b
mapWithPath :: IsValue t => (NonEmpty k -> a -> b) -> TreeMap t k a -> TreeMap t k b
mapWithKey  = runIdentity .: traverseWithKey  . (fmap . fmap $ return)
mapWithPath = runIdentity .: traverseWithPath . (fmap . fmap $ return)

traverseWithKey  :: (IsValue t, Monad m) =>          (k -> a -> m b) -> TreeMap t k a -> m (TreeMap t k b)
traverseWithPath :: (IsValue t, Monad m) => (NonEmpty k -> a -> m b) -> TreeMap t k a -> m (TreeMap t k b)
traverseWithKey f =  wrapped $ Map.traverseWithKey traverseBranch where
    traverseBranch k (TreeBranch v s) = TreeBranch <$> (mapM (f k) v) <*> (s & wrapped (Map.traverseWithKey traverseBranch))
traverseWithPath f = wrapped $ Map.traverseWithKey (\p -> traverseBranch $ p :| []) where
    traverseBranch path (TreeBranch v s) = TreeBranch <$> (mapM (f path) v) <*> (s & wrapped (Map.traverseWithKey (\p -> traverseBranch $ path <> [p])))

foldBranches           :: (IsValue t)          =>                                  (b -> k -> t a ->   b) -> b -> TreeMap t k a ->   [b]
foldBranchesM          :: (IsValue t, Monad m) =>                                  (b -> k -> t a -> m b) -> b -> TreeMap t k a -> m [b]
foldBranchesM_         :: (IsValue t, Monad m) =>                                  (b -> k -> t a -> m b) -> b -> TreeMap t k a -> m ()
foldReduceBranches     :: (IsValue t)          => (b -> k -> t a -> [c] ->   c) -> (b -> k -> t a ->   b) -> b -> TreeMap t k a ->   [c]
foldReduceBranchesM    :: (IsValue t, Monad m) => (b -> k -> t a -> [c] -> m c) -> (b -> k -> t a -> m b) -> b -> TreeMap t k a -> m [c]
reduceBranches         :: (IsValue t)          =>      (k -> t a -> [c] ->   c)                                -> TreeMap t k a ->   [c]
reduceBranchesM        :: (IsValue t, Monad m) =>      (k -> t a -> [c] -> m c)                                -> TreeMap t k a -> m [c]
foldReduceSubBranchesM :: (IsValue t, Monad m) => (b -> k -> t a -> [c] -> m c) -> (b -> k -> t a -> m b) -> b -> k -> TreeBranch t k a -> m c
foldBranches             f b = runIdentity . foldBranchesM (return ∘∘∘ f) b
foldBranchesM            f b = fmap concat . foldReduceBranchesM (\b _ ma subs -> return $ concat subs & if valExists ma then (b:) else id) f b
foldBranchesM_               = void .:. foldBranchesM
foldReduceBranches     h f b = runIdentity . foldReduceBranchesM (return ∘∘∘∘ h) (return ∘∘∘ f) b
foldReduceBranchesM    h f b = mapM (uncurry $ foldReduceSubBranchesM h f b) . assocs
reduceBranches         h     = foldReduceBranches  (const h) (const3 ())          ()
reduceBranchesM        h     = foldReduceBranchesM (const h) (const3 $ return ()) ()
foldReduceSubBranchesM h f b k (TreeBranch v s) = do
    b' <- f b k v
    h b' k v =<< foldReduceBranchesM h f b' s



-- === Lookup & indexing === --

lookup :: (Ord k, IsValue t) => NonEmpty k -> TreeMap t k a -> Maybe a
lookup (k :| ks) = join . fmap (lookupBranch ks) . view (branches . at k) where
    lookupBranch = \case []     -> checkVal . view value
                         (k:ks) -> join . fmap (lookupBranch ks) . view (at k)

focus :: (IsValue t, Ord k) => NonEmpty k -> Traversal' (TreeMap t k a) a
focus ks = branches . nestedIx ks . value . ixVal


-- === Conversions === --

-- Lists
type instance         Item     (TreeMap t k a) = (NonEmpty k, a)
instance IsValue t => ToList   (TreeMap t k a) where toList = paths
instance Ord k => FromList (SparseTreeMap k a) where
    fromList []             = mempty
    fromList ((ks, a) : ls) = insert ks a $ fromList ls
instance (Ord k, Default a) => FromList (SolidTreeMap k a) where
    fromList []             = mempty
    fromList ((ks, a) : ls) = insertDef def ks a $ fromList ls
instance IsList (TreeMap t k a) => GHC.IsList (TreeMap t k a) where
    type Item   (TreeMap t k a) = Item (TreeMap t k a)
    toList   = toList
    fromList = fromList



-------------------
-- === Tests === --
-------------------

-- main :: IO ()
-- main = do
--     let a = mempty :: SparseTreeMap Int Int
--         a' = insert (5 :| [6,7]) 8 a
--         b  = delete (5 :| [6,7]) a'
--         c  = delete (pure 5) a'
--         d  = deleteSubtree [5] a'
--         e1 = modify (5 :| [6]) (+1) a'
--         e2 = modify (5 :| [6,7]) (+1) a'
--         x  = [(1 :| [2,3], 4)] :: SparseTreeMap Int Int
--     print $ a' ^. at 5
--     print $ a' ^. nestedAt [5,6,7]
--     print $ b
--     print $ c
--     print $ d
--     print $ e1
--     print $ e2
--     print $ toList a'
--     print "test"
