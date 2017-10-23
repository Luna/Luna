{-# LANGUAGE OverloadedStrings  #-}
{-# LANGUAGE OverloadedLists    #-}
{-# LANGUAGE CPP                #-}

module Luna.Shell where

import           Luna.Prelude        hiding (String, seq, cons, Constructor)
import qualified Luna.Prelude        as P
import qualified Data.Map            as Map
import           Data.Map            (Map)
import qualified Data.TreeSet        as TreeSet
import qualified Data.Bimap          as Bimap

import Luna.Builtin.Std
import qualified OCI.Pass           as Pass
import           OCI.Pass           (SubPass, Preserves, Inputs, Outputs)
import qualified OCI.IR.Repr.Vis    as Vis
import OCI.IR.Name.Qualified
import Luna.IR
import Luna.IR.Term.Unit (UnitSet)
import Luna.IR.Term.Cls  (Cls)
import Luna.Syntax.Text.Parser.Errors (Invalids)
import qualified Luna.IR.Term.Unit  as Term
import qualified Luna.IR.Term.Cls   as Term
import Luna.Builtin.Data.Module     as Module
import Luna.Builtin.Data.Class
import Luna.Builtin.Data.LunaEff
import Luna.Builtin.Data.LunaValue  as LunaValue
import qualified Luna.Builtin.Data.Function   as Function

import Luna.IR.Layer.Errors
import Luna.Pass.Data.UniqueNameGen
import Luna.Pass.Data.ExprRoots

import qualified Luna.Syntax.Text.Parser.Parser   as Parser
import qualified Luna.Syntax.Text.Source          as Source
import qualified Luna.Syntax.Text.Parser.Parsing  as Parsing
import qualified Luna.Syntax.Text.Parser.Class    as Parsing
import qualified Luna.Syntax.Text.Parser.Marker   as Parser (MarkedExprMap)
import qualified Luna.Syntax.Text.Parser.CodeSpan as CodeSpan
import qualified Luna.Syntax.Text.Layer.Loc       as Loc

import Luna.Test.IR.Runner
import Data.TypeDesc
import System.IO.Unsafe

import qualified Luna.Pass.Transform.Desugaring.RemoveGrouped  as RemoveGrouped
import qualified Luna.Pass.UnitCompilation.ModuleProcessing    as ModuleProcessing
import qualified Luna.Pass.Sourcing.UnitLoader as UL

import qualified Luna.Project       as Project
import qualified Luna.Compilation   as Project
import           System.Directory   (getCurrentDirectory)
import qualified Path               as Path
import qualified System.Environment as Env

import System.Exit (die)

import Data.Layout as Layout
import qualified Data.Text.Terminal as Terminal

data ShellTest
type instance Abstract ShellTest = ShellTest
type instance Inputs  Net   ShellTest = '[AnyExpr]
type instance Outputs Net   ShellTest = '[AnyExpr]
type instance Inputs  Layer ShellTest = '[AnyExpr // Model, AnyExpr // UID, Link' AnyExpr // UID, Link' AnyExpr // Model, AnyExpr // Succs]
type instance Outputs Layer ShellTest = '[]
type instance Inputs  Attr  ShellTest = '[Parser.ReparsingStatus, WorldExpr]
type instance Outputs Attr  ShellTest = '[]
type instance Inputs  Event ShellTest = '[]
type instance Outputs Event ShellTest = '[New // AnyExpr]
type instance Preserves     ShellTest = '[]

errorsEnumerator :: Doc Terminal.TermText
#ifdef mingw32_HOST_OS
errorsEnumerator = "-"
#else
errorsEnumerator = "•"
#endif

stackItemEnumerator :: Doc Terminal.TermText
#ifdef mingw32_HOST_OS
stackItemEnumerator = "-"
#else
stackItemEnumerator = "↳ "
#endif

colon :: Doc Terminal.TermText
colon = ":"

formatStack :: [ModuleTagged ErrorSource] -> Doc Terminal.TermText
formatStack items = enumsCol Layout.<+> modsCol Layout.<+> colonsCol Layout.<+> defCol where
    colonsCol = Layout.nested $ foldl (</>) mempty (colon <$ items)
    enumsCol  = Layout.nested $ foldl (</>) mempty (stackItemEnumerator <$ items)

    modsCol  = Layout.nested $ foldl (</>) mempty (convert      . view moduleTag <$> items)
    defCol   = Layout.nested $ foldl (</>) mempty (formatSource . view contents  <$> items)

    formatSource (FromFunction n) = convert n
    formatSource (FromMethod c n) = convert c <> "." <> convert n

formatError :: CompileError -> Doc Terminal.TermText
formatError (CompileError txt reqStack stack) = Layout.nested (convert txt) </> (Layout.indented $ Layout.nested $ arisingBlock </> requiredBlock) where
    arisingFrom   = "Arising from:"
    requiredBy    = "Required by:"
    arisingStack  = Layout.nested (formatStack $ reverse stack)
    requiredStack = Layout.nested (formatStack reqStack)
    arisingBlock  = arisingFrom </> Layout.indented arisingStack
    requiredBlock = if null reqStack then Layout.phantom else requiredBy  </> Layout.indented requiredStack

formatErrors :: [CompileError] -> Doc Terminal.TermText
formatErrors errs = foldl (<//>) mempty items where
    items = Layout.nested . (errorsEnumerator Layout.<+>) . formatError <$> errs


{-main' :: IO ()-}
{-main' = void $ runPM True $ do-}
    {-stdPath  <- (<> "/Std/") <$> liftIO (Env.getEnv "LUNA_HOME")-}
    {-mainPath <- liftIO $ getCurrentDirectory-}

    {-(world, modules, _) <- Project.compileProject (Map.fromList [("Std", stdPath), ("Main", mainPath)]) [["Main", "Main"]]-}

    {-main <- Pass.eval' @Project.ProjectCompilation $ do-}
        {-let mainModule = Map.lookup ["Main", "Main"] modules-}
        {-case mainModule of-}
            {-Just unit -> do-}
                {-Term (Term.Unit _ _ cls) <- readTerm unit-}
                {-klass :: Expr Cls <- unsafeGeneralize <$> source cls-}
                {-Term (Term.Cls _ _ _ meths) <- readTerm klass-}
                {-main <- mapM (fmap unsafeGeneralize . source) $ Map.lookup "main" meths-}
                {-return main-}
            {-Nothing -> return Nothing-}

    {-let mainFun = case main of-}
          {-Just m  -> world ^. functions . at m-}
          {-Nothing -> Nothing-}


    {-case mainFun of-}
        {-Just (Left e)  -> do-}
            {-putStrLn "Luna encountered the following compilation errors:"-}
            {-Terminal.putStrLn $ Layout.concatLineBlock $ Layout.render $ formatErrors e-}
            {-putStrLn ""-}
            {-liftIO $ die "Compilation failed."-}
        {-Just (Right f) -> do-}
            {-putStrLn "Running main..."-}
            {-res <- liftIO $ runIO $ runError $ LunaValue.force $ f ^. Function.value-}
            {-case res of-}
                {-Left err -> error $ "Luna encountered runtime error: " ++ err-}
                {-_        -> return ()-}
        {-Nothing -> error "Function main not found in module Main."-}

main :: IO ()
main = do
    stdPath   <- (<> "/Std/") <$> Env.getEnv "LUNA_HOME"
    mainPath  <- getCurrentDirectory
    (_, std)  <- Project.prepareStdlib  (Map.fromList [("Std", stdPath)])
    Right (_, imp) <- Project.requestModules (Map.fromList [("Std", stdPath), ("Main", mainPath)]) ["Main.Main"] std
    let mainFun = imp ^? Project.modules . ix ["Main", "Main"] . importedFunctions . ix "main"
    case mainFun of
        Just (Left e)  -> do
            putStrLn "Luna encountered the following compilation errors:"
            Terminal.putStrLn $ Layout.concatLineBlock $ Layout.render $ formatErrors e
            putStrLn ""
            liftIO $ die "Compilation failed."
        Just (Right f) -> do
            putStrLn "Running main..."
            res <- liftIO $ runIO $ runError $ LunaValue.force $ f ^. Function.value
            case res of
                Left err -> error $ "Luna encountered runtime error: " ++ err
                _        -> return ()
        Nothing -> error "Function main not found in module Main."
