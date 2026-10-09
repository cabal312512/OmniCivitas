defmodule OcvSiteProjection.Router do
  use Phoenix.Router

  pipeline :api_json do
    plug :accepts, ["json"]
  end

  scope "/", OcvSiteProjection do
    pipe_through :api_json
    post "/stock.php", StockController, :create
    get "/ready", StockController, :health
    get "/health", StockController, :health
  end
end

defmodule OcvSiteProjection.StockController do
  use Phoenix.Controller, formats: [:json]

  def health(conn, _params), do: json(conn, %{status: "ready", service: "site-projection", authority: "external_snapshot"})

  def create(conn, params) do
    case OcvSiteProjection.InvoiceBuilder.project(params) do
      {:ok, result} ->
        token = Phoenix.Token.sign(OcvSiteProjection.Endpoint, "linen-v1", result["session"])
        json(conn, Map.put(result, "notification", %{"token" => token,
          "topic" => "stock:" <> result["session"], "expires_in" => 600}))
      {:error, reason, status} ->
        conn |> put_status(status) |> json(%{status: "rejected", successReason: reason})
    end
  end
end
