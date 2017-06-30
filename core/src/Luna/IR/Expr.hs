{-# LANGUAGE UndecidableInstances #-}

module Luna.IR.Expr (module Luna.IR.Expr, module X) where


import qualified Luna.Prelude as Prelude
import Luna.Prelude hiding (List, String, Integer, Rational, cons, seq)

import Luna.IR.Term.Core
import OCI.IR.Class as IR hiding (Import)
import qualified Luna.IR.Term.Core as Term
import qualified Luna.IR.Term.Function as Term
import qualified Luna.IR.Term.Unit     as Term
import qualified Luna.IR.Term.World    as Term
import qualified Luna.IR.Term.Literal  as Literal
import qualified Luna.IR.Term.Cls      as Cls
import OCI.IR.Name
import OCI.IR.Name.Qualified

import Luna.IR.Term.Core     as X
import Luna.IR.Term.Function as X
import Luna.IR.Term.World    as X
import Luna.IR.Term.Unit as X (UnitProxy, UnresolvedImport, UnresolvedImportSrc, UnresolvedImportTgt, UnresolvedImportHub, ImportSource, Unit)
import qualified Luna.IR.Term.Unit as Import
import OCI.IR.Term  as X

import Type.Inference
import OCI.IR.Layout
import OCI.IR.Layout.Typed hiding (Cons)
import Data.Event (Emitter, type (//))
import Luna.IR.Term ()
import Luna.IR.Format2 ()
import Luna.IR.Format (Draft)
import Data.Map (Map)
import qualified Data.Map as Map


type ExprCons' m a = (MonadRef m, Writer Net AnyExpr m, NewElemEvent m (Expr a))
type ExprCons  m a = (ExprCons' m a, Writer Net AnyExprLink m, NewElemEvent m SomeExprLink)




-- === Star === --

star :: ExprCons' m Star => m (Expr Star)
star = expr Term.uncheckedStar

reserveStar :: (MonadRef m, Writer Net AnyExpr m) => m (Expr Star)
reserveStar = reserveExpr

registerStar :: NewElemEvent m (Expr Star) => Expr Star -> m ()
registerStar = dispatchNewExpr Term.uncheckedStar


-- === Literals === --

number    :: ExprCons' m Number    => Literal.Number                 -> m (Expr Number)
string    :: ExprCons' m String    => Literal.String                 -> m (Expr String)
fmtString :: ExprCons' m FmtString => Literal.FmtString SomeExprLink -> m SomeExpr
number    = expr . Term.uncheckedNumber
string    = expr . Term.uncheckedString
fmtString = expr . Term.uncheckedFmtString

number' :: ExprCons' m Number => Literal.Number -> m SomeExpr
string' :: ExprCons' m String => Literal.String -> m SomeExpr
number' = fmap generalize . number
string' = fmap generalize . string

list' :: ExprCons m List => [Maybe (Expr t)] -> m SomeExpr
list  :: ExprCons m List => [Maybe (Expr t)] -> m (Expr $ List >> t)
list' = fmap generalize . list
list fs = mdo
    t  <- expr $ Term.uncheckedList fn
    fn <- (mapM . mapM) (flip link t . unsafeRelayout) fs
    return t


-- === Prims === --

cons' :: ExprCons m Cons => Name -> [Expr t] -> m SomeExpr
cons  :: ExprCons m Cons => Name -> [Expr t] -> m (Expr $ Cons >> t)
cons' = fmap generalize .: cons
cons n fs = mdo
    t  <- expr $ Term.uncheckedCons n fn
    fn <- mapM (flip link t . unsafeRelayout) fs
    return t

-- FIXME[WD]: make it pure
cons_  :: forall t m. ExprCons m Cons => Name -> m (Expr $ Cons >> t)
cons'_ :: forall   m. ExprCons m Cons => Name -> m SomeExpr
cons_  = flip cons []
cons'_ = fmap generalize . cons_

match' :: ExprCons m Match => Expr a -> [Expr b] -> m SomeExpr
match  :: ExprCons m Match => Expr a -> [Expr b] -> m (Expr $ Match >> (a <+> b))
match' = fmap generalize .: match
match a cs = mdo
    t   <- expr $ Term.uncheckedMatch an cn
    an  <- link (unsafeRelayout a) t
    cn  <- mapM (flip link t . unsafeRelayout) cs
    return t

blank' :: ExprCons' m Blank => m SomeExpr
blank  :: ExprCons' m Blank => m (Expr Blank)
blank' = generalize <$> blank
blank  = expr Term.uncheckedBlank

var' :: ExprCons m Var => Name -> m SomeExpr
var  :: ExprCons m Var => Name -> m (Expr Var)
var' = fmap generalize . var
var  = expr . Term.uncheckedVar

fieldLens' :: ExprCons m FieldLens => QualName -> m SomeExpr
fieldLens  :: ExprCons m FieldLens => QualName -> m (Expr FieldLens)
fieldLens' = fmap generalize . fieldLens
fieldLens  = expr . Term.uncheckedFieldLens

singleFieldLens' :: ExprCons m FieldLens => Name -> m SomeExpr
singleFieldLens  :: ExprCons m FieldLens => Name -> m (Expr FieldLens)
singleFieldLens' = fieldLens' . convert
singleFieldLens  = fieldLens  . convert

acc' :: ExprCons m App => Expr t -> Name -> m SomeExpr
acc  :: ExprCons m Acc => Expr t -> Name -> m (Expr $ Acc >> t)
acc' = fmap generalize .: acc
acc b n = mdo
    t  <- expr $ Term.uncheckedAcc lb n
    lb <- link (unsafeRelayout b) t
    return t

unify' :: ExprCons m Unify => Expr l -> Expr l' -> m SomeExpr
unify  :: ExprCons m Unify => Expr l -> Expr l' -> m (Expr $ Unify >> (l <+> l'))
unify' = fmap generalize .: unify
unify a b = mdo
    t  <- expr $ Term.uncheckedUnify la lb
    la <- link (unsafeRelayout a) t
    lb <- link (unsafeRelayout b) t
    return t

monadic' :: ExprCons m Monadic => Expr l -> Expr l' -> m SomeExpr
monadic  :: ExprCons m Monadic => Expr l -> Expr l' -> m (Expr $ Monadic >> (l <+> l'))
monadic' = fmap generalize .: monadic
monadic a b = mdo
    t  <- expr $ Term.uncheckedMonadic la lb
    la <- link (unsafeRelayout a) t
    lb <- link (unsafeRelayout b) t
    return t

