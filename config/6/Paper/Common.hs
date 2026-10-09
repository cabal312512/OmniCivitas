{-# LANGUAGE OverloadedStrings #-}
module Paper.Common
  ( Request(..), Kind(..), Check(..), Finding(..), Slot(..), Receipt(..)
  , requestValue, kindText, requireKeys, ensure, getField, optionalField
  , textValue, jsonText, checked, failed, kindOf
  ) where

import Control.Monad (unless)
import Data.Aeson
import Data.Aeson.Types (Parser, parseEither)
import qualified Data.Aeson.Key as K
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteString.Lazy as BL
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import qualified Data.Vector as V
import qualified Paper.Data as Settings

data Kind = Matrix | Base | Json | Csv deriving (Eq, Show)
data Request = Request
  { requestKind :: Kind
  , requestInput :: Value
  , requestExpected :: Maybe Value
  } deriving (Show)
data Check = Check Text Bool Text deriving (Show)
data Finding = Finding
  { answer :: Value
  , explanation :: [Text]
  , evidence :: [Check]
  , cautions :: [Text]
  } deriving (Show)

-- This current adapter writes an array, not a second public result schema.
data Slot = Slot Kind Value [Check] deriving (Show)
data Receipt = Receipt
  { receiptKind :: Kind
  , receiptValid :: Bool
  , receiptDigest :: Text
  , receiptFinding :: Finding
  } deriving (Show)

kindText :: Kind -> Text
kindText Matrix = "matrix"
kindText Base = "base"
kindText Json = "json"
kindText Csv = "csv"

instance ToJSON Kind where toJSON = String . kindText
instance FromJSON Kind where
  parseJSON = withText "kind" $ \t -> case t of
    "matrix" -> pure Matrix
    "base" -> pure Base
    "json" -> pure Json
    "csv" -> pure Csv
    _ -> fail "kind must be matrix, base, json, or csv"

instance FromJSON Request where
  parseJSON = withObject "certificate request" $ \o -> do
    strictKeys ["schema", "kind", "input", "expected"] o
    schema <- o .: "schema"
    unless (schema == Settings.requestSchema) $ fail "unsupported request schema"
    kind <- o .: "kind"
    input <- o .: "input"
    _ <- withObject "structured kind input" pure input
    expected <- o .:? "expected"
    pure $ Request kind input expected

instance ToJSON Check where
  toJSON (Check name pass detail) = object ["name" .= name, "passed" .= pass, "detail" .= detail]
instance FromJSON Check where
  parseJSON = withObject "check" $ \o -> Check <$> o .: "name" <*> o .: "passed" <*> o .: "detail"
instance ToJSON Slot where
  toJSON (Slot kind result checks) = toJSON [String "1", toJSON checks, toJSON kind, result]
instance FromJSON Slot where
  parseJSON = withArray "slot" $ \a -> do
    unless (V.length a == 4 && a V.! 0 == String "1") $ fail "unsupported slot layout"
    Slot <$> parseJSON (a V.! 2) <*> pure (a V.! 3) <*> parseJSON (a V.! 1)

strictKeys :: [Text] -> Object -> Parser ()
strictKeys allowed o = unless (all (`elem` allowed) (map K.toText $ KM.keys o)) $ fail "unexpected input field"

requireKeys :: [Text] -> Value -> Either Text ()
requireKeys allowed = either (Left . T.pack) Right . parseEither (withObject "input" (strictKeys allowed))

getField :: FromJSON a => Text -> Value -> Either Text a
getField name = either (Left . T.pack) Right . parseEither (withObject "input" (.: K.fromText name))

optionalField :: FromJSON a => Text -> a -> Value -> Either Text a
optionalField name fallback = either (Left . T.pack) Right . parseEither (withObject "input" (\o -> o .:? K.fromText name .!= fallback))

ensure :: Bool -> Text -> Either Text ()
ensure condition message = if condition then Right () else Left message

textValue :: Value -> Either Text Text
textValue (String t) = Right t
textValue _ = Left "expected a text value"

jsonText :: ToJSON a => a -> Text
jsonText = TE.decodeUtf8 . BL.toStrict . encode

requestValue :: Request -> Value
requestValue request = object ["schema" .= Settings.requestSchema, "kind" .= requestKind request, "input" .= requestInput request]

checked :: Text -> Text -> Check
checked name = Check name True
failed :: Text -> Text -> Check
failed name = Check name False

kindOf :: Value -> Text
kindOf (Object _) = "object"
kindOf (Array _) = "array"
kindOf (String _) = "string"
kindOf (Number _) = "number"
kindOf (Bool _) = "boolean"
kindOf Null = "null"
