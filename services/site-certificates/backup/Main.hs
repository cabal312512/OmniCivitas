{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}
module Main where

import Control.Exception (evaluate)
import Control.Monad.IO.Class (liftIO)
import Data.Aeson (Value, encode, object, (.=))
import qualified Data.ByteString as BS
import qualified Data.ByteString.Lazy as BL
import Data.IORef
import Data.Text (Text)
import qualified Data.Text.Encoding as TE
import Network.HTTP.Types (status400, status413, status422)
import qualified Network.Wai as Wai
import Network.Wai.Handler.Warp (runSettings, defaultSettings, setPort, setHost, setTimeout, setMaximumBodyFlush)
import Servant
import System.Environment (lookupEnv)
import Text.Read (readMaybe)
import Paper.Common (Request)
import Paper.Common2 (issue, representation)
import qualified Paper.Data as Settings
import Old.Common (lexicalDepth)

type API = "ReturnOrder.asmx" :> ReqBody '[JSON] Request :> Post '[JSON] Value
      :<|> "ready" :> Get '[JSON] Value

api :: Proxy API
api = Proxy

server :: Server API
server = returnOrder :<|> ready
  where
    returnOrder :: Request -> Handler Value
    returnOrder request = do
      let result = representation $ issue request
      bytes <- liftIO $ evaluate $ BL.length $ encode result
      if bytes > 524288
        then throwError err422 { errBody = encode $ object ["error" .= ("certificate output exceeds 512 KiB" :: Text)] }
        else pure result
    ready :: Handler Value
    ready = pure $ object ["schema" .= Settings.requestSchema, "service" .= ("site-certificates" :: Text), "status" .= ("ready" :: Text)]

boundedPayload :: Wai.Middleware
boundedPayload application request respond
  | Wai.requestMethod request /= "POST" = application request respond
  | otherwise = do
      loaded <- consume [] 0
      case loaded of
        Left _ -> respond $ Wai.responseLBS status413 [("Content-Type", "application/json")] $ encode $ object ["error" .= ("request exceeds 192 KiB" :: Text)]
        Right bytes -> case TE.decodeUtf8' bytes of
          Left _ -> respond $ Wai.responseLBS status400 [("Content-Type", "application/json")] $ encode $ object ["error" .= ("request must be UTF-8 JSON" :: Text)]
          Right source -> case lexicalDepth 40 source of
            Left _ -> respond $ Wai.responseLBS status422 [("Content-Type", "application/json")] $ encode $ object ["error" .= ("request nesting exceeds 40" :: Text)]
            Right () -> do
              remaining <- newIORef bytes
              application request { Wai.requestBody = atomicModifyIORef' remaining (\body -> (BS.empty, body)) } respond
  where
    consume chunks size = do
      chunk <- Wai.getRequestBodyChunk request
      let total = size + BS.length chunk
      if total > Settings.requestBytes Settings.current
        then pure $ Left ()
        else if BS.null chunk
          then pure $ Right $ BS.concat $ reverse chunks
          else consume (chunk:chunks) total

main :: IO ()
main = do
  rawPort <- lookupEnv "PORT"
  let port = case rawPort >>= readMaybe of Just n | n > 0 && n < 65536 -> n; _ -> 7083
      settings = setMaximumBodyFlush (Just 196608) $ setTimeout 10 $ setHost "0.0.0.0" $ setPort port defaultSettings
  runSettings settings $ boundedPayload $ serve api server
