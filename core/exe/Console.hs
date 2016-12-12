{-# LANGUAGE UndecidableInstances #-}
{-# LANGUAGE NoOverloadedStrings  #-}
{-# LANGUAGE NoMonomorphismRestriction  #-}


module Main where


import qualified Data.ByteString.Lazy.Char8 as ByteString

import Luna.Prelude as Prelude hiding (String, cons, elem)
import Data.Aeson (encode)

import           Luna.IR
import qualified Luna.IR.Repr.Vis as Vis
import           Luna.IR.Repr.Vis (MonadVis)
import           Luna.Pass        (Pass, Inputs, Outputs, Events, Preserves)
import qualified Luna.Pass        as Pass
import           Luna.IR.Expr.Layout.Nested (type (>>))
import           Luna.IR.Expr.Layout.ENT (type (:>), type (#>), String')
import qualified Luna.IR.Expr.Layout.ENT as Layout

import Web.Browser (openBrowser )

import Luna.IR.Expr.Term.Class
import qualified Data.Set as Set
import Data.Set (Set)

import Control.Monad.State (MonadState, StateT, execStateT, get, put)
import qualified Control.Monad.State as State

import Data.RTuple (Assoc ((:=)))
import Luna.Pass.Manager as PM

import Data.Event as Event

import Data.Reflection

import Data.TypeVal
data A = A deriving (Show)








--
-- data ElemProxy s = ElemProxy Elem
-- makeWrapped ''ElemProxy

--
-- makePfxLenses ''DynamicElem
--
-- instance KnownType DynamicElem where typeVal = view dynamicElem_typeVal ; {-# INLINE typeVal #-}
-- -- instance IsElem    DynamicElem where elem    = dynamicElem_elem         ; {-# INLINE elem    #-}



-- foo :: KnownType a => a -> TypeVal
-- foo = typeVal
--
-- bar :: TypeVal -> TypeVal
-- bar = reifyKnownType foo
--



data Incoherence = DeteachedSource AnyExpr AnyExprLink
                 | OrphanLink      AnyExprLink
                 | OrphanExpr      AnyExpr
                 deriving (Show)

data CoherenceCheck = CoherenceCheck { _incoherences   :: [Incoherence]
                                     , _uncheckedLinks :: Set AnyExprLink
                                     , _orphanExprs    :: Set AnyExpr
                                     } deriving (Show)



makeLenses ''CoherenceCheck

finalize :: CoherenceCheck -> [Incoherence]
finalize s = s ^. incoherences <> (OrphanLink <$> Set.toList (s ^. uncheckedLinks)) <> (OrphanExpr <$> Set.toList (s ^. orphanExprs))


type MonadCoherenceCheck m = (MonadState CoherenceCheck m, CoherenceCheckCtx m)
type CoherenceCheckCtx   m = (IRMonad m, Readables m '[ExprLayer Model, ExprLayer Type, ExprLinkLayer Model, ExprNet, ExprLinkNet])

reportIncoherence :: MonadCoherenceCheck m => Incoherence -> m ()
reportIncoherence i = State.modify (incoherences %~ (i:))

markLinkChecked :: MonadCoherenceCheck m => AnyExprLink -> m ()
markLinkChecked a = State.modify (uncheckedLinks %~ (Set.delete a))

markExprChecked :: MonadCoherenceCheck m => AnyExpr -> m ()
markExprChecked a = State.modify (orphanExprs %~ (Set.delete a))



checkCoherence :: CoherenceCheckCtx m => m [Incoherence]
checkCoherence = do
    es <- exprs
    ls <- links
    s <- flip execStateT (CoherenceCheck def (Set.fromList ls) (Set.fromList es)) $ do
        mapM_ checkExprCoherence es
        mapM_ checkExprExistence ls
    return $ finalize s

checkExprExistence :: MonadCoherenceCheck m => AnyExprLink -> m ()
checkExprExistence lnk = do
    (_, tgt) <- readLayer @Model lnk
    markExprChecked tgt

checkExprCoherence :: MonadCoherenceCheck m => AnyExpr -> m ()
checkExprCoherence e = do
    tp <- readLayer @Type e
    checkLinkTarget e tp
    mapM_ (checkLinkTarget e) =<< symbolFields e


checkLinkTarget :: MonadCoherenceCheck m => AnyExpr -> AnyExprLink -> m ()
checkLinkTarget e lnk = do
    markLinkChecked lnk
    (_, tgt) <- readLayer @Model lnk
    when (e ^. idx /= tgt ^. idx) $ reportIncoherence (DeteachedSource e lnk)
--


class MonadPayload a m | m -> a where
    getPayload :: m a





data WorkingElem = WorkingElem deriving (Show)

data ELEMPASS c t
data ElemPass c t
type instance Abstract (ElemPass c t) = ELEMPASS (Abstract c) (Abstract t)

data InitUID
type instance Abstract InitUID = InitUID
type instance Args      (ElemPass p t) = Elem t
type instance Inputs    (ElemPass InitUID t) = '[Attr WorkingElem, Layer (Abstract t) UID]
type instance Outputs   (ElemPass InitUID t) = '[Attr WorkingElem, Layer (Abstract t) UID]
type instance Events    (ElemPass InitUID t) = '[]
type instance Preserves (ElemPass InitUID t) = '[]
initUID :: forall t m. (MonadIO m, IRMonad m) => Pass (ElemPass InitUID t) m
initUID = do
    t <- readAttr @WorkingElem
    print t
    -- flip (writeLayer @UID) t =<< getNewUID
    print "hello"

-- initUID2 :: forall t m. (MonadIO m, IRMonad m) => ArgPass (ElemPass InitUID t) m
-- initUID2 t = do
--     -- t <- readAttr @WorkingElem -- FIXME[WD]: parametr z Passu!
--     -- print t
--     -- writeLayer @UID 0 t
--     print "hello"


type family PassAttr attr pass

type instance KeyData (Pass.SubPass pass m) (Attr a) = PassAttr a pass


type instance PassAttr WorkingElem (ElemPass p t) = Elem t

-- newtype ElemPassass m = ElemPassass (forall t. IsElem t => Pass (InitUID t) m)
--
-- cp :: (MonadIO m, IRMonad m) => ElemPassass m
-- cp = ElemPassass initUID

-- type instance Abstract (TypeRef s) = TypeRef s

data Abstracted a

-- reifyKnownTypeT :: forall r. (forall s. TypeReify (Abstracted s) => TypeProxy s -> r) -> TypeVal -> r
-- reifyKnownTypeT f a = reify a $ f . reproxyTypeRef ; {-# INLINE reifyKnownTypeT #-}



-- type instance Abstract (TypeRef s) = TypeRef (Abstracted s)

type instance Abstract (TypeRef s) = TypeRef (Abstracted s)
uu2 :: MonadIO m => m ()
uu2 = reifyKnownTypeT @Abstracted uu (typeVal' @A)

uu :: forall t m proxy. proxy t -> (KnownType (Abstract t), MonadIO m) => m ()
uu p = do
    print $ typeVal'_ @(Abstract t)


data Simplex a
instance Reifies s a => Reifies (Simplex s) a where
    reflect _ = reflect (Proxy :: Proxy s) ; {-# INLINE reflect #-}

-- class Reifies s a | s -> a where
--   -- | Recover a value inside a 'reify' context, given a proxy for its
--   -- reified type.
--   reflect :: proxy s -> a


data B = B deriving (Show)

-- main = do
--     let x = typeVal' @A
--     uu2
--     print $ reifyKnownType (\p -> typeVal_ p) x
--     print "hello"

ttt2 :: (IRMonad m, MonadIO m, MonadPassManager m) => TypeRep -> Pass.DynPass m
ttt2 = reifyKnownTypeT @Abstracted ttt

ttt :: forall t m. ( KnownType (Abstract t)
                   , IRMonad m, MonadIO m, MonadPassManager m) => Proxy t -> Pass.DynPass m
ttt _ = Pass.compile (initUID :: Pass (ElemPass InitUID t) m)

data                    SimpleAA
type instance Abstract  SimpleAA = SimpleAA
type instance Inputs    SimpleAA = '[ExprNet] <> ExprLayers '[UID] <> ExprLinkLayers '[]
type instance Outputs   SimpleAA = '[ExprNet] <> ExprLayers '[UID] <> ExprLinkLayers '[]
type instance Events    SimpleAA = '[NEW // EXPR]
type instance Preserves SimpleAA = '[]

pass1 :: (MonadFix m, MonadIO m, IRMonad m, MonadVis m, MonadPassManager m) => Pass SimpleAA m
pass1 = gen_pass1


attachLayer l e = attachLayerIR l e >> attachLayerPM l e

test_pass1 :: (MonadIO m, MonadFix m, PrimMonad m, MonadVis m) => m (Either Pass.InternalError ())
test_pass1 = evalIRBuilder' $ evalPassManager' $ do
    runRegs

    -- writeAttr @WorkingElem (unsafeCoerce (0 :: Int))
    registerLayer (typeVal' @UID) ttt2
    attachLayer   (typeVal' @UID) (typeVal' @EXPR)

    -- addEventListener (NEW // EXPR) $ (undefined :: Pass.DynPass m)
    -- print =<< PM.get

    -- addEventListener (NEW // EXPR) $ initUID @(AnyExpr)
    hackySetAttr (typeVal' @WorkingElem) (unsafeCoerce (1 :: Int))
    Pass.eval' pass1

-- hackySetAttr :: MonadPassManager m => AttrRep -> Prim.AnyData -> m ()


-- registerLayer :: MonadPassManager m => LayerRep -> (forall t. Pass (ElemPass pass t) m') -> m ()




uncheckedDeleteStar :: (IRMonad m, Readable (ExprLayer Type) m, Accessibles m '[ExprLinkNet, ExprNet]) => Expr l -> m ()
uncheckedDeleteStar e = do
    delete =<< readLayer @Type e
    delete e
{-# INLINE uncheckedDeleteStar #-}

uncheckedDeleteStarType :: (IRMonad m, Readable (ExprLayer Type) m, Accessibles m '[ExprLinkNet, ExprNet, ExprLinkLayer Model])
                        => Expr l -> m ()
uncheckedDeleteStarType e = do
    typeLink     <- readLayer @Type e
    (oldStar, _) <- readLayer @Model typeLink
    uncheckedDeleteStar oldStar
    delete typeLink
{-# INLINE uncheckedDeleteStarType #-}



instance (Monad m, Event.FromPath e, m ~ GetBaseMonad n) => KeyMonad (Event e) (PassManager m) n where
    uncheckedLookupKey = Just . Key . fixme1 . sequence . fmap Pass.eval <$> PM.queryListeners (Event.fromPath @e)
    -- FIXME[WD]: Pass.eval and sequence_ just hide error if some keys were not found

fixme1 :: Monad m => m [Either Pass.InternalError ()] -> m ()
fixme1 m = fromRight =<< (sequence <$> m)
fromRight (Right a) = return ()
fromRight (Left e) = error $ show e
-- queryListeners :: MonadPassManager m => Event.Tag -> m [Event.Listener (PMPass' m)]
-- type PMPass m = DynPass (PassManager m)
-- type PMPass' m = DynPass (PassManager (GetManagerMonad m))


gen_pass1 :: ( MonadIO m, IRMonad m, MonadVis m
            --  , Accessibles m '[ExprLayer Model, ExprLinkLayer Model, ExprLayer Type, ExprLinkLayer UID, ExprLayer UID, ExprNet, ExprLinkNet, ExprGroupNet, Attr MyData]
             , Accessibles m '[ExprNet, ExprLayer UID], Emitter m (NEW // EXPR)
             ) => m ()
gen_pass1 = do
    (s :: Expr Star) <- star
    (s :: Expr Star) <- star
    (s :: Expr Star) <- star
    (s :: Expr Star) <- star
    print s

    -- i <- readLayer @UID s
    -- print i


    -- let h  = def :: ListenerHub IO
    --     h2 = h & space (Tag [typeVal' @Int, typeVal' @Char, typeVal' @Bool]) .~ Just def
    --     h3 = h2 & space (Tag [typeVal' @Int, typeVal' @Char]) .~ Nothing
    --
    -- print h2
    -- print "---"
    -- print h3
    -- Str constructor
    -- (strName :: Expr String) <- rawString "String"
    -- (strCons :: Expr (Cons #> String)) <- cons strName
    -- Vis.snapshot "s1"
    -- let strCons' = unsafeRelayout strCons :: Expr Layout.Cons'
    --     strName' = unsafeRelayout strName :: Expr String'
    -- newTypeLink <- link strCons' strName'
    -- uncheckedDeleteStarType strName'
    -- writeLayer @Type newTypeLink strName'
    -- Vis.snapshot "s2"
    --
    -- let string s = do
    --         foo <- rawString s
    --         let foo' = unsafeRelayout foo :: Expr String'
    --         ftlink <- link strCons' foo'
    --         uncheckedDeleteStarType foo'
    --         writeLayer @Type ftlink foo'
    --         return foo'
    --
    -- s1 <- string "s1"
    -- s2 <- string "s2"
    -- s3 <- string "s3"
    --
    -- g <- group [s1,s2,s3]
    -- print g
    --
    -- (v :: Expr $ Var #> String') <- var s1
    --
    -- let v' :: Expr Draft
    --     v' = generalize v
    --
    -- -- (u :: Expr (Unify >> Phrase >> NT String' (Value >> ENT Int String' Star))) <- unify s2 v
    -- (u :: Expr (Unify >> Phrase >> NT String' (Value >> ENT Star String' Star))) <- unify s2 v
    --
    -- (u' :: Expr (Unify >> Draft)) <- unify v' v'
    --
    -- print =<< checkCoherence
    -- Vis.snapshot "s4"



    -- (a :: Expr Int Star)) <- var aName
    -- b <- var "b"

    -- (u :: Expr (ENT _ _ _)) <- unify a b
    -- -- (f :: Expr (ENT Star Star Star)) <- acc "f" u
    --
    --
    --
    -- -- Vis.snapshot "s3"
    -- d <- readLayer @Type u
    -- print d
    --
    --
    -- md <- readAttr @MyData
    -- print md
    --
    -- ts <- exprs
    -- print ts
    --
    -- match s $ \case
    --     Unify l r -> print "ppp"
    --     Star      -> match s $ \case
    --         Unify l r -> print "hola"
    --         Star      -> print "hellox"
    --
    -- print "---"
    --
    --
    -- match a $ \ (Var l) -> do
    --     n <- source l
    --     match n $ \case
    --         String s -> print s
    --
    -- v <- var "ala"
    -- n <- strName v
    -- (s3 :: Expr (ENT Draft String Draft)) <- generalize <$> star
    -- (v3 :: Expr (ENT Draft String Draft)) <- generalize <$> var "lel"
    -- match v3 $ \(Var l) -> do
    --     print "IT'S VAR"
    --     n' <- source l
    --     n  <- match n' $ \case
    --         String s -> return s
    --     print n
    --
    -- print n

    return ()



main :: IO ()
main = do
    (p, vis) <- Vis.newRunDiffT test_pass1
    case p of
        Left e -> do
            print "* INTERNAL ERROR *"
            print e
        Right _ -> do
            let cfg = ByteString.unpack $ encode $ vis
            -- putStrLn cfg
            -- liftIO $ openBrowser ("http://localhost:8000?cfg=" <> cfg)
            return ()
    print p
    return ()
