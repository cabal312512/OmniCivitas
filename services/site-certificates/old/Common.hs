{-# LANGUAGE OverloadedStrings #-}
module Old.Common (jsonStructure, csvStructure, parseCsv, csvText, digest, canonicalText, lexicalDepth) where

import Data.Aeson
import qualified Data.Aeson.Key as K
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteString as BS
import qualified Crypto.Hash.SHA256 as SHA256
import Data.List (sortOn)
import Data.Scientific (toRealFloat, base10Exponent)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import qualified Data.Vector as V
import Numeric (showHex)
import Paper.Common
import qualified Paper.Data as Limits

canonicalText :: Value -> Text
canonicalText (Object o) = "{" <> T.intercalate "," [jsonText name <> ":" <> canonicalText value | (name, value) <- sortOn fst [(K.toText k,v) | (k,v) <- KM.toList o]] <> "}"
canonicalText (Array a) = "[" <> T.intercalate "," (map canonicalText $ V.toList a) <> "]"
canonicalText scalar = jsonText scalar

digest :: Value -> Text
digest = T.pack . concatMap (\n -> let hex = showHex n "" in if length hex == 1 then '0':hex else hex) . BS.unpack . SHA256.hash . TE.encodeUtf8 . canonicalText

boundedSource :: Value -> Either Text Text
boundedSource input = do
  text <- getField "source" input
  ensure (BS.length (TE.encodeUtf8 text) <= Limits.inputBytes Limits.current) "format certificate source is limited to 64 KiB; original frontend tool limit is retained"
  pure text

preflight :: Text -> Either Text ()
preflight = lexicalDepth (Limits.jsonDepth Limits.current)

lexicalDepth :: Int -> Text -> Either Text ()
lexicalDepth ceiling = go 0 False False . T.unpack
  where
    go _ True _ [] = Left "unterminated JSON string"
    go _ _ _ [] = Right ()
    go depth quoted escaped (c:rest)
      | quoted && escaped = go depth True False rest
      | quoted && c == '\\' = go depth True True rest
      | c == '"' = go depth (not quoted) False rest
      | quoted = go depth True False rest
      | c == '{' || c == '[' = do
          ensure (depth < ceiling) "JSON certificate nesting exceeds the bounded schema depth"
          go (depth+1) False False rest
      | c == '}' || c == ']' = go (depth-1) False False rest
      | otherwise = go depth False False rest

jsonStats :: Value -> Either Text (Int, Int)
jsonStats root = go 0 [root]
  where
    go count [] = pure (count, 0)
    go count (v:rest) = do
      ensure (count < Limits.jsonNodes Limits.current) "JSON certificate exceeds 8192 nodes"
      case v of
        Object o -> go (count+1) (KM.elems o ++ rest)
        Array a -> go (count+1) (V.toList a ++ rest)
        Number n -> do
          ensure (abs (toInteger $ base10Exponent n) <= toInteger (Limits.decimalPower Limits.current)) "JSON exponent exceeds certificate bound"
          let d = toRealFloat n :: Double
          ensure (not (isNaN d || isInfinite d)) "JSON number exceeds finite frontend semantics"
          ensure (d /= fromInteger (truncate d) || abs d <= 9007199254740991) "JSON integer exceeds original frontend safe integer bound; use a string"
          go (count+1) rest
        _ -> go (count+1) rest

structuralEqual :: Value -> Value -> Bool
structuralEqual (Object a) (Object b) = KM.size a == KM.size b && all (\(k,v) -> maybe False (structuralEqual v) $ KM.lookup k b) (KM.toList a)
structuralEqual (Array a) (Array b) = V.length a == V.length b && and (V.toList $ V.zipWith structuralEqual a b)
structuralEqual (Number a) (Number b) =
  let x = toRealFloat a :: Double; y = toRealFloat b :: Double
  in not (isNaN x || isNaN y || isInfinite x || isInfinite y) && abs (x-y) <= 1e-12 + 1e-10 * abs x
structuralEqual a b = a == b

jsonStructure :: Value -> Maybe Value -> Either Text Finding
jsonStructure input expected = do
  requireKeys ["source", "structure"] input
  source <- boundedSource input
  preflight source
  decoded <- either (const $ Left "invalid JSON syntax") Right $ eitherDecodeStrict' $ TE.encodeUtf8 source
  (nodes, _) <- jsonStats decoded
  structure <- optionalField "structure" (object []) input
  requireKeys ["root", "requiredKeys"] structure
  rootType <- optionalField "root" ("any" :: Text) structure
  required <- optionalField "requiredKeys" ([] :: [Text]) structure
  ensure (rootType `elem` ["any", "object", "array"]) "JSON structure root must be any, object, or array"
  ensure (length required <= 64 && all (\k -> not (T.null k) && T.length k <= 80) required) "requiredKeys supports at most 64 bounded field names"
  ensure (null required || rootType == "object") "requiredKeys requires an explicit object root schema"
  let rootOK = rootType == "any" || kindOf decoded == rootType
      keysOK = case decoded of Object o -> all (\key -> KM.member (K.fromText key) o) required; _ -> null required
  observed <- traverse parseExpected expected
  let checks = [checked "jsonSyntax" "Decoded finite JSON source", Check "rootSchema" rootOK ("Required root=" <> rootType), Check "requiredKeys" keysOK "Only presence is checked; this is not an arbitrary JSON Schema evaluator", Check "expectedComparison" (maybe True (structuralEqual decoded) observed) "Equivalent object/array/string/boolean/null structure; finite numeric displays use absolute 1e-12 + relative 1e-10 tolerance"]
  pure $ Finding (object ["root" .= kindOf decoded, "nodeCount" .= nodes, "normalizedDigest" .= digest decoded, "structure" .= structure]) ["Check UTF-8 size and JSON lexical depth before decoding", "Decode JSON and count nodes under a fixed budget", "Apply the supplied finite root/requiredKeys schema", "Compare decoded original frontend result when supplied"] checks ["Object duplicate-key uniqueness is not proved; certificate covers decoded structure", "Original frontend JSON formatting and finite-number display are retained"]
  where
    parseExpected (String source) = do
      ensure (BS.length (TE.encodeUtf8 source) <= Limits.inputBytes Limits.current) "expected JSON text exceeds 64 KiB"
      preflight source
      result <- either (const $ Left "expected JSON display cannot be decoded") Right $ eitherDecodeStrict' $ TE.encodeUtf8 source
      _ <- jsonStats result
      pure result
    parseExpected value = do
      _ <- jsonStats value
      pure value

data CsvMode = Start | Plain | Quoted | Closed deriving (Eq)

parseCsv :: Char -> Text -> Either Text [[Text]]
parseCsv delimiter source = go Start [] [] [] (T.unpack $ T.dropWhile (=='\xfeff') source)
  where
    limitRows rows = ensure (length rows < Limits.csvRows Limits.current) "CSV certificate exceeds 5000 rows"
    pushField field cells = do
      ensure (length cells < Limits.csvColumns Limits.current) "CSV certificate exceeds 256 columns"
      pure (T.pack (reverse field):cells)
    pushRow field cells rows = do
      current <- pushField field cells
      limitRows rows
      pure (reverse current:rows)
    go Quoted _ _ _ [] = Left "CSV quoted field is not closed"
    go _ field cells rows [] = reverse <$> pushRow field cells rows
    go mode field cells rows chars@(c:rest)
      | mode == Quoted && c == '"' = case rest of
          ('"':tail') -> go Quoted ('"':field) cells rows tail'
          _ -> go Closed field cells rows rest
      | mode == Quoted = go Quoted (c:field) cells rows rest
      | mode == Start && c == '"' = go Quoted field cells rows rest
      | c == delimiter = do
          next <- pushField field cells
          go Start [] next rows rest
      | c == '\n' || c == '\r' = do
          next <- pushRow field cells rows
          let remaining = if c == '\r' then case rest of ('\n':tail') -> tail'; _ -> rest else rest
          go Start [] [] next remaining
      | mode == Closed = Left "CSV contains text after a closing quote"
      | otherwise = go Plain (c:field) cells rows rest

csvText :: [[Text]] -> Text
csvText = T.intercalate "\r\n" . map (T.intercalate "," . map quote)
  where quote text = "\"" <> T.replace "\"" "\"\"" text <> "\""

csvStructure :: Value -> Maybe Value -> Either Text Finding
csvStructure input expected = do
  requireKeys ["source", "delimiter", "header", "structure"] input
  source <- boundedSource input
  delimiterText <- optionalField "delimiter" ("," :: Text) input
  ensure (delimiterText `elem` [",", ";", "\t"]) "CSV delimiter must be comma, semicolon, or tab"
  header <- optionalField "header" False input
  rows <- parseCsv (T.head delimiterText) source
  structure <- optionalField "structure" (object []) input
  requireKeys ["columns", "width"] structure
  columns <- optionalField "columns" ([] :: [Text]) structure
  width <- optionalField "width" (0 :: Int) structure
  ensure (width >= 0 && width <= Limits.csvColumns Limits.current && length columns <= Limits.csvColumns Limits.current) "CSV structure exceeds 256 columns"
  ensure (null columns || header) "CSV named columns require header=true"
  let rowWidths = map length rows
      rectangular = all (==head rowWidths) rowWidths
      widthOK = width == 0 || all (==width) rowWidths
      columnsOK = null columns || head rows == columns
  observed <- traverse (parseExpected $ T.head delimiterText) expected
  let checks = [checked "csvSyntax" "Quoted fields, doubled quotes, CR/LF/CRLF and quoted line breaks decoded", Check "widthSchema" widthOK "Width zero means unspecified; supplied width applies to every row", Check "columnSchema" columnsOK "Named header columns match exact order and content when supplied", Check "expectedComparison" (maybe True (==rows) observed) "Original CSV text or table must decode to exactly the same string cells"]
  pure $ Finding (object ["rowCount" .= length rows, "columnCount" .= maximum rowWidths, "rectangular" .= rectangular, "header" .= header, "tableDigest" .= digest (toJSON rows), "structure" .= structure]) ["Parse CSV with a four-state bounded quoted-field machine", "Check supplied width and ordered header-column schema", "Normalize cells with exact string equality and preserve trailing empty rows", "Compare decoded original frontend result when supplied"] checks ["Ragged CSV rows are retained; provide width to require a rectangle" | not rectangular]
  where
    parseExpected delimiter (String source) = do
      ensure (BS.length (TE.encodeUtf8 source) <= Limits.inputBytes Limits.current) "expected CSV display exceeds 64 KiB"
      parseCsv delimiter source
    parseExpected _ value = case fromJSON value of
      Success rows -> do
        ensure (length rows <= Limits.csvRows Limits.current && all ((<=Limits.csvColumns Limits.current) . length) (rows :: [[Text]])) "expected CSV table exceeds bounds"
        pure rows
      Error _ -> Left "expected CSV must be rendered text or a table of strings"
