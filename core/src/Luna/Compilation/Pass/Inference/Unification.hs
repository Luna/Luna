{-# LANGUAGE NoMonomorphismRestriction #-}
{-# LANGUAGE CPP                       #-}
{-# LANGUAGE UndecidableInstances      #-}

module Luna.Compilation.Pass.Inference.Unification where

import Prelude.Luna

import Data.Container                               hiding (impossible)
import Data.List                                    (delete, sort, groupBy)
import Old.Data.Prop
import qualified Data.Record                        as Record
import Data.Record                                  (caseTest, of', ANY (..))
import Luna.Runtime.Dynamics                      (Static)
import Old.Luna.Syntax.Term.Class                         hiding (source, target)
import Data.Graph.Builder                           hiding (run)
import Luna.Syntax.Model.Layer
import Luna.Syntax.Model.Network.Builder.Node
import Luna.Syntax.Model.Network.Builder            (HasSuccs, TCData, TCDataPayload, requester, tcErrors, depth, Sign (..), originSign, replaceNode)
import Luna.Syntax.Model.Network.Class              ()
import Luna.Syntax.Model.Network.Term
import Luna.Syntax.Name.Ident.Pool                  (MonadIdentPool)
import Data.Graph                                   as Graph hiding (add, remove)
import qualified Data.Graph.Backend.NEC               as NEC

import           Luna.Compilation.Stage.TypeCheck       (ProgressStatus (..), TypeCheckerPass, hasJobs, runTCPass)
import           Luna.Compilation.Stage.TypeCheck.Class (MonadTypeCheck)
import qualified Luna.Compilation.Stage.TypeCheck.Class as TypeCheck
import qualified Old.Luna.Syntax.Term.Expr.Lit               as Lit
import           Luna.Compilation.Error

import Control.Monad.Trans.Either
import Data.Layer_OLD.Cover_OLD


#define PassCtx(m,ls,term) ( term  ~ Draft Static                  \
                           , node  ~ (ls :<: term)                 \
                           , edge  ~ Link node                     \
                           , graph ~ Hetero (NEC.Graph n e c)      \
                           , Covered node                          \
                           , nodeRef ~ Ref Node node               \
                           , Prop Type   node ~ Ref Edge edge      \
                           , Prop TCData node ~ TCDataPayload node \
                           , HasSuccs node                         \
                           , BiCastable     e edge                 \
                           , BiCastable     n node                 \
                           , MonadBuilder graph (m)                \
                           , HasProp Type       node               \
                           , HasProp TCData     node               \
                           , NodeInferable  (m) node               \
                           , TermNode Var   (m) node               \
                           , TermNode Lam   (m) node               \
                           , TermNode Unify (m) node               \
                           , TermNode Acc   (m) node               \
                           , TermNode Cons  (m) node               \
                           , MonadIdentPool (m)                    \
                           , Destructor     (m) (Ref Node node)    \
                           , Destructor     (m) (Ref Edge edge)    \
                           , MonadTypeCheck node (m)               \
                           , ReferencedM Node graph (m) node       \
                           , ReferencedM Edge graph (m) edge       \
                           , MonadIO (m) \
                           )

-------------------------
-- === ResolutionT === --
-------------------------

class Monad m => MonadResolution r m | m -> r where
    resolve :: r -> m ()

newtype ResolutionT r m u = ResolutionT (EitherT r m u) deriving (Functor, Applicative, Monad, MonadFix, MonadIO, MonadTrans)
makeWrapped ''ResolutionT

-- === Utils === --

runResolutionT :: Monad m => ResolutionT r m u -> m (Resolution r u)
runResolutionT m = runEitherT (unwrap' m) >>= return ∘ \case
    Left  l -> Resolved   l
    Right r -> Unresolved r


---- === Instances === --

---- Show
deriving instance Show (Unwrapped (ResolutionT r m u)) => Show (ResolutionT r m u)

---- MonadResolution

instance Monad m => MonadResolution r (ResolutionT r m) where
    resolve = wrap' ∘ left
    {-# INLINE resolve #-}

data Resolution r u = Resolved   r
                    | Unresolved u
                    deriving (Show)



-- Primitive
instance PrimMonad m => PrimMonad (ResolutionT r m) where
    type PrimState (ResolutionT r m) = PrimState m
    primitive = lift . primitive
    {-# INLINE primitive #-}



------------------
-- === Pass === --
------------------

resolve_ :: MonadResolution [t] m => m ()
resolve_ = resolve []

resolveUnify :: forall m ls term node edge graph nodeRef n e c. (PassCtx(m,ls,term),
                MonadResolution [nodeRef] m)
             => nodeRef -> m ()
resolveUnify uni = do
    uni' <- read uni
    caseTest (uncover uni') $ do
        of' $ \(Unify lc rc) -> do
            l  <- follow source lc
            r  <- follow source rc

            resolveReflexivity uni l r
            symmetrical (resolveStar uni) l r
            symmetrical (resolveVar  uni) l r
            symmetrical (resolveLams uni) l r
            resolveCons uni l r

        of' $ \ANY -> impossible

    where symmetrical f a b = f a b *> f b a
          reportError uni = do
              req <- mapM (follow source) =<< follow (prop TCData . requester) uni
              case req of
                  Just r  -> withRef r $ prop TCData . tcErrors %~ (UnificationError uni :)
                  Nothing -> return ()
              resolve_

          resolveReflexivity uni (a :: nodeRef) (b :: nodeRef) = do
              if a == b
                  then do
                      replaceNode uni a
                      resolve_
                  else return ()

          resolveCons uni a b = do
              uni' <- read uni
              a'   <- read (a :: nodeRef)
              b'   <- read (b :: nodeRef)
              whenMatched (uncover a') $ \(Cons na argsA) ->
                  whenMatched (uncover b') $ \(Cons nb argsB) ->
                      if na == nb && length argsA == length argsB
                          then do
                              asA <- mapM (follow source . unlayer) argsA
                              asB <- mapM (follow source . unlayer) argsB
                              req <- mapM (follow source) =<< follow (prop TCData . requester) uni
                              sgn <- follow (prop TCData . originSign) uni
                              newUnis <- zipWithM unify asA asB
                              uniCons <- cons na $ arg <$> newUnis
                              replaceNode uni uniCons
                              mapM (flip (reconnect $ prop TCData . requester) req) newUnis
                              mapM (flip withRef $ prop TCData . originSign .~ sgn) newUnis
                              resolve newUnis
                          else reportError uni

          resolveStar uni a b = do
              uni' <- read uni
              a'   <- read (a :: nodeRef)
              whenMatched (uncover a') $ \Lit.Star -> do
                  replaceNode uni b
                  resolve_

          resolveVar uni a b = do
              a'   <- read (a :: nodeRef)
              whenMatched (uncover a') $ \(Var v) -> do
                  replaceNode uni b
                  replaceNode a   b
                  resolve_

          resolveLams uni a b = do
              uni' <- read uni
              a'   <- read (a :: nodeRef)
              b'   <- read (b :: nodeRef)
              whenMatched (uncover a') $ \(Lam cargs cout) -> do
                  whenMatched (uncover b') $ \(Cons _ _) -> reportError uni
                  whenMatched (uncover b') $ \(Lam cargs' cout') -> do
                      let cRawArgs  = unlayer <$> cargs
                      let cRawArgs' = unlayer <$> cargs'
                      args  <- mapM (follow source) cRawArgs
                      out   <- follow source cout
                      args' <- mapM (follow source) cRawArgs'
                      out'  <- follow source cout'
                      req   <- mapM (follow source) =<< follow (prop TCData . requester) uni
                      unis <- if length args == length args'
                          then do
                              argUnis <- zipWithM unify args args'
                              outUni  <- unify out out'
                              let unis = outUni : argUnis
                              replaceNode uni a
                              replaceNode b   a
                              return $ outUni : argUnis
                          else do
                              let l  = (args,  out)
                                  l' = (args', out')
                                  ((shortArgs, shortOut), (longArgs, longOut)) = if length args < length args' then (l, l') else (l', l)
                              argUnis <- zipWithM unify args args'
                              newLam  <- lam (arg <$> drop (length shortArgs) longArgs) longOut
                              outUni  <- unify shortOut newLam
                              replaceNode uni a
                              return $ outUni : argUnis
                      mapM (flip (reconnect $ prop TCData . requester) req) unis
                      resolve unis



replaceAny :: forall m ls term node edge graph nodeRef n e c. PassCtx(m,ls,term) => nodeRef -> nodeRef -> m nodeRef
replaceAny r1 r2 = do
    n1 <- read r1
    n2 <- read r2
    if size (n1 # Succs) > size (n2 # Succs)
        then replaceNode r2 r1 >> return r1
        else replaceNode r1 r2 >> return r2

whenMatched a f = caseTest a $ do
    of' f
    of' $ \ANY -> return ()

run :: forall m ls term node edge graph nodeRef n e c.
       ( PassCtx(ResolutionT [nodeRef] m,ls,term)
       , MonadBuilder (Hetero (NEC.Graph n e c)) m
       ) => [nodeRef] -> m [Resolution [nodeRef] nodeRef]
run unis = forM unis $ \u -> fmap (getOutstandingUnifies u) $ runResolutionT $ resolveUnify u


universe = Ptr 0

getOutstandingUnifies uni = \case
    Resolved unis -> Resolved   unis
    Unresolved _  -> Unresolved uni


catUnresolved [] = []
catUnresolved (a : as) = ($ (catUnresolved as)) $ case a of
    Resolved   _ -> id
    Unresolved u -> (u :)

catResolved [] = []
catResolved (a : as) = ($ (catResolved as)) $ case a of
    Unresolved _ -> id
    Resolved   r -> (r :)

isResolved (Resolved _) = True
isResolved _ = False

getRequesterDepth :: PassCtx(m, ls, term) => nodeRef -> m (Maybe Int)
getRequesterDepth ref = do
    req <- follow (prop TCData . requester) ref
    case req of
        Just e  -> follow source e >>= follow (prop TCData . depth)
        Nothing -> return Nothing

sortByDeps :: PassCtx(m, ls, term) => [nodeRef] -> m [[nodeRef]]
sortByDeps unis = do
    reqDeps <- mapM getRequesterDepth unis
    return $ (fmap . fmap) snd $ groupBy (\(a, _) (b, _) -> a == b) $ sort $ zip reqDeps unis

-----------------------------
-- === TypeCheckerPass === --
-----------------------------


data StrictUnificationPass = StrictUnificationPass Sign Bool deriving (Show, Eq)

instance ( PassCtx(ResolutionT [nodeRef] m,ls,term)
         , MonadBuilder (Hetero (NEC.Graph n e c)) m
         , PassCtx(m, ls, term)
         , MonadTypeCheck (ls :<: term) m
         ) => TypeCheckerPass StrictUnificationPass m where
    hasJobs (StrictUnificationPass sign _) = do
        unresolved <- view TypeCheck.unresolvedUnis <$> TypeCheck.get
        properSign <- filterM (fmap ((==) sign) . follow (prop TCData . originSign)) unresolved
        return . not . null $ properSign

    runTCPass (StrictUnificationPass sign singleDepth) = do
        unresolved    <- view TypeCheck.unresolvedUnis <$> TypeCheck.get
        (unis, retry) <- partitionM (fmap ((==) sign) . follow (prop TCData . originSign)) unresolved
        sortedUnis    <- sortByDeps unis
        let (todo, toRetry) = case (singleDepth, sortedUnis) of
                (True, (x : xs)) -> (concat sortedUnis, retry) -- JUST ONE PLZ
                (_, _) -> (concat sortedUnis, retry)
        results <- run todo
        let newUnis = catUnresolved results ++ (concat $ catResolved results) ++ toRetry
        TypeCheck.modify_ $ (TypeCheck.uncheckedUnis  .~ [])
                          . (TypeCheck.unresolvedUnis .~ newUnis)
        case catResolved results of
            [] -> return Stuck
            _  -> return Progressed