seq' :: ExprCons m Seq => Expr l -> Expr l' -> m SomeExpr
seq  :: ExprCons m Seq => Expr l -> Expr l' -> m (Expr $ Seq >> (l <+> l'))
seq' = fmap generalize .: seq
seq a b = mdo
    t  <- expr $ Term.uncheckedSeq la lb
    la <- link (unsafeRelayout a) t
    lb <- link (unsafeRelayout b) t
    return t

app' :: ExprCons m App => Expr l -> Expr l' -> m SomeExpr
app  :: ExprCons m App => Expr l -> Expr l' -> m (Expr $ App >> (l <+> l'))
app' = fmap generalize .: app
app f a = mdo
    t  <- expr $ Term.uncheckedApp lf la
    lf <- link (unsafeRelayout f) t
    la <- link (unsafeRelayout a) t
    return t


lam' :: ExprCons m Lam => Expr l -> Expr l' -> m SomeExpr
lam  :: ExprCons m Lam => Expr l -> Expr l' -> m (Expr $ Lam >> (l <+> l'))
lam' = fmap generalize .: lam
lam i o = mdo
    t  <- expr $ Term.uncheckedLam li lo
    li <- link (unsafeRelayout i) t
    lo <- link (unsafeRelayout o) t
    return t

grouped' :: ExprCons m Grouped => Expr l -> m SomeExpr
grouped  :: ExprCons m Grouped => Expr l -> m (Expr $ Grouped >> l)
grouped' = fmap generalize . grouped
grouped e = mdo
    t  <- expr $ Term.uncheckedGrouped le
    le <- link (unsafeRelayout e) t
    return t


-- === Definitions === --

rootedFunction :: ExprCons m RootedFunction => IR.Rooted SomeExpr -> m SomeExpr
rootedFunction body = expr $ Term.uncheckedRootedFunction body

asgRootedFunction :: ExprCons m ASGRootedFunction => Name -> IR.Rooted SomeExpr -> m SomeExpr
asgRootedFunction n body = expr $ Term.uncheckedASGRootedFunction n body

asgFunction' :: ExprCons m ASGFunction => Name -> [Expr a] -> Expr b -> m SomeExpr
asgFunction  :: ExprCons m ASGFunction => Name -> [Expr a] -> Expr b -> m (Expr $ ASGFunction >> (a <+> b))
asgFunction' = fmap generalize .:. asgFunction
asgFunction name args body = mdo
    t     <- expr $ Term.uncheckedASGFunction name largs lbody
    largs <- mapM (flip link t . unsafeRelayout) args
    lbody <- link (unsafeRelayout body) t
    return t

