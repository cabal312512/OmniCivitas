{-# LANGUAGE OverloadedStrings #-}
module Invoice.Data (matrix, radix, parseExact, exactText, UnitPrice(..)) where

import Data.Aeson
import Data.Char (intToDigit)
import Data.List (foldl')
import Data.Ratio (numerator, denominator, (%))
import Data.Scientific (Scientific, coefficient, base10Exponent, toRealFloat)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import qualified Data.Vector as V
import qualified Paper.Data as Limits
import Paper.Common

newtype UnitPrice = UnitPrice { unitPrice :: Rational } deriving (Eq, Show)
type Grid = [[UnitPrice]]

exactText :: Rational -> Text
exactText q = T.pack (show $ numerator q) <> "/" <> T.pack (show $ denominator q)

scientificExact :: Scientific -> Either Text Rational
scientificExact s = do
  let power = base10Exponent s
      limit = Limits.decimalPower Limits.current
      display = toRealFloat s :: Double
  ensure (power >= negate limit && power <= limit) "certificate exponent bound is +/-1024; original frontend result is retained"
  ensure (not $ isInfinite display || isNaN display) "matrix cell must also be a finite frontend real number"
  let q = if power >= 0 then coefficient s * 10 ^ power % 1 else coefficient s % 10 ^ negate power
  ensure (T.length (exactText q) <= Limits.fractionDigits Limits.current) "exact fraction exceeds certificate digit bound"
  pure q

parseExact :: Text -> Either Text Rational
parseExact text = do
  value <- either (const $ Left "expected finite JSON decimal literal") Right $ eitherDecodeStrict' $ TE.encodeUtf8 $ T.strip text
  case value of
    Number n -> scientificExact n
    _ -> Left "expected decimal literal"

parseGrid :: Text -> Either Text Grid
parseGrid raw = do
  let text = T.strip raw
  ensure (not (T.null text) && T.length text <= 800) "matrix JSON must contain 1-800 characters"
  value <- either (const $ Left "matrix must be a JSON array") Right $ eitherDecodeStrict' $ TE.encodeUtf8 text
  case value of
    Array rows -> do
      let size = V.length rows
      ensure (size == 2 || size == 3) "only 2x2 and 3x3 matrices are supported"
      traverse (parseRow size) (V.toList rows)
    _ -> Left "matrix must be a JSON two-dimensional array"
  where
    parseRow size (Array cells) = do
      ensure (V.length cells == size) "matrix must be square"
      traverse cell (V.toList cells)
    parseRow _ _ = Left "matrix row must be an array"
    cell (Number n) = UnitPrice <$> scientificExact n
    cell _ = Left "matrix cells must be JSON numbers"

determinant :: Grid -> (Rational, [Text])
determinant [[UnitPrice a,UnitPrice b],[UnitPrice c,UnitPrice d]] =
  (a*d-b*c, ["det(A) = a11*a22 - a12*a21", exactText (a*d) <> " - " <> exactText (b*c)])
determinant [[UnitPrice a,UnitPrice b,UnitPrice c],[UnitPrice d,UnitPrice e,UnitPrice f],[UnitPrice g,UnitPrice h,UnitPrice i]] =
  (a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g),
   ["Expand determinant along first row with signs +,-,+", "minor11=" <> exactText (e*i-f*h), "minor12=" <> exactText (d*i-f*g), "minor13=" <> exactText (d*h-e*g)])
determinant _ = (0, ["unreachable: validated square matrix dimensions"])

numericExpected :: Int -> Maybe Value -> Either Text (Maybe [[Rational]])
numericExpected _ Nothing = Right Nothing
numericExpected size (Just (String t)) = Just <$> traverse (traverse parseExact . T.splitOn "\t") (T.lines $ T.strip t)
numericExpected size (Just (Array rows))
  | size > 1 = Just <$> traverse row (V.toList rows)
  where
    row (Array xs) = traverse number (V.toList xs)
    row _ = Left "expected matrix rows must be arrays"
    number (Number n) = scientificExact n
    number _ = Left "expected matrix cells must be numbers"
numericExpected 1 (Just (Number n)) = Just . (:[]) . (:[]) <$> scientificExact n
numericExpected _ _ = Left "expected must be original scalar, matrix array, or TSV text"

comparison :: [[Rational]] -> Maybe [[Rational]] -> [Check]
comparison _ Nothing = [checked "expectedComparison" "No original display was submitted; independent result only"]
comparison exact (Just observed) =
  [Check "expectedShape" sameShape "Original frontend result shape must match",
   Check "expectedComparison" (sameShape && and (zipWith within (concat exact) (concat observed))) "abs(display-exact) <= 1e-12 + 1e-10*abs(exact); this is not bitwise equality"]
  where
    sameShape = length exact == length observed && and (zipWith (\a b -> length a == length b) exact observed)
    within q d = abs (d-q) <= Limits.absoluteTolerance + Limits.relativeTolerance * abs q

matrix :: Value -> Maybe Value -> Either Text Finding
matrix input expected = do
  requireKeys ["a", "b", "operation"] input
  operation <- getField "operation" input :: Either Text Text
  ensure (operation `elem` ["add", "subtract", "determinant"]) "unsupported matrix operation"
  a <- getField "a" input >>= parseGrid
  (values, steps, singular) <- if operation == "determinant"
    then let (q, work) = determinant a in pure ([[q]], work, q == 0)
    else do
      b <- getField "b" input >>= parseGrid
      ensure (length a == length b) "matrix dimensions must match"
      let f = if operation == "add" then (+) else (-)
      pure (zipWith (zipWith (\x y -> f (unitPrice x) (unitPrice y))) a b,
            ["Parse decimal literals as reduced exact rational numbers", "Apply " <> operation <> " independently to corresponding cells"], False)
  observed <- numericExpected (if operation == "determinant" then 1 else length a) expected
  ensure (all ((<= Limits.fractionDigits Limits.current) . T.length . exactText) $ concat values) "exact result exceeds certificate digit bound"
  let exact = map (map exactText) values
      result = object ["operation" .= operation, "dimension" .= length a, "exact" .= (if operation == "determinant" then toJSON (head $ head exact) else toJSON exact), "numericModel" .= ("exact-decimal-rational" :: Text), "units" .= ("dimensionless" :: Text), "comparisonTolerance" .= object ["absolute" .= ("1e-12" :: Text), "relative" .= ("1e-10" :: Text)]]
  pure $ Finding result steps ([checked "supportedMatrix" "2x2/3x3, add/subtract/determinant; each original JSON <=800 characters", checked "rationalReduction" "Exact reduced numerator/positive denominator"] ++ comparison values observed)
    (["Certificate proves the rational interpretation of decimal input literals; original frontend floating display is retained"] ++ ["Matrix is singular: determinant is exactly zero" | singular])

radix :: Value -> Maybe Value -> Either Text Finding
radix input expected = do
  requireKeys ["value", "from", "to"] input
  raw <- getField "value" input
  from <- getField "from" input :: Either Text Int
  to <- getField "to" input :: Either Text Int
  ensure (from `elem` [2,8,10,16] && to `elem` [2,8,10,16]) "bases must be 2,8,10,16"
  let text = T.strip raw
      (negative, unsigned) = case T.uncons text of
        Just ('-', t) -> (True, t)
        Just ('+', t) -> (False, t)
        _ -> (False, text)
      prefix = case from of 2 -> "0b"; 8 -> "0o"; 16 -> "0x"; _ -> ""
      digits = if not (T.null prefix) && prefix `T.isPrefixOf` T.toLower unsigned then T.drop 2 unsigned else unsigned
      digitValue c = T.findIndex (==c) "0123456789abcdef"
  ensure (T.length text <= 2051 && not (T.null digits) && T.length digits <= 2048) "base input is limited to 2048 digits, optional sign and matching prefix"
  numbers <- traverse (\c -> case digitValue c of Just n | n < from -> Right n; _ -> Left "digit does not belong to source base") (T.unpack $ T.toLower digits)
  let magnitude = foldl' (\n d -> n * fromIntegral from + fromIntegral d) (0 :: Integer) numbers
      integer = if negative then negate magnitude else magnitude
      rendered = formatBase integer to
      decimal = T.pack $ show integer
      result = object ["from" .= from, "to" .= to, "text" .= rendered, "decimal" .= decimal, "digitCount" .= T.length digits, "units" .= ("dimensionless" :: Text)]
  observed <- traverse textValue expected
  pure $ Finding result ["Strip one sign and an optional matching base prefix", "Fold source digits using n = n*sourceBase + digit", "Repeated quotient/remainder in the target base; restore a negative sign only for nonzero integers"]
    [checked "supportedBase" "2/8/10/16 with at most 2048 source digits", checked "integerRoundtrip" "Arbitrary precision integer; no floating conversion", Check "expectedComparison" (maybe True (==rendered) observed) "Original base display must exactly equal lowercase target digits"] []

formatBase :: Integer -> Int -> Text
formatBase value base
  | value == 0 = "0"
  | otherwise = (if value < 0 then "-" else "") <> T.pack (reverse $ digits $ abs value)
  where
    digits 0 = []
    digits n = let (q,r) = n `quotRem` fromIntegral base in intToDigit (fromIntegral r) : digits q
