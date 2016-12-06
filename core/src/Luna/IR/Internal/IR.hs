{-# LANGUAGE UndecidableSuperClasses #-}
{-# LANGUAGE GADTs                   #-}
{-# LANGUAGE UndecidableInstances    #-}

module Luna.IR.Internal.IR where

import           Old.Data.Record              (Encode2)
import           Old.Data.Record.Model.Masked as X (VGRecord2, Store2(Store2), Slot(Slot), Enum(Enum))
import           Old.Data.Record.Model.Masked (encode2, EncodeStore, encodeStore, Mask, encodeNat, encodeData2, checkData2, decodeData2, Raw(Raw), unsafeRestore, decodeNat)

import           Luna.Prelude                 hiding (elem {- fix: -} , Enum)
import qualified Luna.Prelude as Prelude

import Control.Monad.State  (StateT, runStateT)
import Luna.IR.Internal.LayerStore (LayerStoreRef, LayerStoreRefM, LayerStore)
import Data.Map             (Map)
import Data.Property
import Data.RTuple          (TMap(..), empty, Assoc(..), Assocs, (:=:)) -- refactor empty to another library
import Data.Typeable        (Typeable, TypeRep)
import GHC.Prim             (Any)
import Luna.IR.Layer
import Luna.IR.Layer.Model
import Luna.IR.Expr.Atom    (Atom, Atoms, AtomRep, atomRep, AtomOf)
import qualified Luna.IR.Expr.Atom as A
import Luna.IR.Expr.Format  (Format, Draft)
import Luna.IR.Expr.Layout  (LAYOUT, LayoutOf, NAME, Generalizable, Universal, universal, Abstract, Sub)
import Luna.IR.Expr.Term    (TERM, Term, UncheckedFromTerm, FromTerm, UniTerm, IsUniTerm, uniTerm)
import Type.Container       (Every)
import Type.Container       (In)
import Type.Maybe           (FromJust)
import Type.Error
import Unsafe.Coerce        (unsafeCoerce)

import qualified Control.Monad.State       as State
import qualified Luna.IR.Internal.LayerStore as Store
import qualified Data.Map                  as Map
import           Data.Set                  (Set)
import qualified Data.Set                  as Set
import qualified Data.Typeable             as Typeable -- FIXME
import qualified Luna.IR.Expr.Layout       as Layout
import qualified Luna.IR.Expr.Term.Class   as N
import           Luna.IR.Expr.Term.Class   (InputsType, HasInputs, inputList)
import qualified Type.List                 as List

import Luna.IR.Expr.Term.Uni ()
import Type.Inference




type Typeables ts = Constraints $ Typeable <$> ts



class IsIdx t where
    idx :: Iso' t Int
    default idx :: (Wrapped t, Unwrapped t ~ Int) => Lens' t Int
    idx = wrapped' ; {-# INLINE idx #-}


------------------
-- === Elem === --
------------------

newtype Elem = Elem Int deriving (Show, Ord, Eq)
makeWrapped '' Elem

class IsElem a where
    elem :: Iso' a Elem
    default elem :: (Wrapped a, Unwrapped a ~ Elem) => Iso' a Elem
    elem = wrapped' ; {-# INLINE elem #-}

instance IsIdx Elem where
    idx = wrapped' ; {-# INLINE idx #-}



------------------
-- === Keys === --
------------------

--- === Definition === --

newtype Key  s k = Key (KeyData s k)
type    KeyM m   = Key (PrimState m)

type family KeyData  s key
type        KeyDataM m key = KeyData (PrimState m) key

makeWrapped '' Key


-- === Key Monad === --

class Monad m => KeyMonad key m where
    uncheckedLookupKey :: m (Maybe (KeyM m key))


-- === Construction === --

readKey :: forall k m. Monad m => KeyM m k -> m (KeyDataM m k)
readKey = return . unwrap' ; {-# INLINE readKey #-}

writeKey :: forall k m. Monad m => KeyDataM m k -> m (KeyM m k)
writeKey = return . wrap' ; {-# INLINE writeKey #-}


-- === Key access === --

type Accessible k m = (Readable k m, Writable k m)
type TransST    t m = (MonadTrans t, Monad (t m), PrimState (t m) ~ PrimState m)

-- Readable
class    Monad m                                => Readable k m     where getKey :: m (KeyM m k)
instance {-# OVERLAPPABLE #-} SubReadable k t m => Readable k (t m) where getKey = lift getKey ; {-# INLINE getKey #-}
type SubReadable k t m = (Readable k m, TransST t m)

-- Writable
class    Monad m                                => Writable k m     where putKey :: KeyM m k -> m ()
instance {-# OVERLAPPABLE #-} SubWritable k t m => Writable k (t m) where putKey = lift . putKey ; {-# INLINE putKey #-}
type SubWritable k t m = (Writable k m, TransST t m)


readComp :: forall k m. Readable k m => m (KeyDataM m k)
readComp = readKey =<< getKey @k ; {-# INLINE readComp #-}

writeComp :: forall k m. Writable k m => KeyDataM m k -> m ()
writeComp = putKey @k <=< writeKey ; {-# INLINE writeComp #-}


-- === Errors === --

type KeyAccessError action k = Sentence $ ErrMsg "Key"
                                    :</>: Ticked ('ShowType k)
                                    :</>: ErrMsg "is not"
                                    :</>: (ErrMsg action :<>: ErrMsg "able")

type KeyMissingError k = Sentence $ ErrMsg "Key"
                              :</>: Ticked ('ShowType k)
                              :</>: ErrMsg "is not accessible"

type KeyReadError  k = KeyAccessError "read"  k
type KeyWriteError k = KeyAccessError "write" k



---------------------
-- === IRStore === --
---------------------

-- === Definition === --

type LayerRep = TypeRep
type ElemRep  = TypeRep

type    IR     = IR'   ElemStore
type    IRST s = IR'  (ElemStoreST s)
type    IRM  m = IRST (PrimState   m)
newtype IR'  a = IR   (Map ElemRep a) deriving (Show, Default, Functor, Traversable, Foldable)

                            --  , _attrs :: Map LayerRep Any
                            --  }
                             --  , _genericLayers :: LayerConsStore m

-- data ElemStoreOld m = ElemStoreOld { _layerValues   :: ElemStoreM m
--                             --  , _elemLayers    :: LayerConsStore m
--                              }

type LayerSet    s = Store.VectorRef s Any
type ElemStore     = LayerStore      LayerRep Any
type ElemStoreST s = LayerStoreRef s LayerRep Any
type ElemStoreM  m = ElemStoreST (PrimState m)

type LayerConsStore m = Map LayerRep (AnyCons m)

-- makeLenses ''ElemStoreOld
makeWrapped ''IR'


-- === Accessors === --

-- specificLayers :: ElemRep -> Traversal' (IRM m) (LayerConsStore m)
-- specificLayers el = wrapped' . ix el . elemLayers ; {-# INLINE specificLayers #-}

-- emptyElemStoreOld :: PrimMonad m => m (ElemStoreOld m)
-- emptyElemStoreOld = ElemStoreOld <$> Store.empty -- <*> pure def ; {-# INLINE emptyElemStoreOld #-}


-- === Instances === --

-- instance Default (IRM m) where def = IRM def def

-- === Mutability === --

unsafeFreeze :: PrimMonad m => IRM m -> m IR
freeze       :: PrimMonad m => IRM m -> m IR
unsafeFreeze = mapM Store.unsafeFreeze ; {-# INLINE unsafeFreeze #-}
freeze       = mapM Store.freeze       ; {-# INLINE freeze       #-}

unsafeThaw :: PrimMonad m => IR -> m (IRM m)
thaw       :: PrimMonad m => IR -> m (IRM m)
unsafeThaw = mapM Store.unsafeThaw ; {-# INLINE unsafeThaw #-}
thaw       = mapM Store.thaw       ; {-# INLINE thaw       #-}


-----------------------
-- === IRBuilder === --
-----------------------

-- === Definition === --

newtype IRBuilder m a = IRBuilder (StateT (IRBuilderState m) m a) deriving (Functor, Applicative, Monad, MonadIO, MonadFix)
type IRBuilderState m = IRM (IRBuilder m)
makeWrapped ''IRBuilder

type IRM' m = IRM (GetIRBuilder m)
type        GetIRBuilder      m = IRBuilder (GetIRBuilderMonad m)
type family GetIRBuilderMonad m where
            GetIRBuilderMonad (IRBuilder m) = m
            GetIRBuilderMonad (t   m) = GetIRBuilderMonad m


-- === Accessors === --

atElem :: Functor m => ElemRep -> (Maybe (ElemStoreM m) -> m (Maybe (ElemStoreM m))) -> IRM m -> m (IRM m)
atElem = wrapped' .: at  ; {-# INLINE atElem #-}

modifyElem  :: PrimMonad m => ElemRep -> (ElemStoreM m ->    ElemStoreM m)  -> IRM m -> m (IRM m)
modifyElemM :: PrimMonad m => ElemRep -> (ElemStoreM m -> m (ElemStoreM m)) -> IRM m -> m (IRM m)
modifyElem  e   = modifyElemM e . fmap return                                                  ; {-# INLINE modifyElem  #-}
modifyElemM e f = atElem e $ \es -> fmap Just $ f =<< fromMaybe (Store.empty) (fmap return es) ; {-# INLINE modifyElemM #-}


-- | The type `t` is not validated in any way, it is just constructed from index.
uncheckedElems :: forall t m. (IRMonad m, IsElem t, Readable (Net (Abstract t)) m) => m [t]
uncheckedElems = fmap (view (from $ elem . idx)) <$> (Store.ixes =<< readNet @(Abstract t)) ; {-# INLINE uncheckedElems #-}


-- === Querying === --
--
-- lookupGenericLayerCons :: LayerRep -> IRM m -> Maybe (AnyCons m)
-- lookupGenericLayerCons l s = s ^? genericLayers . ix l ; {-# INLINE lookupGenericLayerCons #-}
--
-- lookupSpecificLayerCons :: ElemRep -> LayerRep -> IRM m -> Maybe (AnyCons m)
-- lookupSpecificLayerCons el l s = s ^? specificLayers el . ix l ; {-# INLINE lookupSpecificLayerCons #-}
--
-- lookupLayerCons :: ElemRep -> LayerRep -> IRM m -> Maybe (AnyCons m)
-- lookupLayerCons el l s = lookupSpecificLayerCons el l s <|> lookupGenericLayerCons l s ; {-# INLINE lookupLayerCons #-}
--
-- lookupLayerCons' :: ElemRep -> LayerRep -> IRM m -> AnyCons m
-- lookupLayerCons' el l = fromMaybe (error $ "Fatal error " <> show el <> " " <> show l) . lookupLayerCons el l ; {-# INLINE lookupLayerCons' #-}


-- === Construction === --

newMagicElem :: forall t m. (IRMonad m, Typeable (Abstract t), PrimMonad (GetIRBuilder m), IsElem t) => Definition t -> m t
newMagicElem tdef = do
    irstate    <- getIR

    -- FIXME[WD]: how can we design it better?
    -- hacky, manual index reservation in order not to use keys for magic star
    let trep = typeRep' @(Abstract t)
        Just layerStore = irstate ^? wrapped'  . ix trep
    newIdx <- runByIRBuilder $ Store.reserveIdx layerStore


    let el = newIdx ^. from (elem . idx)
    --     consLayer (layer, store) = runByIRBuilder $ do
    --         let consFunc = lookupLayerCons' (typeRep' @(Abstract t)) layer irstate
    --         Store.unsafeWrite store newIdx =<< unsafeAppCons consFunc el tdef
    -- mapM_ consLayer =<< Store.assocs layerStore
    return el
{-# INLINE newMagicElem #-}

newElem :: forall t m. (IRMonad m, Accessible (Net (Abstract t)) m, IsElem t, Typeable (Abstract t)) => Definition t -> m t
newElem tdef = do
    irstate    <- getIR
    newIdx     <- reserveNewElemIdx @t
    layerStore <- readComp @(Net (Abstract t))
    let el = newIdx ^. from (elem . idx)
    --     consLayer (layer, store) = runByIRBuilder $ do
    --         let consFunc = lookupLayerCons' (typeRep' @(Abstract t)) layer irstate
    --         Store.unsafeWrite store newIdx =<< unsafeAppCons consFunc el tdef
    -- mapM_ consLayer =<< Store.assocs layerStore
    return el
{-# INLINE newElem #-}


delete :: forall t m. (IRMonad m, IsElem t, Accessible (Net (Abstract t)) m) => t -> m ()
delete t = runByIRBuilder . flip Store.freeIdx (t ^. elem . idx) =<< readComp @(Net (Abstract t)) ; {-# INLINE delete #-}

reserveNewElemIdx :: forall t m. (IRMonad m, Accessible (Net (Abstract t)) m) => m Int
reserveNewElemIdx = runByIRBuilder . Store.reserveIdx =<< readComp @(Net (Abstract t)) ; {-# INLINE reserveNewElemIdx #-}

readLayerByKey :: (IRMonad m, IsElem t) => KeyM m (Layer (Abstract t) layer) -> t -> m (LayerData layer t)
readLayerByKey key t = unsafeCoerce <$> runByIRBuilder (Store.unsafeRead (t ^. elem . idx) =<< readKey key) ; {-# INLINE readLayerByKey #-}

writeLayerByKey :: (IRMonad m, IsElem t) => KeyM m (Layer (Abstract t) layer) -> LayerData layer t -> t -> m ()
writeLayerByKey key val t = (\v -> Store.unsafeWrite v (t ^. elem . idx) $ unsafeCoerce val) =<< readKey key ; {-# INLINE writeLayerByKey #-}

readLayer :: forall layer t m. (IRMonad m, IsElem t, Readable (Layer (Abstract t) layer) m ) => t -> m (LayerData layer t)
readLayer t = flip readLayerByKey t =<< getKey @(Layer (Abstract t) layer) ; {-# INLINE readLayer #-}

writeLayer :: forall layer t m. (IRMonad m, IsElem t, Readable (Layer (Abstract t) layer) m ) => LayerData layer t -> t -> m ()
writeLayer val t = (\k -> writeLayerByKey k val t) =<< getKey @(Layer (Abstract t) layer) ; {-# INLINE writeLayer #-}

readAttr :: forall a m. (IRMonad m, Readable (Attr a) m) => m (KeyDataM m (Attr a))
readAttr = readComp @(Attr a) ; {-# INLINE readAttr #-}

writeAttr :: forall a m. (IRMonad m, Writable (Attr a) m) => KeyDataM m (Attr a) -> m ()
writeAttr a = writeComp @(Attr a) a

readNet :: forall a m. (IRMonad m, Readable (Net a) m) => m (KeyDataM m (Net a))
readNet = readComp @(Net a) ; {-# INLINE readNet #-}


-- === Registration === --

registerElemWith :: forall el m. (Typeable el, IRMonad m) => (ElemStoreM (GetIRBuilder m) -> ElemStoreM (GetIRBuilder m)) -> m ()
registerElemWith = modifyIRM_ . fmap runByIRBuilder . modifyElem (typeRep' @el) ; {-# INLINE registerElemWith #-}

registerElem :: forall el m. (Typeable el, IRMonad m) => m ()
registerElem = registerElemWith @el id ; {-# INLINE registerElem #-}

-- registerGenericLayer :: forall layer t m. (IRMonad m, Typeable layer)
--                      => LayerCons' layer t (GetIRBuilder m) -> m ()
-- registerGenericLayer f = modifyIR_ $ genericLayers %~ Map.insert (typeRep' @layer) (anyCons @layer f)
-- {-# INLINE registerGenericLayer #-}
--
-- registerElemLayer :: forall at layer t m. (IRMonad m, Typeable at, Typeable layer)
--                   => LayerCons' layer t (GetIRBuilder m) -> m ()
-- registerElemLayer f = modifyIR_ $ specificLayers (typeRep' @at) %~ Map.insert (typeRep' @layer) (anyCons @layer f)
-- {-# INLINE registerElemLayer #-}

attachLayer :: (IRMonad m, PrimMonad (GetIRBuilder m)) => LayerRep -> ElemRep -> m ()
attachLayer l e = do
    s <- getIR
    let Just estore = s ^? wrapped' . ix e -- Internal error if not found (element not registered)
    Store.unsafeAddKey l estore
{-# INLINE attachLayer #-}

-- setAttr :: forall a m. (IRMonad m, Typeable a) => a -> m ()
-- setAttr a = modifyIR_ $ attrs %~ Map.insert (typeRep' @a) (unsafeCoerce a) ; {-# INLINE setAttr #-}




----------------------
-- === IRMonad === ---
----------------------

-- === Definition === --

-- | IRMonad is subclass of MonadFic because many expr operations reuire recursive calls.
--   It is more convenient to store it as global constraint, so it could be altered easily in the future.
type  IRMonadBase       m = (PrimMonad m, MonadFix m)
type  IRMonadInvariants m = (IRMonadBase m, IRMonadBase (GetIRBuilderMonad m), IRMonad (GetIRBuilder m), PrimState m ~ PrimState (GetIRBuilderMonad m))
class IRMonadInvariants m => IRMonad m where
    getIR          :: m (IRM' m)
    putIR          :: IRM' m -> m ()
    runByIRBuilder :: GetIRBuilder m a -> m a

instance {-# OVERLAPPABLE #-} (MonadFix m, PrimMonad m) => IRMonad (IRBuilder m) where
    getIR = wrap'   State.get ; {-# INLINE getIR #-}
    putIR = wrap' . State.put ; {-# INLINE putIR #-}
    runByIRBuilder    = id                ; {-# INLINE runByIRBuilder    #-}

instance {-# OVERLAPPABLE #-} IRMonadTrans t m => IRMonad (t m) where
    getIR = lift   getIR ; {-# INLINE getIR #-}
    putIR = lift . putIR ; {-# INLINE putIR #-}
    runByIRBuilder    = lift . runByIRBuilder    ; {-# INLINE runByIRBuilder    #-}

type IRMonadTrans t m = (IRMonad m, MonadTrans t, IRMonadBase (t m), GetIRBuilder (t m) ~ GetIRBuilder m, PrimState (t m) ~ PrimState m)


-- === Modyfication === --

modifyIRM :: IRMonad m => (IRM' m -> m (a, IRM' m)) -> m a
modifyIRM f = do
    s <- getIR
    (a, s') <- f s
    putIR s'
    return a
{-# INLINE modifyIRM #-}

modifyIRM_ :: IRMonad m => (IRM' m -> m (IRM' m)) -> m ()
modifyIRM_ = modifyIRM . fmap (fmap ((),)) ; {-# INLINE modifyIRM_ #-}

modifyIR_ :: IRMonad m => (IRM' m -> IRM' m) -> m ()
modifyIR_ = modifyIRM_ . fmap return ; {-# INLINE modifyIR_ #-}

snapshot :: IRMonad m => m IR
snapshot = freeze =<< getIR ; {-# INLINE snapshot #-}


-- === Running === --

evalIRBuilderM :: Monad m => IRBuilder m a -> IRBuilderState m -> m a
evalIRBuilderM = State.evalStateT . unwrap' ; {-# INLINE evalIRBuilderM #-}

evalIRBuilder :: PrimMonad m => IRBuilder m a -> IR -> m a
evalIRBuilder m = evalIRBuilderM m <=< thaw ; {-# INLINE evalIRBuilder #-}

evalIRBuilder' :: Monad m => IRBuilder m a -> m a
evalIRBuilder' = flip evalIRBuilderM def ; {-# INLINE evalIRBuilder' #-}


-- === Instances === --

instance MonadTrans IRBuilder where
    lift = wrap' . lift ; {-# INLINE lift #-}

instance PrimMonad m => PrimMonad (IRBuilder m) where
    type PrimState (IRBuilder m) = PrimState m
    primitive = lift . primitive ; {-# INLINE primitive #-}


-----------------------
-- === Key types === --
-----------------------

-- === Definitions === --

type instance KeyData s (Layer _ _) = LayerSet s
type instance KeyData s (Net   _)   = ElemStoreST s
type instance KeyData s (Attr  a)   = a


-- === Aliases === --

data Net  t
data Attr t


-- === Instances === --

instance (IRMonad m, Typeable e, Typeable l) => KeyMonad (Layer e l) m where
    uncheckedLookupKey = do
        s <- getIR
        let mlv = s ^? wrapped' . ix (typeRep' @e)
        mr <- mapM (Store.readKey (typeRep' @l)) mlv
        return $ wrap' <$> join mr
    {-# INLINE uncheckedLookupKey #-}

instance (IRMonad m, Typeable a) => KeyMonad (Net a) m where
    uncheckedLookupKey = fmap wrap' . (^? (wrapped' . ix (typeRep' @a))) <$> getIR ; {-# INLINE uncheckedLookupKey #-}

-- instance (IRMonad m, Typeable a) => KeyMonad (Attr a) m where
--     uncheckedLookupKey = fmap unsafeCoerce . (^? (attrs . ix (typeRep' @a))) <$> getIR ; {-# INLINE uncheckedLookupKey #-}


-------------------
-- === Link === --
-------------------

-- === Definition === --

newtype Link  a b = Link Elem deriving (Show, Ord, Eq)
type    Link' a   = Link a a
type instance Definition (Link a b) = (a,b)
makeWrapped ''Link

type SubLink s t = Link (Sub s t) t

-- === Abstract === --

data LINK  a b
type LINK' a = LINK a a
type instance Abstract  (Link a b) = LINK (Abstract  a) (Abstract  b)


-- === Construction === --

magicLink :: forall a b m. (IRMonad m, Typeable (Abstract a), Typeable (Abstract b))
          => a -> b -> m (Link a b)
magicLink a b = newMagicElem (a,b) ; {-# INLINE magicLink #-}

link :: forall a b m. (IRMonad m, Typeable (Abstract a), Typeable (Abstract b), Accessible (Net (Abstract (Link a b))) m)
     => a -> b -> m (Link a b)
link a b = newElem (a,b) ; {-# INLINE link #-}


-- === Instances === --

instance      IsElem    (Link a b)
type instance Universal (Link a b) = Link (Universal a) (Universal b)



-------------------
-- === Group === --
-------------------

-- === Definition === --

newtype Group a = Group Elem deriving (Show, Ord, Eq)
type instance Definition (Group a) = Set a
makeWrapped ''Group

-- === Abstract === --

data GROUP a
type instance Abstract (Group a) = GROUP (Abstract a)


-- === Construction === --

group :: forall f a m. (IRMonad m, Foldable f, Ord a, Typeable (Abstract a), Accessible (Net (Abstract (Group a))) m)
      => f a -> m (Group a)
group = newElem . foldl' (flip Set.insert) mempty ; {-# INLINE group #-}


-- === Instances === --

instance      IsElem    (Group a)
type instance Universal (Group a) = Group (Universal a)






---------------------

data EXPR


------------------------
-- === ExprTerm === --
------------------------

data TMP -- FIXME

type    ExprTermDef atom t = N.Term atom (Layout.Named (SubLink NAME t) (SubLink EXPR t))
newtype ExprTerm    atom t = ExprTerm    (ExprTermDef atom t)
newtype ExprUniTerm      t = ExprUniTerm (N.UniTerm   (Layout.Named (SubLink NAME t) (SubLink EXPR t)))
type    ExprTerm'   atom   = ExprTerm atom TMP
makeWrapped ''ExprTerm
makeWrapped ''ExprUniTerm


-- === Helpers === --

hideLayout :: ExprTerm atom t -> ExprTerm atom TMP
hideLayout = unsafeCoerce ; {-# INLINE hideLayout #-}


-- === Layout validation === ---
-- | Layout validation. Type-assertion utility, proving that symbol construction is not ill-typed.

type InvalidFormat sel a format = 'ShowType sel
                             :</>: Ticked ('ShowType a)
                             :</>: ErrMsg "is not a valid"
                             :</>: Ticked ('ShowType format)


class                                                       ValidateScope scope sel a
instance {-# OVERLAPPABLE #-} ValidateScope_ scope sel a => ValidateScope scope sel a
instance {-# OVERLAPPABLE #-}                               ValidateScope I     sel a
instance {-# OVERLAPPABLE #-}                               ValidateScope scope I   a
instance {-# OVERLAPPABLE #-}                               ValidateScope scope sel I
type ValidateScope_ scope sel a = Assert (a `In` Atoms scope) (InvalidFormat sel a scope)


class                                                        ValidateLayout model sel a
instance {-# OVERLAPPABLE #-} ValidateLayout_ model sel a => ValidateLayout model sel a
instance {-# OVERLAPPABLE #-}                                ValidateLayout I     sel a
instance {-# OVERLAPPABLE #-}                                ValidateLayout model I   a
instance {-# OVERLAPPABLE #-}                                ValidateLayout model sel I
type ValidateLayout_ model sel a = ValidateScope (model # sel) sel a
type ValidateLayout' t     sel a = ValidateLayout (t # LAYOUT) sel a


-- === Instances === --

-- FIXME: [WD]: it seems that LAYOUT in the below declaration is something else than real layout - check it and refactor
type instance Access LAYOUT (ExprTerm atom t) = Access LAYOUT (Unwrapped (ExprTerm atom t))
type instance Access Atom   (ExprTerm atom t) = atom
type instance Access Format (ExprTerm atom t) = Access Format atom
type instance Access TERM    (ExprTerm atom t) = ExprTerm atom t

instance Accessor TERM (ExprTerm atom t) where access = id ; {-# INLINE access #-}

instance UncheckedFromTerm (ExprTerm atom t) where uncheckedFromTerm = wrap' ; {-# INLINE uncheckedFromTerm #-}

instance ValidateLayout (LayoutOf t) Atom atom
      => FromTerm (ExprTerm atom t) where fromTerm = wrap' ; {-# INLINE fromTerm #-}


-- Repr
instance Repr s (Unwrapped (ExprTerm atom t))
      => Repr s (ExprTerm atom t) where repr = repr . unwrap' ; {-# INLINE repr #-}

-- Fields
type instance FieldsType (ExprTerm atom t) = FieldsType (Unwrapped (ExprTerm atom t))
instance HasFields (Unwrapped (ExprTerm atom t))
      => HasFields (ExprTerm atom t) where fieldList = fieldList . unwrap' ; {-# INLINE fieldList #-}

-- Inputs
type instance InputsType (ExprTerm atom t) = InputsType (Unwrapped (ExprTerm atom t))
instance HasInputs (Unwrapped (ExprTerm atom t))
      => HasInputs (ExprTerm atom t) where inputList = inputList . unwrap' ; {-# INLINE inputList #-}

-- AtomOf
type instance AtomOf (ExprTerm atom t) = AtomOf (Unwrapped (ExprTerm atom t))

----------------------
-- === ExprData === --
----------------------

type ExprStoreSlots = '[ Atom ':= Enum, Format ':= Mask, TERM ':= Raw ]
type ExprStore = Store2 ExprStoreSlots

newtype ExprData sys model = ExprData ExprStore deriving (Show)
makeWrapped ''ExprData


-- === Encoding === --

class                                                              TermEncoder atom where encodeTerm :: forall t. ExprTerm atom t -> ExprStore
instance                                                           TermEncoder I    where encodeTerm = impossible
instance EncodeStore ExprStoreSlots (ExprTerm' atom) Identity => TermEncoder atom where
    encodeTerm = runIdentity . encodeStore . hideLayout ; {-# INLINE encodeTerm #-} -- magic


------------------
-- === Expr === --
------------------

-- === Definition === --

newtype Expr  layout = Expr Elem deriving (Show, Ord, Eq)
type    AnyExpr      = Expr Layout.Any
type    AnyExprLink  = Link' AnyExpr
makeWrapped ''Expr

type instance Definition (Expr _) = ExprStore


-- === Abstract === --

type instance Abstract (Expr _) = EXPR


-- === Utils === --

unsafeRelayout :: Expr l -> Expr l'
unsafeRelayout = unsafeCoerce ; {-# INLINE unsafeRelayout #-}

magicExpr :: forall atom layout m. (TermEncoder atom, IRMonad m)
          => ExprTerm atom (Expr layout) -> m (Expr layout)
magicExpr a = newMagicElem (encodeTerm a) ; {-# INLINE magicExpr #-}

expr :: forall atom layout m. (TermEncoder atom, IRMonad m, Accessible (Net EXPR) m)
     => ExprTerm atom (Expr layout) -> m (Expr layout)
expr = newElem . encodeTerm ; {-# INLINE expr #-}

-- class SomeGeneralEncode a where
--     someGeneralEncode :: a -> ExprStore
--
-- expr2 :: forall a layout m. (IRMonad m, Accessible ExprNet m, SomeGeneralEncode a)
--      => a -> m (Expr layout)
-- expr2 = newElem . someGeneralEncode ; {-# INLINE expr2 #-}

exprs :: (IRMonad m, Readable ExprNet m) => m [AnyExpr]
exprs = uncheckedElems ; {-# INLINE exprs #-}

links :: (IRMonad m, Readable ExprLinkNet m) => m [AnyExprLink]
links = uncheckedElems ; {-# INLINE links #-}


-- | Expr pattern matching utility
match :: (IRMonad m, Readable (Layer EXPR Model) m)
      => Expr layout -> (Unwrapped (ExprUniTerm (Expr layout)) -> m a) -> m a
match t f = f . unwrap' =<< (exprUniTerm t) ; {-# INLINE match #-}

-- | Term unification
exprUniTerm :: (IRMonad m, Readable (Layer EXPR Model) m) => Expr layout -> m (ExprUniTerm (Expr layout))
exprUniTerm t = ExprUniTerm <$> symbolMapM_AB @ToUniTerm toUniTerm t ; {-# INLINE exprUniTerm #-}

class ToUniTerm a b where toUniTerm :: a -> b
instance (Unwrapped a ~ Term t l, b ~ UniTerm l, IsUniTerm t l, Wrapped a)
      => ToUniTerm a b where toUniTerm = uniTerm . unwrap' ; {-# INLINE toUniTerm #-}


-- === Instances === --

type instance Universal (Expr _) = AnyExpr
type instance Sub s     (Expr l) = Expr (Sub s l)
instance      IsElem    (Expr l)
instance      IsIdx     (Expr l) where
    idx = elem . idx ; {-# INLINE idx #-}


type instance Generalizable (Expr l) (Expr l') = Generalizable l l'



-- -------------------------------------
-- === Expr Layout type caches === --
-------------------------------------

type instance Encode2 Atom    v = List.Index v (Every Atom)
type instance Encode2 Format  v = List.Index v (Every Format)




-- TO REFACTOR:

type instance UnsafeGeneralizable (Expr l) (Expr l') = ()

type family         UnsafeGeneralizable a b :: Constraint
unsafeGeneralize :: UnsafeGeneralizable a b => a -> b
unsafeGeneralize = unsafeCoerce ; {-# INLINE unsafeGeneralize #-}




type ExprLayer     = Layer EXPR
type ExprLinkLayer = Layer (LINK' EXPR)
type ExprNet       = Net   EXPR
type ExprLinkNet   = Net   (LINK' EXPR)
type ExprGroupNet  = Net   (GROUP EXPR)


type ExprLayers     ls = ExprLayer     <$> ls
type ExprLinkLayers ls = ExprLinkLayer <$> ls
type Nets           ls = Net           <$> ls

type Accessibles m lst = (Readables m lst, Writables m lst)

type family Readables m lst :: Constraint where
    Readables m '[]       = ()
    Readables m (l ': ls) = (Readable l m, Readables m ls)

type family Writables m lst :: Constraint where
    Writables m '[]       = ()
    Writables m (l ': ls) = (Writable l m, Writables m ls)



unsafeToExprTerm :: forall atom l m. (IRMonad m, Readable (ExprLayer Model) m) => Expr l -> m (ExprTerm atom (Expr l))
unsafeToExprTerm = unsafeCoerce . unwrap' . access @TERM . unwrap' <∘> readLayer @Model ; {-# INLINE unsafeToExprTerm #-}

unsafeToExprTermDef :: forall atom l m. (IRMonad m, Readable (ExprLayer Model) m) => Expr l -> m (ExprTermDef atom (Expr l))
unsafeToExprTermDef = unwrap' <∘> unsafeToExprTerm ; {-# INLINE unsafeToExprTermDef #-}







-- === Term mapping === --
-- | General expr symbol mapping utility. It allows mapping over current symbol in any expr.

class    IRMonad m => TermMapM (atoms :: [*]) ctx expr m b where symbolMapM :: (forall a. ctx a m b => a -> m b) -> expr -> m b
instance IRMonad m => TermMapM '[]            ctx expr m b where symbolMapM _ _ = impossible
instance (  TermMapM as ctx expr m b
         , ctx (ExprTerm a expr) m b
         , idx ~ FromJust (Encode2 Atom a) -- FIXME: make it nicer and assert
         , KnownNat idx
         , Readable (Layer EXPR Model) m
         , expr ~ Expr layout
         )
      => TermMapM (a ': as) ctx expr m b where
    symbolMapM f expr = do
        d <- unwrap' <$> readLayer @Model expr
        sym <- unsafeToExprTerm @a expr
        let eidx = unwrap' $ access @Atom d
            idx  = fromIntegral $ natVal (Proxy :: Proxy idx)
        if (idx == eidx) then f sym else symbolMapM @as @ctx f expr
    {-# INLINE symbolMapM #-}


type TermMapM_AMB          = TermMapM     (Every Atom)
type TermMapM_AB  ctx      = TermMapM_AMB (DropMonad ctx)
type TermMap_AB   ctx expr = TermMapM_AB  ctx expr Identity
type TermMapM_A   ctx      = TermMapM_AB  (FreeResult ctx)
type TermMap_A    ctx expr = TermMapM_A   ctx expr Identity

symbolMapM_AMB :: forall ctx m expr b. TermMapM_AMB ctx expr m b => (forall a. ctx a m b => a -> m b) -> expr -> m b
symbolMapM_AB  :: forall ctx expr m b. TermMapM_AB  ctx expr m b => (forall a. ctx a   b => a ->   b) -> expr -> m b
symbolMap_AB   :: forall ctx expr   b. TermMap_AB   ctx expr   b => (forall a. ctx a   b => a ->   b) -> expr ->   b
symbolMapM_A   :: forall ctx expr m b. TermMapM_A   ctx expr m b => (forall a. ctx a     => a ->   b) -> expr -> m b
symbolMap_A    :: forall ctx expr   b. TermMap_A    ctx expr   b => (forall a. ctx a     => a ->   b) -> expr ->   b
symbolMapM_AMB   = symbolMapM @(Every Atom) @ctx                  ; {-# INLINE symbolMapM_AMB #-}
symbolMapM_AB  f = symbolMapM_AMB @(DropMonad ctx) (return <$> f) ; {-# INLINE symbolMapM_AB  #-}
symbolMap_AB   f = runIdentity . symbolMapM_AB @ctx f             ; {-# INLINE symbolMap_AB   #-}
symbolMapM_A     = symbolMapM_AB @(FreeResult ctx)                ; {-# INLINE symbolMapM_A   #-}
symbolMap_A    f = runIdentity . symbolMapM_A @ctx f              ; {-# INLINE symbolMap_A    #-}






class    (b ~ [FieldsType a], HasFields a) => HasFields2 a b
instance (b ~ [FieldsType a], HasFields a) => HasFields2 a b

-- WARNING: works only for Drafts for now as it assumes that the child-refs have the same type as the parent
-- type FieldsC t layout = TermMap2 HasFields2 (Expr t layout) [Ref (Link (Expr t layout) (Expr t layout))]
symbolFields :: (TermMapM_AB HasFields2 expr m out, expr ~ Expr layout, out ~ [Link expr expr]) => expr -> m out
symbolFields = symbolMapM_AB @HasFields2 fieldList

class    (b ~ [InputsType a], HasInputs a) => HasInputs2 a b
instance (b ~ [InputsType a], HasInputs a) => HasInputs2 a b
inputs :: (TermMapM_AB HasInputs2 expr m out, expr ~ Expr layout, out ~ [Link expr expr]) => expr -> m out
inputs = symbolMapM_AB @HasInputs2 inputList

class    Typeable (AtomOf a) => HasAtom a
instance Typeable (AtomOf a) => HasAtom a
getAtomRep :: (TermMapM_A HasAtom expr m out, expr ~ Expr layout, out ~ AtomRep) => expr -> m out
getAtomRep = symbolMapM_A @HasAtom atomRep

isSameAtom :: (TermMapM_A HasAtom expr m out, expr ~ Expr layout, out ~ AtomRep) => expr -> expr -> m Bool
isSameAtom a b = (==) <$> getAtomRep a <*> getAtomRep b

-- class Repr  s a        where repr  ::       a -> Builder s Tok


class ReprExpr a b where reprAnyExpr :: a -> b
instance (Repr s a, b ~ Builder s Tok) => ReprExpr a b where reprAnyExpr = repr

reprExpr :: (TermMapM_AB ReprExpr (Expr l) m out, out ~ Builder s Tok) => Expr l -> m out
reprExpr = symbolMapM_AB @ReprExpr reprAnyExpr



class    (ctx a b, Monad m) => DropMonad ctx a m b
instance (ctx a b, Monad m) => DropMonad ctx a m b

class    ctx a => FreeResult ctx a b
instance ctx a => FreeResult ctx a b