functionSig' :: ExprCons m FunctionSig => Name -> Expr a -> m SomeExpr
functionSig  :: ExprCons m FunctionSig => Name -> Expr a -> m (Expr $ FunctionSig >> a)
functionSig' = fmap generalize .: functionSig
functionSig name sig = mdo
    t    <- expr $ Term.uncheckedFunctionSig name lsig
    lsig <- link (unsafeRelayout sig) t
    return t

clsASG' :: ExprCons m ClsASG => Name -> [Expr a] -> [Expr b] -> [Expr c] -> m SomeExpr
clsASG  :: ExprCons m ClsASG => Name -> [Expr a] -> [Expr b] -> [Expr c] -> m (Expr $ ClsASG >> (a <+> b <+> c))
clsASG' = fmap generalize .:: clsASG
clsASG name args conss decls = mdo
    t  <- expr $ Term.uncheckedClsASG name an cn dn
    an <- mapM (flip link t . unsafeRelayout) args
    cn <- mapM (flip link t . unsafeRelayout) conss
    dn <- mapM (flip link t . unsafeRelayout) decls
    return t

recASG' :: ExprCons m RecASG => Name -> [Expr a] -> m SomeExpr
recASG  :: ExprCons m RecASG => Name -> [Expr a] -> m (Expr $ RecASG >> a)
recASG' = fmap generalize .: recASG
recASG name args = mdo
    t  <- expr $ Term.uncheckedRecASG name an
    an <- mapM (flip link t . unsafeRelayout) args
    return t

fieldASG' :: ExprCons m FieldASG => [Name] -> Expr a -> m SomeExpr
fieldASG  :: ExprCons m FieldASG => [Name] -> Expr a -> m (Expr $ FieldASG >> a)
fieldASG' = fmap generalize .: fieldASG
fieldASG name a = mdo
    t  <- expr $ Term.uncheckedFieldASG name la
    la <- link (unsafeRelayout a) t
    return t


typed' :: ExprCons m Typed => Expr a -> Expr b -> m SomeExpr
typed  :: ExprCons m Typed => Expr a -> Expr b -> m (Expr $ Typed >> (a <+> b))
typed' = fmap generalize .: typed
typed a b = mdo
    t  <- expr $ Term.uncheckedTyped la lb
    la <- link (unsafeRelayout a) t
    lb <- link (unsafeRelayout b) t
    return t


unit'  :: ExprCons m Unit => Expr a -> [Expr a] -> Expr a -> m SomeExpr
unit'' :: ExprCons m Unit => Expr a -> [Expr a] -> Expr a -> m (Expr Unit)
unit   :: ExprCons m Unit => Expr a -> [Expr a] -> Expr a -> m (Expr $ Unit >> a)
unit'  = fmap generalize .:. unit
unit'' = fmap unsafeGeneralize .:. unit
unit imps units body = mdo
    t      <- expr $ Term.uncheckedUnit limps lunits lbody
    limps  <- link (unsafeRelayout imps)  t
    lunits <- mapM (flip link t . unsafeRelayout) units
    lbody  <- link (unsafeRelayout body)  t
    return t

phantomUnit' :: (ExprCons m Unit, UnitRegistration m) => QualName -> [Expr a] -> m SomeExpr
phantomUnit' name units = do
    hub <- unresolvedImpHub' [] -- FIXME[WD]: Make it resolved
    cls <- Cls.cls' mempty mempty mempty mempty
    t   <- unit' hub (generalize units) cls
    registerUnit name t
    return t


unitProxy' :: (ExprCons m UnitProxy, UnitRegistration m) => QualName -> [Expr a] -> m SomeExpr
unitProxy  :: (ExprCons m UnitProxy, UnitRegistration m) => QualName -> [Expr a] -> m (Expr UnitProxy)
unitProxy' = generalize <∘∘> unitProxy
unitProxy name units = mdo
    t      <- expr $ Term.uncheckedUnitProxy name lunits
    lunits <- mapM (flip link t . unsafeRelayout) units
    registerUnit name t
    return t

simpleUnitProxy' :: (ExprCons m UnitProxy, UnitRegistration m) => QualName -> m SomeExpr
simpleUnitProxy' = flip unitProxy' mempty

imp' :: ExprCons m UnresolvedImport => Expr a -> Expr a -> m SomeExpr
imp  :: ExprCons m UnresolvedImport => Expr a -> Expr a -> m (Expr $ UnresolvedImport >> a)
imp' = generalize <∘∘> imp
imp a tgt = mdo
    t    <- expr $ Term.uncheckedImport la ltgt
    la   <- link (unsafeRelayout a)   t
    ltgt <- link (unsafeRelayout tgt) t
    return t

