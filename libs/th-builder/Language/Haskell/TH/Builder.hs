{-# LANGUAGE UndecidableInstances #-}
{-# LANGUAGE ExistentialQuantification #-}

module Language.Haskell.TH.Builder (module Language.Haskell.TH.Builder, module X) where

import Prologue hiding (Cons, Data, Type)

import Language.Haskell.TH as X (newName)
import Language.Haskell.TH (Q, Name)
import qualified Language.Haskell.TH as TH



---------------------------
-- === Common Fields === --
---------------------------

class HasExpr t where
    expr :: forall a. Lens' (t a) a


class HasName a where
    type family   NameOf a
    type instance NameOf a = Name
    name :: Lens' a (NameOf a)

class HasParams a where
    type family ParamOf a
    params :: Lens' a [ParamOf a]

class HasKind a where
    type family   KindOf a
    type instance KindOf a = TH.Kind
    kind :: Lens' a (KindOf a)

class HasCtx    a where ctx    :: Lens' a [TH.Pred]
class HasCons   a where conses :: Lens' a [TH.Con]
class HasDerivs a where derivs :: Lens' a [TH.DerivClause]



-------------------
-- === Names === --
-------------------

-- === Generation === --

strNameCycle :: [String]
strNameCycle = (return <$> ['a' .. 'z']) <> strNameCycle' [] (show <$> [0..]) where
    strNameCycle' []     (n:ns) = strNameCycle' ['a' .. 'z'] ns
    strNameCycle' (b:bs) ns     = (b : unsafeHead ns) : strNameCycle' bs ns

unsafeNameCycle :: Convertible' Name a => [a]
unsafeGenName   :: Convertible' Name a => a
unsafeGenNames  :: Convertible' Name a => Int -> [a]
unsafeNameCycle = convert' . TH.mkName <$> strNameCycle
unsafeGenName   = unsafeHead unsafeNameCycle
unsafeGenNames  = flip take unsafeNameCycle

newNames :: Convertible' Name a => Int -> Q [a]
newNames = mapM (fmap convert' . newName) . flip take strNameCycle


-- === TH Conversions === --

instance Convertible Name TH.TyVarBndr where convert = TH.PlainTV




----------------------
-- === Literals === --
----------------------

instance Convertible Integer TH.Exp where convert = TH.LitE . TH.IntegerL



-----------------
-- === Var === --
-----------------

-- === Definition === --

newtype Var = Var { __name :: Name }
makeLenses ''Var


-- === Utils === --

var :: Convertible Var a => Name -> a
var = convert . Var


-- === Conversions === --

instance Convertible Name Var   where convert = wrap
instance Convertible Var  Name  where convert = unwrap


-- === TH Conversions === --

instance Convertible Var TH.Pat where convert = TH.VarP . convert
instance Convertible Var TH.Exp where convert = TH.VarE . convert



-----------------
-- === App === --
-----------------

-- === Definition === --

data App a = App
    { __base :: a
    , __arg  :: a
    } deriving (Foldable, Functor, Show, Traversable)


-- === Utils === --

app  :: Convertible (App a) a => a -> a -> a
app2 :: Convertible (App a) a => a -> a -> a -> a
app3 :: Convertible (App a) a => a -> a -> a -> a -> a
app4 :: Convertible (App a) a => a -> a -> a -> a -> a -> a
app5 :: Convertible (App a) a => a -> a -> a -> a -> a -> a -> a
app                   = convert .: App
app2 a t1 t2          = apps a [t1, t2]
app3 a t1 t2 t3       = apps a [t1, t2, t3]
app4 a t1 t2 t3 t4    = apps a [t1, t2, t3, t4]
app5 a t1 t2 t3 t4 t5 = apps a [t1, t2, t3, t4, t5]

apps :: Convertible (App a) a => a -> [a] -> a
apps = foldl app

appQ :: Convertible (App a) a => Q a -> Q a -> Q a
appQ base arg = app <$> base <*> arg


-- === TH Conversions === --

instance a ~ TH.Exp => Convertible (App a) TH.Exp where
    convert (App a b) = TH.AppE a b



-------------------
-- === Typed === --
-------------------

-- === Definition === --

data Typed e t = Typed
    { __expr :: e
    , __tp   :: t
    } deriving (Foldable, Functor, Show, Traversable)


-- === Utils === --

typed, (-::) :: Convertible (Typed e t) e => e -> t -> e
typed = convert .: Typed
(-::) = typed


-- === TH Conversions === --

instance (e ~ TH.Exp, t ~ TH.Type) => Convertible (Typed e t) TH.Exp where
    convert (Typed e t) = TH.SigE e t



------------------
-- === Cons === --
------------------

-- === Definition === --

data Field a = Field
    { __name :: Maybe Name
    , __expr :: a
    } deriving (Foldable, Functor, Show, Traversable)
makeLenses ''Field

data Cons a = Cons
    { __name   :: Name
    , __fields :: [Field a]
    } deriving (Foldable, Functor, Show, Traversable)
makeLenses ''Cons


-- === Utils === --

cons :: Convertible (Cons a) a => Name -> [Field a] -> a
cons = convert .: Cons


-- === Properties === --

instance HasExpr Field     where expr = field_expr
instance HasName (Field a) where
    type NameOf  (Field a) = Maybe Name
    name = field_name


-- === Conversions === --

instance Convertible Var a => Convertible Var (Field a) where
    convert = Field Nothing . convert


-- === TH conversions === --

instance a ~ TH.Pat => Convertible (Cons a) TH.Pat where
    convert (Cons n fs) = if not usesNames then conP else error "TODO" where
        usesNames = not . null $ catMaybes (view name <$> fs)
        conP      = TH.ConP n $ view expr <$> fs

instance a ~ TH.Type => Convertible (Cons a) TH.Type where
    convert (Cons n fs) = foldl TH.AppT (TH.ConT n) (view expr <$> fs)



--------------------
-- === Clause === --
--------------------

-- === Definition === --

data Clause = Clause
    { __pats       :: [TH.Pat]
    , __body       :: TH.Exp
    , __whereDecls :: [TH.Dec]
    }


-- === Utils === --

clause :: Convertible Clause t => [TH.Pat] -> TH.Exp -> [TH.Dec] -> t
clause = convert .:. Clause


-- === TH Conversions === --

instance Convertible Clause TH.Clause where
    convert (Clause ps b w) = TH.Clause ps (TH.NormalB b) w



------------------
-- === Data === --
------------------

data Data = Data
    { __ctx    :: [TH.Pred]
    , __name   :: Name
    , __params :: [TH.TyVarBndr]
    , __kind   :: Maybe TH.Kind
    , __cons   :: [TH.Con]
    , __derivs :: [TH.DerivClause]
    }
makeLenses ''Data
--
instance HasName   Data where name   = data_name
instance HasCtx    Data where ctx    = data_ctx
instance HasCons   Data where conses = data_cons
instance HasDerivs Data where derivs = data_derivs

instance HasKind Data where
    type KindOf  Data = Maybe TH.Kind
    kind = data_kind

instance HasParams Data where
    type ParamOf   Data = TH.TyVarBndr
    params = data_params


-- === Construction === --

data' :: Name -> Data
data' n = Data def n def def def def

-- | Function 'phantom' takes number of data parameters and generates a phantom
--   data type, for example `phantom 2 "Foo"` generates `data Foo a b`
phantomN :: Int -> Name -> Data
phantomN i n = data' n & params .~ unsafeGenNames i

phantom0, phantom1, phantom2, phantom3, phantom4, phantom5 :: Name -> Data
phantom0 = phantomN 0
phantom1 = phantomN 1
phantom2 = phantomN 2
phantom3 = phantomN 3
phantom4 = phantomN 4
phantom5 = phantomN 5

-- === TH Conversions === --

instance Convertible Data TH.Dec where
    convert (Data ctx name params kind cons derivs) = TH.DataD ctx name params kind cons derivs




-- TODO: We keep old code for now in case anything will be needed.
--       It should be removed before releasing final version.
--------------------------------------------------------------------------------
--------------------------------------------------------------------------------
--------------------------------------------------------------------------------

-- ---------------------
-- -- === TypeSyn === --
-- ---------------------
--
-- data TypeSyn = TypeSyn { _typeSyn_name   :: TypeName
--                        , _typeSyn_params :: [Var]
--                        , _typeSyn_tp     :: Type
--                        }
-- makeLenses ''TypeSyn
-- instance HasName   TypeSyn where name   = typeSyn_name   ; {-# INLINE name   #-}
-- instance HasParams TypeSyn where params = typeSyn_params ; {-# INLINE params #-}
-- instance HasType   TypeSyn where tp     = typeSyn_tp     ; {-# INLINE tp     #-}
--
-- type instance NameOf TypeSyn = TypeName
--
--
-- -- === Construction === --
--
-- alias :: ToType t => TypeName -> t -> TypeSyn
-- alias n t = TypeSyn n def (toType t) ; {-# INLINE alias #-}
--
--
-- -- === Instances === --
--
-- instance IsTH TH.Dec TypeSyn where
--     th a = TySynD (th $ a ^. name) (th $ a ^. params) (a ^. tp) ; {-# INLINE th #-}
--
--
--
-- ---------------------------
-- -- === Type Instance === --
-- ---------------------------
--
-- data TypeInstance = TypeInstance { _typeInstance_name   :: TypeName
--                                  , _typeInstance_args   :: [Type]
--                                  , _typeInstance_result :: Type
--                                  }
--
--
-- typeInstance :: (ToTypeName n, ToType t, ToType t') => n -> [t] -> t' -> TypeInstance
-- typeInstance n args res = TypeInstance (toTypeName n) (toType <$> args) (toType res) ; {-# INLINE typeInstance #-}
--
-- typeInstance' :: (ToTypeName n, ToType t, ToType t') => n -> t -> t' -> TypeInstance
-- typeInstance' n = typeInstance n . return ; {-# INLINE typeInstance' #-}
--
--
-- instance IsTH TH.Dec TypeInstance where
--     th (TypeInstance n as r) = TySynInstD (th n) (TySynEqn as r) ; {-# INLINE th #-}
--
--
-- ----------------------------
-- -- === Class Instance === --
-- ----------------------------
--
-- data ClassInstance = ClassInstance { _classInstance_overlap :: Maybe Overlap
--                                    , _classInstance_ctx     :: Cxt
--                                    , _classInstance_name    :: TypeName
--                                    , _classInstance_tp      :: [Type]
--                                    , _classInstance_decs    :: [Dec]
--                                    }
--
--
-- classInstance :: (ToCxt ctx, ToTypeName n, ToType t, IsDec dec)
--               => ctx -> n -> [t] -> [dec] -> ClassInstance
-- classInstance ctx n ts desc = ClassInstance Nothing (th ctx) (toTypeName n) (th <$> ts) (toDec <$> desc) ; {-# INLINE classInstance #-}
--
-- classInstance' :: (ToTypeName n, ToType t, IsDec dec)
--               => n -> [t] -> [dec] -> ClassInstance
-- classInstance' = classInstance ([] :: Cxt) ; {-# INLINE classInstance' #-}
--
--
-- instance IsTH TH.Dec ClassInstance where
--     th (ClassInstance olap cxt n ts decs) = InstanceD olap cxt (th $ apps (th n) ts) (th decs) ; {-# INLINE th #-}
--
--
-- ----------------------
-- -- === Function === --
-- ----------------------
--
-- data Function = Function { _function_name   :: VarName
--                          , _function_clause :: [Clause]
--                          }
--
--
-- function :: ToVarName n => n -> [Clause] -> Function
-- function n = Function (toVarName n) ; {-# INLINE function #-}
--
-- function' :: ToVarName n => n -> Clause -> Function
-- function' n = function n . return ; {-# INLINE function' #-}
--
--
-- instance IsTH TH.Dec Function where
--     th (Function n cs) = FunD (th n) cs ; {-# INLINE th #-}
--
--
--
-- -----------------
-- -- === Dec === --
-- -----------------
--
-- data Dec = DataDec          { _dec_dataDec          :: Data          }
--          | TypeSynDec       { _dec_typeSynDec       :: TypeSyn       }
--          | TypeInstanceDec  { _dec_typeInstanceDec  :: TypeInstance  }
--          | ClassInstanceDec { _dec_classInstanceDec :: ClassInstance }
--          | FunctionDec      { _dec_functionDec      :: Function      }
--
--
-- class IsDec a where
--     toDec :: a -> Dec
--
--
-- instance IsTH TH.Dec Dec where
--     th = \case
--         DataDec          a -> th a
--         TypeSynDec       a -> th a
--         TypeInstanceDec  a -> th a
--         ClassInstanceDec a -> th a
--         FunctionDec      a -> th a
--     {-# INLINE th #-}
--
-- instance IsDec Data          where toDec = DataDec          ; {-# INLINE toDec #-}
-- instance IsDec TypeSyn       where toDec = TypeSynDec       ; {-# INLINE toDec #-}
-- instance IsDec TypeInstance  where toDec = TypeInstanceDec  ; {-# INLINE toDec #-}
-- instance IsDec ClassInstance where toDec = ClassInstanceDec ; {-# INLINE toDec #-}
-- instance IsDec Function      where toDec = FunctionDec      ; {-# INLINE toDec #-}
--
--
-- makeLenses ''Dec
--
--
--
-- -----------------------
-- -- === THBuilder === --
-- -----------------------
--
-- type    THBuilder      = THBuilderT Q
-- newtype THBuilderT m a = THBuilderT (StateT [Dec] m a) deriving (Functor, Applicative, Monad, MonadTrans, MonadIO, MonadFix, MonadFail)
-- makeWrapped ''THBuilderT
--
-- class Monad m => MonadTH a m where
--     define :: a -> m ()
--
-- instance {-# OVERLAPPABLE #-} (IsDec a, Monad m) => MonadTH  a          (THBuilderT m) where define a = THBuilderT $ modify (<> [toDec a]) ; {-# INLINE define #-}
-- instance {-# OVERLAPPABLE #-} (IsDec a, Monad m) => MonadTH [a]         (THBuilderT m) where define   = mapM_ define                       ; {-# INLINE define #-}
-- instance {-# OVERLAPPABLE #-} (IsDec a, Monad m) => MonadTH (ZipList a) (THBuilderT m) where define   = define . getZipList                ; {-# INLINE define #-}
--
--
-- -- === Execution === --
--
-- execTHBuilder :: Monad m => THBuilderT m a -> m [Dec]
-- execTHBuilder = flip execStateT mempty . unwrap' ; {-# INLINE execTHBuilder #-}
--
-- build :: Monad m => THBuilderT m a -> m [TH.Dec]
-- build = fmap th . execTHBuilder ; {-# INLINE build #-}
--
--
--
--
-- makeLunaComponents :: String -> String -> [String] -> Q [TH.Dec]
-- makeLunaComponents (typeName -> comp) (typeName -> fam) (ZipList -> typeNames) = build $ do
--     let types  = typeName <$> typeNames
--         idents = toUpper  <$> types
--
--     -- define $ phantom  comp                                     -- data Atom
--     -- define $ phantom' fam                                      -- data Atomic a
--     define $ data' <$> idents                                  -- data STAR; ...
--     define $ alias <$> types <*> (app fam <$> idents)          -- type Star = Atomic STAR; ...
--     define $ typeInstance' "TypeRepr" <$> idents <*> typeNames -- type instance TypeRepr STAR = "Star"; ...
--     define $ typeInstance' "Every" comp types                  -- type instance Every Atom = '[Star, ...]
--
--
--
--
-- makeLensedTerm :: Name -> Q [TH.Dec]
-- makeLensedTerm name = (<>) <$> makeLenses name <*> makeTerm   name
--
-- makeLensedTerms :: String -> [Name] -> Q [TH.Dec]
-- makeLensedTerms famname names = (<>) <$> (concat <$> mapM makeLenses names) <*> makeTerms famname names
--
-- -- | makeTerm used as `makeTerm TermFoo` generates:
-- --     data FOO
-- --     type Foo = TermicType FOO
-- --     type instance TermDef  Foo = TermFoo
-- --     type instance TypeRepr FOO = "Foo"
-- --     type instance Access TermType (TermFoo a) = Foo
-- --     uncheckedFoo <TermFoo args> = uncheckedFromTermDef (Foo <TermFoo args>)
-- makeTerm :: Name -> Q [TH.Dec]
-- makeTerm termName = build $ do
--     let pfxname = nameBase termName
--     strName <- maybe (error "Provided type name must start with 'Term'") return (splitTermName pfxname)
--     let name        = typeName strName
--         boldName    = toUpper name
--         termWrapper = typeName "TermicType"
--         termDef     = typeName "TermDef"
--
--     define $ data' boldName
--     define $ alias name $ app termWrapper boldName
--     define $ typeInstance' termDef name (typeName pfxname)
--     define $ typeInstance' "TypeRepr" boldName strName
--     define $ typeInstance  "Access" ([th $ typeName "TermType", th $ app (th $ typeName pfxname :: Type) (th $ varName "a")] :: [Type]) name
--
--     info <- lift $ reify termName
--     let uname       = varName $ "unchecked" <> strName
--         argnum      = tvarNum info
--         args        = ("arg" <>) . show <$> [1..argnum]
--     let app1 = th $ (apps (th name) (th . varName <$> args) :: App TH.Exp) :: TH.Exp
--         app2 = th $ app (th $ varName "uncheckedFromTermDef") app1
--     define $ function' uname $ Clause (VarP . mkName <$> args) (NormalB app2) []
--     return []
--
-- tvarNum = \case
--     TyConI (NewtypeD {})                    -> 1
--     TyConI (DataD _ _ _ _ [NormalC _ ts] _) -> length ts
--     TyConI (DataD _ _ _ _ [RecC    _ ts] _) -> length ts
--
--
-- splitTermName :: String -> Maybe String
-- splitTermName n = if_ (head == term) $ Just tail where
--     head = take len n
--     tail = drop len n
--     len  = length term
--     term = "Term"
--
-- makeTerms :: String -> [Name] -> Q [TH.Dec]
-- makeTerms famName pns = (<>) <$> (concat <$> mapM makeTerm pns) <*> (build $ do
--     let extractName n = maybe (error "Provided type name must start with 'Term'") return (splitTermName $ nameBase n)
--     ns <- mapM extractName pns
--     define $ alias (typeName famName) (typeName <$> ns)
--     )
