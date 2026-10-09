defmodule OcvSiteProjection.InvoiceBuilder do
  use GenServer

  def start_link(_options), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  def project(raw) do
    with {:ok, request} <- OcvSiteProjection.Config.Common.read(raw),
         {:ok, actor} <- GenServer.call(__MODULE__, {:ensure, request.session}, 2_000) do
      case Process.info(actor, :message_queue_len) do
        {:message_queue_len, size} when size < 16 -> GenServer.call(actor, {:project, request}, 3_000)
        _ -> {:error, "session_busy", 429}
      end
    end
  catch
    :exit, _reason -> {:error, "projection_unavailable", 503}
  end

  def subscribe(session, pid) do
    with {:ok, actor} <- GenServer.call(__MODULE__, {:ensure, session}, 2_000) do
      GenServer.call(actor, {:subscribe, pid}, 2_000)
    end
  catch
    :exit, _reason -> {:error, "projection_unavailable", 503}
  end

  @impl true
  def init(_), do: {:ok, nil}

  @impl true
  def handle_call({:ensure, session}, _from, state) do
    result = case Registry.lookup(OcvSiteProjection.Registry, session) do
      [{pid, _}] -> {:ok, pid}
      [] ->
        case DynamicSupervisor.start_child(OcvSiteProjection.Actors, {OcvSiteProjection.Receipt, session}) do
          {:ok, pid} -> {:ok, pid}
          {:error, {:already_started, pid}} -> {:ok, pid}
          {:error, :max_children} -> {:error, "session_limit", 429}
          _ -> {:error, "projection_unavailable", 503}
        end
    end
    {:reply, result, state}
  end
end