unresolvedImp' :: ExprCons m UnresolvedImport => Expr a -> UnresolvedImportTgt -> m SomeExpr
unresolvedImp  :: ExprCons m UnresolvedImport => Expr a -> UnresolvedImportTgt -> m (Expr $ UnresolvedImport >> a)
unresolvedImp' = generalize <∘∘> unresolvedImp
unresolvedImp a tgts = mdo
    t  <- expr $ Term.uncheckedUnresolvedImport la tgts
    la <- link (unsafeRelayout a) t
    return t

unresolvedImpSrc' :: ExprCons' m UnresolvedImportSrc => ImportSource -> m SomeExpr
unresolvedImpSrc  :: ExprCons' m UnresolvedImportSrc => ImportSource -> m (Expr UnresolvedImportSrc)
unresolvedImpSrc'   = generalize <∘> unresolvedImpSrc
unresolvedImpSrc  a = expr $ Term.uncheckedUnresolvedImportSrc a

unresolvedImpHub' :: ExprCons m UnresolvedImportHub => [Expr a] -> m SomeExpr
unresolvedImpHub  :: ExprCons m UnresolvedImportHub => [Expr a] -> m (Expr UnresolvedImportHub)
unresolvedImpHub' = generalize <∘> unresolvedImpHub
unresolvedImpHub imps = mdo
    t     <- expr $ Term.uncheckedUnresolvedImportHub limps
    limps <- mapM (flip link t . unsafeRelayout) imps
    return t

impHub' :: ExprCons m UnresolvedImportHub => (Map Name (Expr a)) -> m SomeExpr
impHub  :: ExprCons m UnresolvedImportHub => (Map Name (Expr a)) -> m (Expr UnresolvedImportHub)
impHub' = generalize <∘> impHub
impHub imps = mdo
    t     <- expr $ Term.uncheckedImportHub limps
    limps <- mapM (flip link t . unsafeRelayout) imps
    return t


invalid' :: ExprCons' m Invalid => Text -> m SomeExpr
invalid  :: ExprCons' m Invalid => Text -> m (Expr Invalid)
invalid' = generalize <∘> invalid
invalid  = expr . Term.uncheckedInvalid


accSection  :: ExprCons' m AccSection => [Name] -> m SomeExpr
accSection name = expr $ Term.uncheckedAccSection name

leftSection' :: ExprCons m LeftSection => Expr a -> Expr b -> m SomeExpr
leftSection  :: ExprCons m LeftSection => Expr a -> Expr b -> m (Expr $ LeftSection >> (a <+> b))
leftSection' = generalize <∘∘> leftSection
leftSection op a = mdo
    t   <- expr $ Term.uncheckedLeftSection lop la
    lop <- link (unsafeRelayout op) t
    la  <- link (unsafeRelayout a)  t
    return t

rightSection' :: ExprCons m RightSection => Expr a -> Expr b -> m SomeExpr
rightSection  :: ExprCons m RightSection => Expr a -> Expr b -> m (Expr $ RightSection >> (a <+> b))
rightSection' = generalize <∘∘> rightSection
rightSection op a = mdo
    t   <- expr $ Term.uncheckedRightSection lop la
    la  <- link (unsafeRelayout a)  t
    lop <- link (unsafeRelayout op) t
    return t



disabled' :: ExprCons m Disabled => Expr a -> m SomeExpr
disabled  :: ExprCons m Disabled => Expr a -> m (Expr $ Disabled >> a)
disabled' = fmap generalize . disabled
disabled a = mdo
    t    <- expr $ Term.uncheckedDisabled la
    la   <- link (unsafeRelayout a) t
    return t

marker' :: ExprCons' m Marker => Word64 -> m SomeExpr
marker  :: ExprCons' m Marker => Word64 -> m (Expr Marker)
marker' = generalize <∘> marker
marker  = expr . Term.uncheckedMarker

marked' :: ExprCons m Marked => Expr l -> Expr r -> m SomeExpr
marked  :: ExprCons m Marked => Expr l -> Expr r -> m (Expr $ Marked >> (l <+> r))
marked' = fmap generalize .: marked
marked l r = mdo
    t  <- expr $ Term.uncheckedMarked ll lr
    ll <- link (unsafeRelayout l) t
    lr <- link (unsafeRelayout r) t
    return t

metadata' :: ExprCons' m Metadata => Text -> m SomeExpr
metadata  :: ExprCons' m Metadata => Text -> m (Expr Metadata)
metadata' = fmap generalize . metadata
metadata  = expr . Term.uncheckedMetadata
