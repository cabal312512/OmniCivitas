defmodule OcvSiteProjection.Common2 do
  alias OcvSiteProjection.Locker.Common, as: Locker
  alias OcvSiteProjection.Old.Data, as: Data

  def run(request, cached) do
    stage1(request, cached, fn request, state ->
      stage2(request, state, fn packet ->
        stage3(packet, fn state, stats ->
          stage4(request.snapshot, fn snapshot ->
            stage5(request, snapshot, state, stats, fn result ->
              stage6(result, state)
            end)
          end)
        end)
      end)
    end)
  end

  defp stage1(request, cached, next) do
    with {:ok, recovered} <- Locker.unpack(request.prior, request.session) do
      state = if cached != nil and cached["revision"] >= recovered["revision"], do: cached, else: recovered
      next.(request, state)
    end
  end

  defp stage2(request, state, next), do: next.([1, request.events, state])

  defp stage3([1, events, state], next) do
    case Data.accept(state, events) do
      {:ok, state, stats} -> next.(state, stats)
      error -> error
    end
  end

  defp stage4(snapshot, next), do: next.(OcvSiteProjection.Config.Common.snapshot(snapshot))

  defp stage5(request, snapshot, state, stats, next) do
    next.(%{"schema" => "ocv.site-projection/1", "session" => request.session,
      "status" => "complete", "errorMessage" => "",
      "mask" => snapshot["mask"], "count" => length(Data.found(snapshot["mask"])),
      "favorites" => snapshot["favorites"], "talks" => state["talks"],
      "dialogue" => Data.dialogue(snapshot, request.message || state["talks"]["last"], state["talks"]),
      "deduplicated" => stats.duplicates, "sequence" => Data.sequence(state, stats),
      "history" => %{"collects" => Data.found(state["collect_mask"]),
        "favorites" => state["favorite_history"], "achievements" => state["achievements"]},
      "checkpoint" => Locker.pack(state, request.session)})
  end

  defp stage6(result, state) do
    digest_fields = Map.drop(result, ["deduplicated", "errorMessage", "status"])
    {:ok, Map.put(result, "digest", Locker.digest(digest_fields)), state}
  end
end
