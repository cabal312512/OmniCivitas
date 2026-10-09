defmodule OcvSiteProjection.Receipt do
  use GenServer

  def child_spec(session), do: %{id: {__MODULE__, session}, start: {__MODULE__, :start_link, [session]},
    restart: :temporary, shutdown: 2_000}
  def start_link(session), do: GenServer.start_link(__MODULE__, session,
    name: {:via, Registry, {OcvSiteProjection.Registry, session}})

  @impl true
  def init(session) do
    ttl = Application.get_env(:ocv_site_projection, :session_ttl_ms, 600_000)
    tag = make_ref()
    timer = Process.send_after(self(), {:expire, tag}, ttl)
    {:ok, %{session: session, data: nil, timer: timer, timer_tag: tag, ttl: ttl, subscribers: %{}}}
  end

  @impl true
  def handle_call({:project, request}, _from, state) do
    case OcvSiteProjection.Common2.run(request, state.data) do
      {:ok, result, data} ->
        subscribers = Enum.reduce(state.subscribers, %{}, fn {pid, ref}, kept ->
          case Process.info(pid, :message_queue_len) do
            {:message_queue_len, n} when n < 8 ->
              send(pid, {:stock_projection, Map.take(result, ["digest", "mask", "count", "dialogue", "sequence"])})
              Map.put(kept, pid, ref)
            _ ->
              Process.demonitor(ref, [:flush])
              send(pid, :stock_overflow)
              kept
          end
        end)
        Process.cancel_timer(state.timer)
        tag = make_ref()
        timer = Process.send_after(self(), {:expire, tag}, state.ttl)
        {:reply, {:ok, result}, %{state | data: data, timer: timer, timer_tag: tag, subscribers: subscribers}}
      {:error, reason, status} -> {:reply, {:error, reason, status}, state}
    end
  end

  def handle_call({:subscribe, pid}, _from, state) do
    limit = Application.get_env(:ocv_site_projection, :subscriber_limit, 4)
    cond do
      Map.has_key?(state.subscribers, pid) -> {:reply, :ok, state}
      map_size(state.subscribers) >= limit -> {:reply, {:error, "subscriber_limit", 429}, state}
      true ->
        ref = Process.monitor(pid)
        {:reply, :ok, %{state | subscribers: Map.put(state.subscribers, pid, ref)}}
    end
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state),
    do: {:noreply, %{state | subscribers: Map.delete(state.subscribers, pid)}}
  def handle_info({:expire, tag}, %{timer_tag: tag} = state) do
    Enum.each(state.subscribers, fn {pid, _} -> send(pid, :stock_expired) end)
    {:stop, :normal, state}
  end
  def handle_info({:expire, _old_tag}, state), do: {:noreply, state}
end
