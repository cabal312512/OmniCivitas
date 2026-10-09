import Config

integer = fn name, fallback, low, high ->
  value = System.get_env(name, Integer.to_string(fallback))
  case Integer.parse(value) do
    {n, ""} when n >= low and n <= high -> n
    _ -> raise "invalid bounded site projection setting: #{name}"
  end
end

secret = System.get_env("OCV_PROJECTION_SECRET") || Base.encode64(:crypto.strong_rand_bytes(48))
if byte_size(secret) < 64, do: raise("OCV_PROJECTION_SECRET must contain at least 64 bytes")
ip = case System.get_env("OCV_PROJECTION_LISTEN", "127.0.0.1") do
  "127.0.0.1" -> {127, 0, 0, 1}
  "0.0.0.0" -> {0, 0, 0, 0}
  _ -> raise "OCV_PROJECTION_LISTEN must be an explicit loopback or container address"
end

config :ocv_site_projection,
  session_limit: integer.("OCV_PROJECTION_SESSIONS", 64, 1, 128),
  session_ttl_ms: integer.("OCV_PROJECTION_TTL_MS", 600_000, 50, 600_000),
  subscriber_limit: integer.("OCV_PROJECTION_SUBSCRIBERS", 4, 1, 4)

config :ocv_site_projection, OcvSiteProjection.Endpoint,
  secret_key_base: secret,
  server: System.get_env("OCV_PROJECTION_SERVER", "true") == "true" and config_env() != :test,
  http: [ip: ip, port: integer.("PORT", 4013, 1024, 65535),
    transport_options: [num_acceptors: 4, max_connections: 64],
    protocol_options: [idle_timeout: 10_000, request_timeout: 5_000,
      invalid_response_headers: :error_terminate]]
