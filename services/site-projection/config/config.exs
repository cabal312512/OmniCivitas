import Config

config :phoenix, :json_library, Jason
config :logger, level: :warning
config :ocv_site_projection, OcvSiteProjection.Endpoint,
  adapter: Phoenix.Endpoint.Cowboy2Adapter,
  url: [host: "localhost"],
  render_errors: [formats: [json: OcvSiteProjection.ErrorJSON], layout: false],
  pubsub_server: OcvSiteProjection.PubSub,
  code_reloader: false,
  debug_errors: false,
  server: false

if config_env() == :test do
  config :ocv_site_projection, OcvSiteProjection.Endpoint,
    secret_key_base: String.duplicate("site-projection-test-only-", 4), server: false
end
