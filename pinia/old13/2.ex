defmodule OcvSiteProjection.Old.Data do
  import Bitwise
  alias OcvSiteProjection.Locker.Common, as: Locker

  def accept(state, events) do
    if conflict?(events, "id") or conflict?(events, "seq") do
      {:error, "event_batch_conflict", 409}
    else
      ordered(state, events)
    end
  end

  defp conflict?(events, key), do: events |> Enum.group_by(& &1[key]) |>
    Enum.any?(fn {_value, items} -> length(Enum.uniq(items)) > 1 end)

  defp ordered(state, events) do
    sorted = events |> Enum.reverse() |> Enum.sort_by(&{&1["seq"], &1["id"]})
    Enum.reduce_while(sorted, {:ok, state, %{duplicates: 0, expired: 0}}, fn event, {:ok, current, stats} ->
      case one(current, event) do
        {:ok, next, :accepted} -> {:cont, {:ok, next, stats}}
        {:ok, next, :duplicate} -> {:cont, {:ok, next, %{stats | duplicates: stats.duplicates + 1}}}
        {:ok, next, :expired} -> {:cont, {:ok, next, %{stats | expired: stats.expired + 1}}}
        {:error, reason} -> {:halt, {:error, reason, 409}}
      end
    end)
  end

  defp one(state, event) do
    record = [event["seq"], event["id"], Locker.digest(event)]
    old_id = Enum.find(state["records"], &(Enum.at(&1, 1) == event["id"]))
    old_seq = Enum.find(state["records"], &(hd(&1) == event["seq"]))
    cond do
      old_id == record -> {:ok, state, :duplicate}
      old_id != nil -> {:error, "event_id_conflict"}
      old_seq != nil -> {:error, "event_sequence_conflict"}
      event["seq"] <= state["floor"] -> {:ok, state, :expired}
      state["revision"] == 1_000_000_000 -> {:error, "revision_limit"}
      true ->
        high = max(state["high"], event["seq"])
        floor = max(0, high - 256)
        records = [record | state["records"]] |> Enum.filter(&(hd(&1) > floor)) |> Enum.sort_by(&hd/1)
        next = %{state | "records" => records, "high" => high, "floor" => floor,
          "revision" => state["revision"] + 1}
        {:ok, apply_event(next, event), :accepted}
    end
  end

  defp apply_event(state, %{"kind" => "collect", "data" => %{"slot" => slot}}),
    do: %{state | "collect_mask" => bor(state["collect_mask"], bsl(1, slot))}
  defp apply_event(state, %{"kind" => "favorite", "seq" => seq, "data" => data}) do
    history = state["favorite_history"] ++ [Map.put(data, "seq", seq)]
    %{state | "favorite_history" => history |> Enum.sort_by(& &1["seq"]) |> Enum.take(-16)}
  end
  defp apply_event(state, %{"kind" => "achievement", "data" => %{"code" => code}}),
    do: %{state | "achievements" => Enum.sort(Enum.uniq(state["achievements"] ++ [code]))}
  defp apply_event(state, %{"kind" => "talk", "seq" => seq, "data" => %{"message" => message}}) do
    talks = state["talks"]
    history = talks["history"] ++ [%{"seq" => seq, "message" => message}]
    latest = if seq > talks["last_seq"], do: message, else: talks["last"]
    %{state | "talks" => %{"count" => talks["count"] + 1, "last" => latest,
      "last_seq" => max(seq, talks["last_seq"]),
      "history" => history |> Enum.sort_by(& &1["seq"]) |> Enum.take(-16)}}
  end

  def sequence(state, stats) do
    present = MapSet.new(state["records"], &hd/1)
    gaps = if state["high"] > state["floor"] do
      (state["floor"] + 1)..state["high"] |> Enum.reject(&MapSet.member?(present, &1)) |> ranges()
    else
      []
    end
    complete = gaps == [] and state["floor"] == 0 and stats.expired == 0
    %{"high" => state["high"], "floor" => state["floor"], "gaps" => gaps,
      "complete" => complete, "status" => if(complete, do: "complete", else: "incomplete"),
      "expired" => stats.expired, "retained" => length(state["records"])}
  end

  defp ranges(numbers) do
    numbers |> Enum.reduce([], fn number, acc ->
      case acc do
        [[start, finish] | tail] when number == finish + 1 -> [[start, number] | tail]
        _ -> [[number, number] | acc]
      end
    end) |> Enum.reverse()
  end

  def found(mask), do: Enum.filter(0..29, fn slot -> band(mask, bsl(1, slot)) != 0 end)

  def dialogue(snapshot, message, talks) do
    found = length(found(snapshot["mask"]))
    nickname = if snapshot["nickname"] == "", do: "你", else: snapshot["nickname"]
    phase = cond do
      found < 30 -> "searching"
      message == "bye" -> "resting"
      message == "where" -> "explained"
      message == "again" or talks["count"] > 1 -> "returning"
      true -> "greeted"
    end
    text = case {found == 30, message} do
      {false, "where"} -> "[scan] 已记录 #{found} / 30。未被看见的缺损，是否也存在？"
      {false, _} -> "WAIT #{30 - found}：计数之外，还遗漏了什么？"
      {true, "hello"} -> "#{nickname}，[boot:30/30] 谁在观察这个观察者？"
      {true, "where"} -> "ROUTE NULL / 收藏中有记录。边界属于哪一侧？"
      {true, "again"} -> "#{nickname}，░▒ reprise ▒░ La mémoire suffit-elle à faire revenir le même être ?"
      {true, "bye"} -> "#{nickname}，Vek-narum; tor-em. 沉默是终点，还是另一种回答？"
    end
    %{"phase" => phase, "message" => message, "reply" => text, "unlocked" => found == 30}
  end
end
