{-# LANGUAGE OverloadedStrings #-}
module Paper.Data where

import Data.Text (Text)

data Config = Config
  { inputBytes :: Int
  , jsonDepth :: Int
  , jsonNodes :: Int
  , csvRows :: Int
  , csvColumns :: Int
  , decimalPower :: Int
  , fractionDigits :: Int
  , requestBytes :: Int
  }

current :: Config
current = Config 65536 32 8192 5000 256 1024 8192 196608

requestSchema, formatVersion :: Text
requestSchema = "ocv.tool-certificate/1"
formatVersion = "1"

absoluteTolerance, relativeTolerance :: Rational
absoluteTolerance = 1 / (10 ^ (12 :: Int))
relativeTolerance = 1 / (10 ^ (10 :: Int))
