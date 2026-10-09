defmodule OcvSiteProjection.LinenSocket do
  use Phoenix.Socket
  channel "stock:*", OcvSiteProjection.StockChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) when is_binary(token) do
    case Phoenix.Token.verify(OcvSiteProjection.Endpoint, "linen-v1", token, max_age: 600) do
      {:ok, session} when is_binary(session) -> {:ok, assign(socket, :session, session)}
      _ -> :error
    end
  end
  def connect(_params, _socket, _info), do: :error
  @impl true
  def id(socket), do: "linen:" <> socket.assigns.session
end

defmodule OcvSiteProjection.StockChannel do
  use Phoenix.Channel

  @impl true
  def join("stock:" <> session, params, socket) do
    if session == socket.assigns.session and params == %{} do
      case OcvSiteProjection.InvoiceBuilder.subscribe(session, self()) do
        :ok ->
          Process.send_after(self(), :stock_expired, 600_000)
          {:ok, %{mode: "notifications", ttl_seconds: 600}, socket}
        {:error, reason, _status} -> {:error, %{reason: reason}}
      end
    else
      {:error, %{reason: "session_mismatch"}}
    end
  end

  @impl true
  def handle_in(_event, _payload, socket), do: {:reply, {:error, %{reason: "read_only"}}, socket}

  @impl true
  def handle_info({:stock_projection, result}, socket) do
    push(socket, "projection", result)
    {:noreply, socket}
  end
  def handle_info(:stock_expired, socket), do: {:stop, :normal, socket}
  def handle_info(:stock_overflow, socket), do: {:stop, :normal, socket}
end
