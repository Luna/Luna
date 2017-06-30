{-# LANGUAGE UndecidableInstances #-}

module Luna.Test.Utils where

import           Luna.Prelude
import           Luna.IR
import           OCI.Pass.Class hiding (inputs)
import           Control.Monad.Trans.Maybe
import           Control.Monad.State       as State   hiding (when)
import           Control.Monad             (guard)
import           Data.Maybe                (isJust, maybeToList)
import           Test.Hspec                (expectationFailure, Expectation)
import qualified Data.Set                  as Set
import           Data.Set                  (Set)



match2 :: (MonadRef m, Reader Layer (AnyExpr // Model) m, uniTerm ~ Unwrapped (UniTerm' (Expr layout)))
       => Expr layout -> Expr layout -> (uniTerm -> uniTerm -> m a) -> m a
match2 e1 e2 l = do
    firstMatched <- matchExpr e1 $ return . l
    matchExpr e2 firstMatched



---------------------------
-- === HSpec helpers === --
---------------------------

withRight :: Show (Either a b) => Either a b -> (b -> Expectation) -> Expectation
withRight e exp = either (const $ expectationFailure $ "Expected a Right, got: (" <> show e <> ")") exp e



-- ---------------------------------
-- -- === Isomorphism checker === --
-- ---------------------------------
--
-- -- === Definition === --
--
-- type IsomorphicCheckCtx m = (IsomorphicCheckReq m, MonadRef m)
-- type IsomorphicCheckReq m = Req m '[ Reader // Net   // '[AnyExpr, AnyExprLink]
--                                    , Reader // Layer // AnyExpr     // Model
--                                    , Reader // Layer // AnyExprLink // Model
--                                    ]
--
-- data ExprIsoChecker l = ExprIsoChecker { _isoPairs :: Set (Expr l, Expr l)
--                                        , _isoElems :: Set (Expr l)
--                                        } deriving (Show)
-- makeLenses ''ExprIsoChecker
--
--
-- -- === Utils === --
--
-- areExpressionsIsomorphic :: IsomorphicCheckCtx m => Expr Draft -> Expr Draft -> m Bool
-- areExpressionsIsomorphic l r = isJust <$> runMaybeT (checkIsoExpr def l r)
--
-- checkIsoLinks     :: IsomorphicCheckCtx m => ExprIsoChecker Draft -> ExprLink' Draft -> ExprLink' Draft   -> MaybeT m (ExprIsoChecker Draft)
-- checkManyIsoLinks :: IsomorphicCheckCtx m => ExprIsoChecker Draft -> [(ExprLink' Draft, ExprLink' Draft)] -> MaybeT m (ExprIsoChecker Draft)
-- checkIsoLinks iso le re = join $ liftA2 (checkIsoExpr iso) (source le) (source re)
-- checkManyIsoLinks       = foldM (uncurry . checkIsoLinks)
--
-- assumeIsomorphism :: Expr l -> Expr l -> ExprIsoChecker l -> Maybe (ExprIsoChecker l)
-- assumeIsomorphism e1 e2 iso = if_ unchecked $ Just (iso & isoPairs %~ Set.insert (e1, e2)) where
--     unchecked = nowhere e1 && nowhere e2
--     nowhere   = flip Set.notMember (iso ^. isoElems)
--
-- checkIsoPair :: Expr l -> Expr l -> ExprIsoChecker l -> Bool
-- checkIsoPair e1 e2 iso = Set.member (e1, e2) $ iso ^. isoPairs
--
-- checkIsoExpr, checkIsoExpr' :: IsomorphicCheckCtx m => ExprIsoChecker Draft -> Expr Draft -> Expr Draft -> MaybeT m (ExprIsoChecker Draft)
-- checkIsoExpr  iso l r = if checkIsoPair l r iso then return iso else checkIsoExpr' iso l r
-- checkIsoExpr' iso l r = do
--     assumption <- hoistMaybe $ assumeIsomorphism l r iso
--     match2 l r $ \x y -> case (x, y) of
--         (Number      a, Number  a'   ) -> guard (a == a') >> return assumption
--         (String      a, String  a'   ) -> guard (a == a') >> return assumption
--         (Var       v  , Var     v'   ) -> guard (v == v') >> return assumption
--         (Acc       a n, Acc     a' n') -> guard (n == n') >> checkIsoLinks     assumption a a'
--         (Cons      c s, Cons    c' s') -> guard (c == c') >> checkManyIsoLinks assumption (zip s s')
--         (App       f a, App     f' a') -> checkManyIsoLinks assumption [(f,f'), (a,a')]
--         (Unify     l r, Unify   l' r') -> checkManyIsoLinks assumption [(l,l'), (r,r')]
--         (Lam       a b, Lam     a' b') -> checkManyIsoLinks assumption [(a,a'), (b,b')]
--         (Grouped   a  , Grouped a'   ) -> checkIsoLinks assumption a a'
--         (Blank        , Blank        ) -> return assumption
--         (Missing      , Missing      ) -> return assumption
--         (Star         , Star         ) -> return assumption
--         (_, _)                         -> mzero
--
--
-- -- === Instances === --
--
-- instance Mempty  (ExprIsoChecker l) where mempty = def
-- instance Default (ExprIsoChecker l) where
--     def = ExprIsoChecker def def



-----------------------------
-- === Coherence check === --
-----------------------------

-- Accessing input edges

class Monad m => KnownLayerInputs a m where
    getLayerInputs :: SomeExpr -> m [SomeExprLink]
instance {-# OVERLAPPABLE #-} Monad m => KnownLayerInputs a m where
    getLayerInputs = const $ return []
instance (Monad m, MonadRef m, Reader Layer (AnyExpr // Model) m) => KnownLayerInputs (AnyExpr // Model) m where
    getLayerInputs = inputs
instance (Monad m, MonadRef m, Reader Layer (AnyExpr // Type) m) => KnownLayerInputs (AnyExpr // Type) m where
    getLayerInputs = fmap (: []) . getLayer @Type


class    Monad m => KnownLayersInputs (a :: [*]) m where
    getLayersInputs :: SomeExpr -> m [SomeExprLink]
instance Monad m => KnownLayersInputs '[]        m where
    getLayersInputs = const $ return []
instance (Monad m, KnownLayerInputs a m, KnownLayersInputs as m) => KnownLayersInputs (a ': as) m where
    getLayersInputs e = (++) <$> getLayerInputs @a e <*> getLayersInputs @as e



class Monad m => KnowsInputEdges m where
    getInputEdges :: SomeExpr -> m [SomeExprLink]
instance (Monad m, KnownLayersInputs (Inputs Layer pass) (SubPass pass m)) => KnowsInputEdges (SubPass pass m) where
    getInputEdges = getLayersInputs @(Inputs Layer pass)
instance KnowsInputEdges m => KnowsInputEdges (StateT s m) where
    getInputEdges = lift . getInputEdges

-- Coherence check

data IncoherenceType = DanglingSource
                     | DanglingTarget
                     | OrphanedSuccessor
                     | OrphanedInput
                     deriving (Show, Eq)

data Incoherence = Incoherence IncoherenceType SomeExpr SomeExprLink deriving (Show, Eq)

data CoherenceCheck = CoherenceCheck { _incoherences :: [Incoherence]
                                     , _allExprs     :: [SomeExpr]
                                     , _allLinks     :: [SomeExprLink]
                                     } deriving (Show)
makeLenses ''CoherenceCheck

type MonadCoherenceCheck m = (MonadState CoherenceCheck m, CoherenceCheckCtx m)
type CoherenceCheckCtx   m = (KnowsInputEdges m, MonadRef m, Readers Net '[AnyExpr, AnyExprLink] m, Readers Layer '[AnyExpr // Succs, AnyExprLink // Model] m)


checkCoherence :: CoherenceCheckCtx m => m [Incoherence]
checkCoherence = do
    es <- exprs
    ls <- links
    s <- flip execStateT (CoherenceCheck def es ls) $ do
        mapM_ checkExprCoherence es
        mapM_ checkLinkCoherence ls
    return $ s ^. incoherences

reportIncoherence :: MonadCoherenceCheck m => Incoherence -> m ()
reportIncoherence i = State.modify (incoherences %~ (i:))

checkExprCoherence :: MonadCoherenceCheck m => SomeExpr -> m ()
checkExprCoherence e = checkInputs e >> checkSuccs e

checkInputs :: MonadCoherenceCheck m => SomeExpr -> m ()
checkInputs e = do
    inps   <- getInputEdges e
    links  <- use allLinks
    forM_ inps $ \l -> do
        (_, tgt) <- getLayer @Model l
        when (tgt /= e || not (elem l links)) $ reportIncoherence $ Incoherence OrphanedInput e l

checkSuccs :: MonadCoherenceCheck m => SomeExpr -> m ()
checkSuccs e = do
    succs <- getLayer @Succs e
    links <- use allLinks
    forM_ (Set.toList succs) $ \l -> do
        (src, _) <- getLayer @Model l
        when (src /= e || not (elem l links)) $ reportIncoherence $ Incoherence OrphanedSuccessor e l

checkLinkCoherence :: MonadCoherenceCheck m => SomeExprLink -> m ()
checkLinkCoherence l = do
    (src, tgt) <- getLayer @Model l
    exprs <- use allExprs
    when (not $ elem src exprs) $ reportIncoherence $ Incoherence DanglingSource src l
    when (not $ elem tgt exprs) $ reportIncoherence $ Incoherence DanglingTarget tgt l
    checkIsSuccessor l src
    checkIsInput     l tgt

checkIsSuccessor :: MonadCoherenceCheck m => SomeExprLink -> SomeExpr -> m ()
checkIsSuccessor l e = do
    succs <- getLayer @Succs e
    when (Set.notMember l succs) $ reportIncoherence $ Incoherence DanglingSource e l

checkIsInput :: MonadCoherenceCheck m => SomeExprLink -> SomeExpr -> m ()
checkIsInput l e = do
    inputEdges <- getInputEdges e
    when (not $ elem l inputEdges) $ reportIncoherence $ Incoherence DanglingTarget e l



--------------------------------
-- === Reachability Check === --
--------------------------------

checkUnreachableExprs :: (MonadRef m, Reader Layer (AnyExpr // Model) m,
                          Reader Layer (AnyExprLink // Model) m,
                          Reader Net AnyExpr m,
                          Reader Layer (AnyExpr // Type) m)
                      => [SomeExpr] -> m [SomeExpr]
checkUnreachableExprs seeds = do
    allExprs <- Set.fromList <$> exprs
    reachable <- reachableExprs seeds
    return $ Set.toList $ Set.difference allExprs reachable

reachableExprs :: (MonadRef m, Reader Layer (AnyExpr // Model) m,
                  Reader Layer (AnyExprLink // Model) m,
                  Reader Layer (AnyExpr // Type) m) => [SomeExpr] -> m (Set SomeExpr)
reachableExprs seeds = Set.unions <$> mapM reachableExprs' seeds
    where
        {-reachableExprs' :: (MonadRef m, Reader Layer (AnyExpr // Model) m, Reader-}
                          {-Layer-}
                          {-AnyExprLink // Model)-}
                          {-m,-}
                          {-Reader Layer (AnyExpr // Type) m) => SomeExpr -> m (Set SomeExpr)-}
        reachableExprs' e = do
            t <- getLayer @Type e   >>= source
            set <- inputs e >>= mapM source >>= reachableExprs
            return $ Set.insert t $ Set.insert e $ set
