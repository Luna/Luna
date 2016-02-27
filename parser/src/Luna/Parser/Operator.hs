{-# LANGUAGE TemplateHaskell #-}

module Luna.Parser.Operator where

import           Prelude.Luna
import qualified Data.Map            as Map
import           Data.Map            (Map)


------------------------------------------------------------------------
-- Data Types
------------------------------------------------------------------------

type Precedence  = Int
type Name        = String
type OperatorMap = Map Name Operator

data Fixity = Prefix
            | Infix
            | PostFix
            deriving (Show)


data Associativity = None
                   | Left
                   | Right
                   deriving (Show)


data Operator = Operator { _precedence    :: Precedence
                         , _fixity        :: Fixity
                         , _associativity :: Associativity
                         } deriving (Show)

makeLenses ''Operator

