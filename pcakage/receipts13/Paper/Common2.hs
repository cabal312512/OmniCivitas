{-# LANGUAGE OverloadedStrings #-}
module Paper.Common2 (issue, representation) where

import Data.Aeson
import qualified Data.Aeson.KeyMap as KM
import Data.Text (Text)
import qualified Data.Text as T
import Invoice.Data (matrix, radix)
import Old.Common (jsonStructure, csvStructure, csvText, parseCsv, digest)
import Paper.Common
import qualified Paper.Data as Settings

type Factory = Value -> Maybe Value -> Either Text Finding

aaa :: Kind -> Factory
aaa Matrix = matrix
aaa Base = radix
aaa Json = jsonStructure
aaa Csv = csvStructure

issue :: Request -> Receipt
issue request = Receipt (requestKind request) (all passed $ evidence result) (digest $ requestValue request) result
  where
    computed = aaa (requestKind request) (requestInput request) (requestExpected request)
    result = case computed of
      Left message -> Finding Null ["Validate typed input and supported certificate range"] [failed "inputValidation" message] ["Certificate failure does not replace the original frontend result or export"]
      Right finding -> case fromJSON $ toJSON $ Slot (requestKind request) (answer finding) (evidence finding) of
        Error message -> Finding Null [] [failed "slotRoundtrip" (T.pack message)] []
        Success (Slot _ result checks) -> finding { answer = result, evidence = checks ++ [checked "slotRoundtrip" "Version 1 positional adapter recovered typed result and checks"] }
    passed (Check _ ok _) = ok

core :: Receipt -> Value
core receipt = object
  [ "schema" .= Settings.requestSchema
  , "formatVersion" .= Settings.formatVersion
  , "kind" .= receiptKind receipt
  , "valid" .= receiptValid receipt
  , "inputDigest" .= receiptDigest receipt
  , "digestAlgorithm" .= ("SHA-256" :: Text)
  , "digestScope" .= ("canonical sorted-key UTF-8 JSON of schema,kind,input; expected display excluded" :: Text)
  , "result" .= answer (receiptFinding receipt)
  , "steps" .= explanation (receiptFinding receipt)
  , "checks" .= evidence (receiptFinding receipt)
  , "warnings" .= cautions (receiptFinding receipt)
  ]

representation :: Receipt -> Value
representation receipt = case certificate of
  Object fields | roundtrip -> Object $ KM.insert "download" downloads fields
  _ -> object ["schema" .= Settings.requestSchema, "valid" .= False, "warnings" .= ["internal certificate download boundary failure" :: Text]]
  where
    certificate = core receipt
    encoded = jsonText certificate
    csv = csvText [["schema", "kind", "valid", "certificateJson"], [Settings.requestSchema, kindText $ receiptKind receipt, if receiptValid receipt then "true" else "false", encoded]]
    roundtrip = case parseCsv ',' csv of
      Right [_, [schema, kind, status, recovered]] -> schema == Settings.requestSchema && kind == kindText (receiptKind receipt) && status == (if receiptValid receipt then "true" else "false") && recovered == encoded
      _ -> False
    downloads = object
      [ "json" .= object ["filename" .= ("ocv-" <> kindText (receiptKind receipt) <> "-certificate.json"), "mime" .= ("application/json" :: Text), "text" .= encoded]
      , "csv" .= object ["filename" .= ("ocv-" <> kindText (receiptKind receipt) <> "-certificate.csv"), "mime" .= ("text/csv;charset=utf-8" :: Text), "text" .= csv]
      ]

instance ToJSON Receipt where toJSON = representation
