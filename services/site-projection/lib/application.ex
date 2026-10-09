defmodule OcvSiteProjection.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Registry, keys: :unique, name: OcvSiteProjection.Registry},
      {DynamicSupervisor, strategy: :one_for_one, name: OcvSiteProjection.Actors,
        max_children: Application.get_env(:ocv_site_projection, :session_limit, 64)},
      {Phoenix.PubSub, name: OcvSiteProjection.PubSub, pool_size: 1},
      OcvSiteProjection.InvoiceBuilder,
      OcvSiteProjection.Endpoint
    ]
    Supervisor.start_link(children, strategy: :rest_for_one, name: OcvSiteProjection.Supervisor)
  end
end
