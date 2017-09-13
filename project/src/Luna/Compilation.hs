{-# LANGUAGE OverloadedStrings  #-}
{-# LANGUAGE OverloadedLists    #-}

module Luna.Compilation where

import           Luna.Prelude        hiding (String, seq, cons, Constructor)
import qualified Luna.Prelude        as P
import qualified Data.Map            as Map
import           Data.Map            (Map)
import qualified Data.TreeSet        as TreeSet
import qualified Data.Bimap          as Bimap
import           Control.Monad.Raise
import           Control.Monad.State  (execStateT, MonadState)
import           Control.Monad.Except (runExceptT, MonadError, throwError)

import Luna.Builtin.Std
import qualified OCI.Pass           as Pass
import           OCI.Pass           (SubPass, Preserves, Inputs, Outputs)
import qualified OCI.IR.Repr.Vis    as Vis
import OCI.IR.Name.Qualified
import Luna.IR
import Luna.IR.Term.Unit (UnitSet)
import Luna.IR.Term.Cls  (Cls)
import qualified Luna.IR.Term.Unit as Term
import qualified Luna.IR.Term.Unit as Unit
import qualified Luna.IR.Term.Cls  as Term
import Luna.Builtin.Data.Module     as Module
import Luna.Builtin.Data.Class
import Luna.Builtin.Data.LunaEff
import qualified Luna.Builtin.Data.Function   as Function

import Luna.Pass.Data.UniqueNameGen
import Luna.Pass.Data.ExprRoots

import qualified Luna.Syntax.Text.Parser.Parser   as Parser
import qualified Luna.Syntax.Text.Source          as Source
import qualified Luna.Syntax.Text.Parser.Parsing  as Parsing
import qualified Luna.Syntax.Text.Parser.Class    as Parsing
import qualified Luna.Syntax.Text.Parser.Marker   as Parser (MarkedExprMap)
import qualified Luna.Syntax.Text.Parser.CodeSpan as CodeSpan
import qualified Luna.Syntax.Text.Layer.Loc       as Loc
import qualified Data.Text.Position               as Pos

import Luna.Test.IR.Runner
import Data.TypeDesc
import System.IO.Unsafe

import qualified Luna.Pass.Transform.Desugaring.RemoveGrouped  as RemoveGrouped
import qualified Luna.Pass.UnitCompilation.ModuleProcessing    as ModuleProcessing
import qualified Luna.Pass.Sourcing.UnitLoader as UL
import           Luna.Syntax.Text.Parser.Errors      (Invalids)

import qualified Luna.Project       as Project
import           System.Directory   (getCurrentDirectory)
import qualified Path               as Path
import qualified System.Environment as Env

import System.Log (dropLogs)

data ProjectCompilation
type instance Abstract ProjectCompilation = ProjectCompilation
type instance Inputs  Net   ProjectCompilation = '[AnyExpr]
type instance Outputs Net   ProjectCompilation = '[AnyExpr]
type instance Inputs  Layer ProjectCompilation = '[AnyExpr // Model, AnyExpr // UID, Link' AnyExpr // UID, Link' AnyExpr // Model, AnyExpr // Succs]
type instance Outputs Layer ProjectCompilation = '[]
type instance Inputs  Attr  ProjectCompilation = '[Parser.ReparsingStatus, WorldExpr]
type instance Outputs Attr  ProjectCompilation = '[]
type instance Inputs  Event ProjectCompilation = '[]
type instance Outputs Event ProjectCompilation = '[New // AnyExpr]
type instance Preserves     ProjectCompilation = '[]

data ModuleCompilationError = ModuleSourcesNotFound QualName
                            | ImportsCycleError [QualName]
                            deriving (Show)

data CompiledModules = CompiledModules { _modules :: Map QualName Imports
                                       , _prims   :: Imports
                                       }
makeLenses ''CompiledModules

instance Default CompiledModules where
    def = CompiledModules def def

initPM = do
    runRegs

    Loc.init
    attachLayer 5 (getTypeDesc @Pos.Range)         (getTypeDesc @AnyExpr)
    CodeSpan.init
    attachLayer 5 (getTypeDesc @CodeSpan.CodeSpan) (getTypeDesc @AnyExpr)
    initNameGen
    setAttr (getTypeDesc @Parser.MarkedExprMap)   $ (mempty :: Parser.MarkedExprMap)
    setAttr (getTypeDesc @Parser.ParsedExpr)      $ (error "Data not provided: ParsedExpr")
    setAttr (getTypeDesc @Parser.ReparsingStatus) $ (mempty :: Parser.ReparsingStatus)
    setAttr (getTypeDesc @WorldExpr)     (undefined :: WorldExpr)
    setAttr (getTypeDesc @Source.Source) (undefined :: Source.Source)
    setAttr (getTypeDesc @Invalids)               $ (mempty :: Invalids)
    setAttr (getTypeDesc @UnitSet)                  (undefined :: UnitSet)
    setAttr (getTypeDesc @UL.UnitsToLoad)           (mempty    :: UL.UnitsToLoad)
    setAttr (getTypeDesc @UL.SourcesManager)        (undefined :: UL.SourcesManager)
    Pass.eval' initWorld

prepareStdlib :: Map Name FilePath -> IO (IO (), CompiledModules)
prepareStdlib srcs = mdo
    let system  = Imports def $ Right <$> std
        initial = CompiledModules def system
    (cln, std) <- systemStd $ unionsImports $ Map.elems $ modules
    Right res@(CompiledModules modules _) <- requestModules srcs stdlibImports initial
    return (cln, res)

requestModules :: Map Name FilePath -> [QualName] -> CompiledModules -> IO (Either ModuleCompilationError CompiledModules)
requestModules libs modules cached = do
    sources <- mapM (Project.findProjectSources <=< Path.parseAbsDir) libs
    let mkSourcesMap libName sources = foldl (\m (p, n) -> Map.insert (fromList . (libName :) . toList $ n) (UL.Source (Path.toFilePath p) def) m) def (Bimap.toList sources)
        sourcesMgr = UL.fsSourceManager $ Map.unions $ uncurry mkSourcesMap <$> Map.toList sources
    res <- runExceptT $ flip execStateT cached $ mapM (requestModule sourcesMgr []) modules
    return res

requestModule :: (MonadState CompiledModules m, MonadError ModuleCompilationError m, MonadIO m) => UL.SourcesManager -> [QualName] -> QualName -> m Imports
requestModule srcs stack current = do
    putStrLn $ "Requested module: " <> convert current
    case dropWhile (/= current) stack of
        [] -> return ()
        _  -> throwError $ ImportsCycleError (current : takeWhile (/= current) stack)

    codeE <- dropLogs $ srcs ^. UL.readCode $ current
    code  <- case codeE of
        Left  _ -> throwError $ ModuleSourcesNotFound current
        Right c -> return c
    Right dependencies <- liftIO $ runPM False $ do
        initPM
        Pass.eval' @UL.UnitLoader $ do
            u      <- UL.parseUnit code
            imphub <- u @^. Term.imports
            imps   <- readWrappedSources (unsafeGeneralize imphub :: UL.UnresolvedImportHubType)
            forM imps $ \imp -> do
                src <- imp @^. Term.termUnresolvedImport_source
                Term.Absolute path <- src @. wrapped
                return path

    deps <- fmap Map.fromList $ forM dependencies $ \dep -> do
        scope <- use modules
        case scope ^? ix dep of
            Just i  -> return (dep, i)
            Nothing -> (dep,) <$> requestModule srcs (current : stack) dep
    std <- use prims
    putStrLn $ "Compiling module: " <> convert current
    Right mod <- liftIO $ runPM False $ do
        initPM
        u <- Pass.eval' @UL.UnitLoader $ do
            u   <- UL.parseUnit code
            cls <- u @^. Unit.cls
            UL.partitionASGCls (unsafeGeneralize cls :: Expr ClsASG)
            return u
        snd <$> ModuleProcessing.processModule' (unionsImports $ std : Map.elems deps) def (convert current) u
    modules . at current .= Just mod
    return mod



{-importWholeModule :: MonadPassManager m => Map QualName (Expr Unit) -> QualName -> SubPass ProjectCompilation m (CompiledWorld -> Imports)-}
{-importWholeModule modules modName = do-}
    {-let mod = Map.lookup modName modules-}
    {-res <- forM mod $ \unit -> do-}
        {-Term (Term.Unit _ _ cls) <- readTerm unit-}
        {-klass :: Expr Cls <- unsafeGeneralize <$> source cls-}
        {-Term (Term.Cls _ _ clss meths) <- readTerm klass-}
        {-classMap <- mapM source clss-}
        {-defMap   <- mapM source meths-}
        {-return $ \world -> let defs = Map.mapMaybe (\def -> world ^. functions . at (generalize def)) defMap-}
                               {-clss = Map.mapMaybe (\cls -> world ^. classes   . at (generalize cls)) classMap-}
                           {-in Imports clss defs-}
    {-return $ fromMaybe (error "could not find module") res-}

{-importAll :: MonadPassManager m => Map QualName (Expr Unit) -> [QualName] -> SubPass ProjectCompilation m (CompiledWorld -> Imports)-}
{-importAll modules moduleNames = fmap unionsImports . sequence <$> mapM (importWholeModule modules) moduleNames-}

{-createStdlib :: FilePath -> IO (IO (), Imports)-}
{-createStdlib stdPath = do-}
    {-res <- runPM False $ do-}
        {-(world, modules, std, cleanup) <- compileProject' [("Std", stdPath)] []-}
        {-Pass.eval' @ProjectCompilation $ do-}
            {-maker <- importAll modules (Map.keys modules)-}
            {-return $ (cleanup, unionImports std $ maker world)-}
    {-case res of-}
        {-Left e  -> throwM e-}
        {-Right r -> return r-}

{-compileProject :: (MonadPassManager m, Throws IRError m, Throws PassEvalError m) => Map Name FilePath -> [QualName] -> m (CompiledWorld, Map QualName (Expr Unit), Imports)-}
{-compileProject libs forceModules = do-}
    {-(world, modules, std, _) <- compileProject' libs forceModules-}
    {-return (world, modules, std)-}

{-compileProject' :: (MonadPassManager m, Throws IRError m, Throws PassEvalError m) => Map Name FilePath -> [QualName] -> m (CompiledWorld, Map QualName (Expr Unit), Imports, IO ())-}
{-compileProject' libs forceModules = do-}
    {-sources    <- liftIO $ mapM (Project.findProjectSources <=< Path.parseAbsDir) libs-}
    {-runRegs-}

    {-Loc.init-}
    {-attachLayer 5 (getTypeDesc @Pos.Range)         (getTypeDesc @AnyExpr)-}
    {-{-Parser.init-}-}
    {-{-attachLayer 5 (getTypeDesc @Parser.Parser)     (getTypeDesc @AnyExpr)-}-}
    {-CodeSpan.init-}
    {-attachLayer 5 (getTypeDesc @CodeSpan.CodeSpan) (getTypeDesc @AnyExpr)-}
    {-initNameGen-}
    {-setAttr (getTypeDesc @Parser.MarkedExprMap)   $ (mempty :: Parser.MarkedExprMap)-}
    {-setAttr (getTypeDesc @Parser.ParsedExpr)      $ (error "Data not provided: ParsedExpr")-}
    {-setAttr (getTypeDesc @Parser.ReparsingStatus) $ (mempty :: Parser.ReparsingStatus)-}
    {-setAttr (getTypeDesc @WorldExpr)     (undefined :: WorldExpr)-}
    {-setAttr (getTypeDesc @Source.Source) (undefined :: Source.Source)-}
    {-setAttr (getTypeDesc @Invalids)               $ (mempty :: Invalids)-}
    {-Pass.eval' initWorld-}

    {-let mkUnitTree srcMap = foldl (\t n -> TreeSet.insert (convert n) t) def (fmap snd . Bimap.toList $ srcMap)-}
    {-setAttr (getTypeDesc @UnitSet) (wrap $ mkUnitTree <$> sources :: UnitSet)-}
    {-Pass.eval' @UL.UnitInitializer UL.runUnitInitializer-}

    {-setAttr (getTypeDesc @UL.UnitsToLoad) (mempty :: UL.UnitsToLoad)-}
    {-setAttr (getTypeDesc @UL.UnitsToLoadRequest) (wrap (forceModules ++ stdlibImports) :: UL.UnitsToLoadRequest)-}
    {-Pass.eval' @UL.UnitRequester UL.unitRequester-}

    {-let mkSourcesMap libName sources = foldl (\m (p, n) -> Map.insert (fromList $ (libName :) $ toList n) (UL.Source (Path.toFilePath p) "") m) def (Bimap.toList sources)-}

    {-setAttr (getTypeDesc @UL.SourcesManager) (UL.fsSourceManager $ Map.unions $ uncurry mkSourcesMap <$> Map.toList sources)-}

    {-Pass.eval' @UL.UnitLoader      UL.unitLoader-}
    {-Pass.eval' @UL.ImportsResolver UL.importsResolver-}


    {-Just (WorldExpr root) <- unsafeCoerce <$> unsafeGetAttr (getTypeDesc @WorldExpr)-}

    {-(modules, stdImportsMaker) <- Pass.eval' @ProjectCompilation $ do-}
        {-allModules <- fmap (Map.mapMaybe id) $ matchExpr root $ \case-}
            {-World m -> iforM m $ \n u -> do-}
                {-unit <- source u-}
                {-matchExpr unit $ \case-}
                    {-Unit{} -> return $ Just (convert n, unsafeGeneralize unit)-}
                    {-_      -> return Nothing-}
            {-_       -> error "malformed world"-}
        {-stdImps <- importAll (snd <$> allModules) stdlibImports-}
        {-return (allModules, stdImps)-}

    {-(world, clean, std) <- mdo-}
        {-(clean, std) <- liftIO $ systemStd $ stdImportsMaker world-}
        {-results      <- forM modules $ uncurry $ ModuleProcessing.processModule std world-}
        {-let world = unionsWorlds $ Map.elems results-}
        {-return (world, clean, std)-}

    {-return (world, (snd <$> modules), std, clean)-}
