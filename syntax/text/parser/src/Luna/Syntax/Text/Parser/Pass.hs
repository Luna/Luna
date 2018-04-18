{-# LANGUAGE NoMonomorphismRestriction #-}
{-# LANGUAGE UndecidableInstances      #-}
{-# EXT      InlineAll                 #-}

module Luna.Syntax.Text.Parser.Pass where

import Prologue

import qualified Control.Monad.State.Layered         as State
import qualified Luna.IR                             as IR
import qualified Luna.IR.Component.Term.Construction as Term
import qualified Luna.Pass                           as Pass
import qualified Luna.Pass.Attr                      as Attr
import qualified Luna.Pass.Scheduler                 as Scheduler
import qualified Luna.Syntax.Text.Lexer              as Lexer
import qualified Luna.Syntax.Text.Parser.Class       as Parser
import qualified Luna.Syntax.Text.Parser.Parser      as Class
import qualified Luna.Syntax.Text.Parser.Parser      as Token
import qualified Luna.Syntax.Text.Parser.Parsing     as Parsing
import qualified OCI.Pass.Registry                   as Registry
import qualified Text.Megaparsec                     as Parser

import Control.Monad.State.Layered       (StatesT)
import Control.Monad.State.Layered       (StateT)
import Data.Text.Position                (FileOffset)
import Data.Text32                       (Text32)
import Luna.Pass                         (Pass)
import Luna.Syntax.Text.Parser.Class     (Error)
import Luna.Syntax.Text.Parser.Class     (Stream)
import Luna.Syntax.Text.Parser.Class     (Parser)
import Luna.Syntax.Text.Parser.Class     (IRBS)
import Luna.Syntax.Text.Parser.Class     (fromIRBS)
import Luna.Syntax.Text.Parser.CodeSpan  (CodeSpan, CodeSpanRange)
import Luna.Syntax.Text.Parser.Errors    (Invalids)
import Luna.Syntax.Text.Parser.Hardcoded (hardcode)
import Luna.Syntax.Text.Parser.Loc       (LeftSpanner)
import Luna.Syntax.Text.Parser.Marker    (MarkedExprMap, MarkerState,
                                          UnmarkedExprs)
import Luna.Syntax.Text.Parser.Parser    (ParserBase)
import Luna.Syntax.Text.Parser.Reserved  (Reservation)
import Luna.Syntax.Text.Scope            (Scope)
import Luna.Syntax.Text.Source           (Source)
import Text.Megaparsec                   (ParseError, ParsecT)
import Text.Megaparsec.Error             (parseErrorPretty)
import Text.Parser.Backend.Megaparsec    ()
import Text.Parser.Indent                (Indent)


-------------------------
-- === Parser pass === --
-------------------------

-- === Definition === --

instance Pass.Definition Parser where
    definition = do
        src             <- Attr.get @Source
        (unit, markers) <- runParser__ Parsing.unit (convert src)
        return ()


-- === API === --

registerStatic :: Registry.Monad m => m ()
registerStatic = do
    Registry.registerPrimLayer @IR.Terms @CodeSpan

registerDynamic :: Scheduler.Monad m => m ()
registerDynamic = do
    Scheduler.registerAttr     @Invalids
    Scheduler.enableAttrByType @Invalids
    Scheduler.registerAttr     @Source
    Scheduler.enableAttrByType @Source
    Scheduler.registerPass     @Parser


-- === Internal === --

runParsec__ :: MonadIO m =>
    ParserBase a -> Stream -> m (Either (ParseError Parser.Tok Error) a)
runParsec__ p s = liftIO $ Parser.runParserT p "" s ; {-# INLINE runParsec__ #-}

runParserContext__ :: MonadIO m =>
    Class.Parser a -> Stream -> m (Either (ParseError Parser.Tok Error) a)
runParserContext__ p s
    = flip runParsec__ s
    $ State.evalDefT @CodeSpanRange
    $ State.evalDefT @Reservation
    $ State.evalDefT @Scope
    $ State.evalDefT @LeftSpanner
    $ State.evalDefT @MarkerState
    -- $ State.evalDefT @Position
    $ State.evalDefT @FileOffset
    $ State.evalDefT @Indent
    $ hardcode >> p
{-# INLINE runParserContext__ #-}

runParser__ :: Token.Parser (IRBS a) -> Text32 -> Pass Parser (a, MarkedExprMap)
runParser__ p src = do
    let tokens = Lexer.evalDefLexer src
        parser = Parsing.stx *> p <* Parsing.etx
    runParserContext__ parser tokens >>= \case
        Left e -> error ("Parser error: " <> parseErrorPretty e)
        Right irbs -> do
            ((ref, unmarked), gidMap) <- State.runDefT @MarkedExprMap
                                        $ State.runDefT @UnmarkedExprs
                                        $ fromIRBS irbs
            pure (ref, gidMap)




