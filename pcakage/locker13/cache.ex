defmodule OcvSiteProjection.Locker.Common do
  alias OcvSiteProjection.Config.Common, as: Config

  def digest(value), do: :crypto.hash(:sha256, canonical(value)) |> Base.encode16(case: :lower)

  def canonical(value) when is_map(value) do
    inner = value |> Enum.sort_by(fn {key, _} -> key end) |>
      Enum.map_join(",", fn {key, part} -> Jason.encode!(key) <> ":" <> canonical(part) end)
    "{" <> inner <> "}"
  end
  def canonical(value) when is_list(value), do: "[" <> Enum.map_join(value, ",", &canonical/1) <> "]"
  def canonical(value), do: Jason.encode!(value)

  def pack(state, session) do
    inner = canonical(state)
    json_string = Jason.encode!(inner)
    csv = "\"" <> String.replace(json_string, "\"", "\"\"") <> "\""
    %{"schema" => "ocv.locker/1", "session" => session,
      "receipt" => %{"rows" => [csv], "checksum" => digest(state)}}
  end

  def unpack(nil, _session), do: {:ok, OcvSiteProjection.Locker.Data.empty()}
  def unpack(checkpoint, session) do
    Config.ensure(is_map(checkpoint), "checkpoint_object")
    Config.keys(checkpoint, ["schema", "session", "receipt"])
    Config.ensure(checkpoint["schema"] == "ocv.locker/1", "checkpoint_version")
    Config.ensure(checkpoint["session"] == session, "checkpoint_session")
    receipt = checkpoint["receipt"]
    Config.ensure(is_map(receipt), "checkpoint_receipt")
    Config.keys(receipt, ["rows", "checksum"])
    rows = Config.bounded_list(receipt["rows"], 1, "checkpoint_rows")
    Config.ensure(length(rows) == 1, "checkpoint_rows")
    [csv] = rows
    Config.ensure(is_binary(csv) and byte_size(csv) >= 2 and byte_size(csv) <= 49_152 and
      String.valid?(csv), "checkpoint_bytes")
    Config.ensure(String.starts_with?(csv, "\"") and String.ends_with?(csv, "\""), "checkpoint_csv")
    encoded = csv |> binary_part(1, byte_size(csv) - 2) |> String.replace("\"\"", "\"")
    Config.ensure("\"" <> String.replace(encoded, "\"", "\"\"") <> "\"" == csv, "checkpoint_csv")
    with {:ok, inner} when is_binary(inner) <- Jason.decode(encoded),
         {:ok, state} when is_map(state) <- Jason.decode(inner) do
      state = OcvSiteProjection.Locker.Data.read(state)
      Config.ensure(receipt["checksum"] == digest(state), "checkpoint_checksum")
      {:ok, state}
    else
      _ -> {:error, "checkpoint_json", 422}
    end
  catch
    {:invalid, reason} -> {:error, reason, 422}
  end
end

defmodule OcvSiteProjection.Locker.Data do
  alias OcvSiteProjection.Config.Common, as: Config

  def empty do
    %{"schema" => "ocv.stock-state/1", "revision" => 0, "high" => 0, "floor" => 0,
      "records" => [], "talks" => %{"count" => 0, "last" => "hello", "last_seq" => 0, "history" => []},
      "collect_mask" => 0, "favorite_history" => [], "achievements" => []}
  end

  def read(state) do
    Config.keys(state, Map.keys(empty()))
    Config.ensure(Enum.sort(Map.keys(state)) == Enum.sort(Map.keys(empty())), "checkpoint_fields")
    Config.ensure(state["schema"] == "ocv.stock-state/1", "checkpoint_state_version")
    Config.integer(state["revision"], 0, 1_000_000_000, "checkpoint_revision")
    high = Config.integer(state["high"], 0, 1_000_000_000, "checkpoint_high")
    Config.ensure(state["floor"] == max(0, high - 256), "checkpoint_floor")
    records = state["records"] |> Config.bounded_list(256, "checkpoint_record_limit") |> Enum.map(&record/1)
    Config.ensure(records == Enum.sort_by(records, &hd/1), "checkpoint_record_order")
    Config.ensure(Enum.uniq_by(records, &Enum.at(&1, 1)) == records and Enum.uniq_by(records, &hd/1) == records,
      "checkpoint_record_duplicate")
    Config.ensure(Enum.all?(records, &(hd(&1) <= high and hd(&1) > state["floor"])), "checkpoint_record_range")
    Config.ensure(state["revision"] >= length(records), "checkpoint_revision")
    talks = state["talks"]
    Config.ensure(is_map(talks), "checkpoint_talks")
    Config.keys(talks, ["count", "last", "last_seq", "history"])
    Config.integer(talks["count"], 0, state["revision"], "checkpoint_talk_count")
    Config.enum(talks["last"], ["hello", "where", "again", "bye"], "checkpoint_talk_last")
    Config.integer(talks["last_seq"], 0, high, "checkpoint_talk_last_sequence")
    history = Config.bounded_list(talks["history"], 16, "checkpoint_talk_history")
    Enum.each(history, fn item ->
      Config.ensure(is_map(item), "checkpoint_talk_history")
      Config.keys(item, ["seq", "message"])
      Config.integer(item["seq"], 1, high, "checkpoint_talk_history")
      Config.enum(item["message"], ["hello", "where", "again", "bye"], "checkpoint_talk_history")
    end)
    Config.ensure(history == Enum.sort_by(history, & &1["seq"]), "checkpoint_talk_history_order")
    Config.ensure(length(history) <= talks["count"], "checkpoint_talk_history")
    Config.integer(state["collect_mask"], 0, 1_073_741_823, "checkpoint_collect_mask")
    state["favorite_history"] |> Config.bounded_list(16, "checkpoint_favorite_history") |>
      Enum.each(fn data ->
        Config.ensure(is_map(data), "checkpoint_favorite_history")
        Config.integer(data["seq"], 1, high, "checkpoint_favorite_history")
        Config.event(%{"id" => "00000000-0000-4000-8000-000000000001",
          "seq" => 1, "kind" => "favorite", "data" => Map.delete(data, "seq")})
      end)
    Config.ensure(state["favorite_history"] == Enum.sort_by(state["favorite_history"], & &1["seq"]),
      "checkpoint_favorite_history_order")
    codes = Config.bounded_list(state["achievements"], 3, "checkpoint_achievements")
    Enum.each(codes, &Config.enum(&1, ["hunt-30", "favorite-first", "visitor-return"], "checkpoint_achievement"))
    Config.ensure(codes == Enum.sort(Enum.uniq(codes)), "checkpoint_achievement_order")
    %{state | "records" => records}
  end

  defp record(value) do
    Config.ensure(is_list(value) and length(value) == 3, "checkpoint_record_shape")
    [seq, id, digest] = value
    Config.integer(seq, 1, 1_000_000_000, "checkpoint_record_sequence")
    Config.uuid(id)
    Config.ensure(is_binary(digest) and byte_size(digest) == 64 and
      Regex.match?(~r/\A[0-9a-f]{64}\z/, digest), "checkpoint_record_digest")
    value
  end
end
