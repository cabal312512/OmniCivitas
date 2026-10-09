{-# LANGUAGE OverloadedStrings #-}
module Main where

import Control.Monad (unless)
import Data.Aeson
import qualified Data.Aeson.Key as K
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteString.Lazy.Char8 as BL
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import System.Exit (exitFailure)
import Paper.Common
import Paper.Common2 (issue, representation)
import Old.Common (digest, csvText, parseCsv)

data Case = Case Text Bool

check :: Text -> Bool -> Case
check = Case

valueAt :: Text -> Value -> Value
valueAt key (Object o) = maybe Null id $ KM.lookup (K.fromText key) o
valueAt _ _ = Null

run :: Kind -> Value -> Maybe Value -> Receipt
run kind input expected = issue $ Request kind input expected

matrixInput :: Text -> Text -> Text -> Value
matrixInput operation a b = object ["operation" .= operation, "a" .= a, "b" .= b]

baseInput :: Text -> Int -> Int -> Value
baseInput value from to = object ["value" .= value, "from" .= from, "to" .= to]

sourceInput :: Text -> Value
sourceInput source = object ["source" .= source]

valid :: Receipt -> Bool
valid = receiptValid

resultAt :: Text -> Receipt -> Value
resultAt key = valueAt key . answer . receiptFinding

cases :: [Case]
cases =
  [ check "decimal-add-exact-3/10-and-tolerant-frontend" $ valid decimal && resultAt "exact" decimal == toJSON ([["3/10","0/1"],["0/1","0/1"]] :: [[Text]])
  , check "matrix-subtraction" $ valid subtraction && resultAt "exact" subtraction == toJSON ([["-3/1","-1/1"],["1/1","3/1"]] :: [[Text]])
  , check "2x2-determinant-negative" $ valid negativeDet && resultAt "exact" negativeDet == String "-2/1"
  , check "singular-determinant-zero-is-valid" $ valid singular && resultAt "exact" singular == String "0/1" && not (null $ cautions $ receiptFinding singular)
  , check "3x3-determinant-closed-form" $ valid determinant3 && resultAt "exact" determinant3 == String "1/1"
  , check "tiny-decimal-precise-rational" $ valid tiny && resultAt "exact" tiny == String "1/10000000000000000000000000000000000000000"
  , check "wrong-original-value-fails-certificate" $ not $ valid $ run Matrix (matrixInput "determinant" "[[1,2],[3,4]]" "") $ Just $ String "-3"
  , check "wrong-original-result-shape-fails" $ not $ valid $ run Matrix (matrixInput "add" "[[1,2],[3,4]]" "[[1,2],[3,4]]") $ Just $ String "2\t4"
  , check "unsupported-matrix-multiply" $ not $ valid $ run Matrix (matrixInput "multiply" "[[1,2],[3,4]]" "[[1,2],[3,4]]") Nothing
  , check "4x4-not-silently-expanded" $ not $ valid $ run Matrix (matrixInput "determinant" "[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]" "") Nothing
  , check "matrix-JSON-string-cell-rejected" $ not $ valid $ run Matrix (matrixInput "determinant" "[[\"1\",2],[3,4]]" "") Nothing
  , check "matrix-infinite-frontend-number-rejected" $ not $ valid $ run Matrix (matrixInput "determinant" "[[1e309,0],[0,1]]" "") Nothing
  , check "certificate-exponent-bound-explicit" $ not $ valid $ run Matrix (matrixInput "determinant" "[[1e-100000,0],[0,1]]" "") Nothing
  , check "negative-hex-prefix-to-binary" $ valid negativeBase && resultAt "text" negativeBase == String "-11111111"
  , check "integer-beyond-JS-safe-integer-preserved" $ valid bigBase && resultAt "text" bigBase == String "20000000000001"
  , check "negative-zero-canonicalized" $ valid zeroBase && resultAt "text" zeroBase == String "0"
  , check "base-source-2048digits-accepted" $ valid $ run Base (baseInput (T.replicate 2048 "f") 16 2) Nothing
  , check "base-source-2049digits-rejected" $ not $ valid $ run Base (baseInput (T.replicate 2049 "f") 16 2) Nothing
  , check "unsupported-base-3" $ not $ valid $ run Base (baseInput "10" 3 10) Nothing
  , check "wrong-base-digit" $ not $ valid $ run Base (baseInput "2" 2 10) Nothing
  , check "base-display-mismatch" $ not $ valid $ run Base (baseInput "15" 10 16) (Just $ String "e")
  , check "JSON-root-and-required-keys-schema" $ valid jsonGood && resultAt "root" jsonGood == String "object"
  , check "JSON-malformed-diagnostic" $ not $ valid $ run Json (sourceInput "{\"a\":}") Nothing
  , check "JSON-required-key-missing" $ not $ valid $ run Json jsonMissing Nothing
  , check "JSON-supplied-wrong-root-schema" $ not $ valid $ run Json (object ["source" .= ("[]" :: Text), "structure" .= object ["root" .= ("object" :: Text)]]) Nothing
  , check "JSON-unsafe-integer-retains-original-rule" $ not $ valid $ run Json (sourceInput "{\"large\":9007199254740993}") Nothing
  , check "JSON-bounded-nesting" $ not $ valid $ run Json (sourceInput $ T.replicate 33 "[" <> "0" <> T.replicate 33 "]") Nothing
  , check "JSON-64KiB-subset-bound" $ not $ valid $ run Json (sourceInput $ "\"" <> T.replicate 65536 "x" <> "\"") Nothing
  , check "JSON-mismatched-string-not-numeric-tolerance" $ not $ valid $ run Json (sourceInput "{\"a\":\"first\"}") (Just $ String "{\"a\":\"second\"}")
  , check "CSV-quoted-comma-doubled-quote-and-newline" $ valid csvGood && resultAt "rowCount" csvGood == toJSON (2 :: Int)
  , check "CSV-unclosed-quote" $ not $ valid $ run Csv (sourceInput "a,b\n1,\"missing") Nothing
  , check "CSV-wrong-width-schema" $ not $ valid $ run Csv (object ["source" .= ("a,b\n1" :: Text), "structure" .= object ["width" .= (2 :: Int)]]) Nothing
  , check "CSV-ragged-rows-retained-with-warning" $ valid ragged && resultAt "rectangular" ragged == Bool False && not (null $ cautions $ receiptFinding ragged)
  , check "CSV-trailing-empty-row-preserved" $ valid trailing && resultAt "rowCount" trailing == toJSON (2 :: Int)
  , check "CSV-original-text-mismatch" $ not $ valid $ run Csv (sourceInput "a,b\n1,2") (Just $ String "a,b\r\n1,3")
  , check "CSV-string-table-original-result" $ valid $ run Csv (sourceInput "a,b\n1,2") (Just $ toJSON ([["a","b"],["1","2"]] :: [[Text]]))
  , check "CSV-column-order-is-explicit" $ not $ valid $ run Csv (object ["source" .= ("a,b\n1,2" :: Text), "header" .= True, "structure" .= object ["columns" .= (["b","a"] :: [Text])]]) Nothing
  , check "unknown-structured-field-rejected" $ not $ valid $ run Base (object ["value" .= ("10" :: Text), "from" .= (10 :: Int), "to" .= (16 :: Int), "code" .= ("ignored" :: Text)]) Nothing
  , check "strict-request-schema-version" $ case (fromJSON $ object ["schema" .= ("wrong" :: Text), "kind" .= ("base" :: Text), "input" .= baseInput "10" 10 16] :: Result Request) of Error _ -> True; _ -> False
  , check "certificate-JSON-and-CSV-actual-roundtrip" $ downloadRoundtrip decimal
  , check "canonical-digest-independent-of-object-key-order" $ digest (object ["b" .= (2 :: Int), "a" .= (1 :: Int)]) == digest (object ["a" .= (1 :: Int), "b" .= (2 :: Int)])
  , check "SHA256-known-null-vector" $ digest Null == "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b"
  , check "expected-display-excluded-from-input-digest" $ receiptDigest negativeDet == receiptDigest (run Matrix (matrixInput "determinant" "[[1,2],[3,4]]" "") Nothing)
  ]
  where
    decimal = run Matrix (matrixInput "add" "[[0.1,0],[0,0]]" "[[0.2,0],[0,0]]") $ Just $ String "0.30000000000000004\t0\n0\t0"
    subtraction = run Matrix (matrixInput "subtract" "[[1,2],[3,4]]" "[[4,3],[2,1]]") Nothing
    negativeDet = run Matrix (matrixInput "determinant" "[[1,2],[3,4]]" "") $ Just $ String "-2"
    singular = run Matrix (matrixInput "determinant" "[[1,2],[2,4]]" "") $ Just $ String "0"
    determinant3 = run Matrix (matrixInput "determinant" "[[1,2,3],[0,1,4],[5,6,0]]" "") $ Just $ String "1"
    tiny = run Matrix (matrixInput "determinant" "[[1e-20,0],[0,1e-20]]" "") Nothing
    negativeBase = run Base (baseInput "-0xFF" 16 2) $ Just $ String "-11111111"
    bigBase = run Base (baseInput "9007199254740993" 10 16) $ Just $ String "20000000000001"
    zeroBase = run Base (baseInput "-0" 10 16) $ Just $ String "0"
    jsonGood = run Json (object ["source" .= ("{\"a\":0.1,\"list\":[true,null]}" :: Text), "structure" .= object ["root" .= ("object" :: Text), "requiredKeys" .= (["a","list"] :: [Text])]]) $ Just $ String "{\"list\":[true,null],\"a\":0.1}"
    jsonMissing = object ["source" .= ("{\"a\":1}" :: Text), "structure" .= object ["root" .= ("object" :: Text), "requiredKeys" .= (["b"] :: [Text])]]
    quoted :: Text
    quoted = "name,note\r\nOCV,\"comma, and \"\"quote\"\"\nline\""
    csvGood = run Csv (object ["source" .= quoted, "header" .= True, "structure" .= object ["width" .= (2 :: Int), "columns" .= (["name","note"] :: [Text])]]) $ Just $ String $ csvText [["name","note"],["OCV","comma, and \"quote\"\nline"]]
    ragged = run Csv (sourceInput "a,b\n1") Nothing
    trailing = run Csv (sourceInput "a,b\n") Nothing

downloadRoundtrip :: Receipt -> Bool
downloadRoundtrip receipt =
  let full = representation receipt
      downloads = valueAt "download" full
      json = valueAt "text" $ valueAt "json" downloads
      csv = valueAt "text" $ valueAt "csv" downloads
  in case (json,csv) of
    (String jsonText', String csvText') -> case (eitherDecodeStrict' (TE.encodeUtf8 jsonText') :: Either String Value, parseCsv ',' csvText') of
      (Right recovered, Right [header,[_,_,_,embedded]]) -> header == ["schema","kind","valid","certificateJson"] && embedded == jsonText' && valueAt "valid" recovered == Bool (receiptValid receipt) && valueAt "inputDigest" recovered == String (receiptDigest receipt)
      _ -> False
    _ -> False

main :: IO ()
main = do
  let passed = all (\(Case _ success) -> success) cases
  BL.putStrLn $ encode $ object ["schema" .= ("ocv.tool-certificate-fixtures/1" :: Text), "passed" .= passed, "count" .= length cases, "cases" .= [object ["name" .= name, "passed" .= success] | Case name success <- cases]]
  unless passed exitFailure
