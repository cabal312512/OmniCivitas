defmodule OcvSiteProjection.Config.Common do
  @schema "ocv.site-projection/1"
  @uuid ~r/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i
  @safe_id ~r/\A[a-zA-Z0-9_.:\/-]{1,96}\z/
  @safe_label ~r/\A[\p{L}\p{N} _.-]*\z/u
  @messages ["hello", "where", "again", "bye"]
  @codes ["hunt-30", "favorite-first", "visitor-return"]

  def read(raw) do
    ensure(is_map(raw), "request_object")
    keys(raw, ["schema", "session", "snapshot", "events", "prior", "message"])
    ensure(raw["schema"] == @schema, "schema_version")
    session = uuid(raw["session"])
    snapshot = snapshot(raw["snapshot"])
    events = raw |> Map.get("events", []) |> bounded_list(128, "events_limit") |> Enum.map(&event/1)
    prior = prior(Map.get(raw, "prior"))
    message = Map.get(raw, "message")
    if message != nil, do: enum(message, @messages, "message_enum")
    {:ok, %{session: session, snapshot: snapshot, events: events, prior: prior, message: message}}
  catch
    {:invalid, reason} -> {:error, reason, 422}
  end

  def event(value) do
    ensure(is_map(value), "event_object")
    keys(value, ["id", "seq", "kind", "data"])
    id = uuid(value["id"])
    seq = integer(value["seq"], 1, 1_000_000_000, "sequence_range")
    kind = enum(value["kind"], ["collect", "favorite", "talk", "achievement"], "event_kind")
    data = data(kind, value["data"])
    %{"id" => id, "seq" => seq, "kind" => kind, "data" => data}
  end

  def snapshot(value) do
    ensure(is_map(value), "snapshot_object")
    keys(value, ["mask", "favorites", "nickname"])
    mask = integer(value["mask"], 0, 1_073_741_823, "mask_range")
    favorites = value |> Map.get("favorites", []) |> bounded_list(100, "favorites_limit") |>
      Enum.map(&favorite/1) |> Enum.sort_by(&{&1["id"], &1["folder"]})
    ensure(Enum.uniq_by(favorites, & &1["id"]) == favorites, "favorite_id_duplicate")
    nickname = label(Map.get(value, "nickname", ""), 40, "nickname")
    %{"mask" => mask, "favorites" => favorites, "nickname" => nickname}
  end

  def favorite(value) do
    ensure(is_map(value), "favorite_object")
    keys(value, ["id", "folder"])
    %{"id" => identifier(value["id"]), "folder" => label(Map.get(value, "folder", ""), 32, "folder")}
  end

  def uuid(value) do
    ensure(is_binary(value) and byte_size(value) == 36 and Regex.match?(@uuid, value), "session_or_event_uuid")
    String.downcase(value)
  end

  def integer(value, low, high, reason) do
    ensure(is_integer(value) and value >= low and value <= high, reason)
    value
  end

  def bounded_list(value, limit, reason) do
    ensure(is_list(value) and length(value) <= limit, reason)
    value
  end

  def enum(value, allowed, reason) do
    ensure(value in allowed, reason)
    value
  end

  def keys(value, allowed) do
    ensure(Enum.all?(Map.keys(value), &(&1 in allowed)), "unknown_field")
  end

  def ensure(true, _reason), do: :ok
  def ensure(false, reason), do: throw({:invalid, reason})

  defp prior(nil), do: nil
  defp prior(value) do
    ensure(is_map(value), "prior_object")
    keys(value, ["checkpoint"])
    value["checkpoint"]
  end

  defp identifier(value) do
    ensure(is_binary(value) and byte_size(value) <= 96 and Regex.match?(@safe_id, value), "favorite_identifier")
    value
  end

  defp label(value, limit, reason) do
    ensure(is_binary(value) and byte_size(value) <= limit * 4 and String.valid?(value), reason)
    ensure(String.length(value) <= limit and Regex.match?(@safe_label, value), reason)
    ensure(not Regex.match?(~r/\d{7}/u, value), "personal_data_rejected")
    ensure(not Regex.match?(~r/(password|passwd|email|phone)/iu, value), "personal_data_rejected")
    value
  end

  defp data(kind, value) do
    ensure(is_map(value), "event_data_object")
    case kind do
      "collect" ->
        keys(value, ["slot"])
        %{"slot" => integer(value["slot"], 0, 29, "collect_slot")}
      "favorite" ->
        keys(value, ["id", "folder", "action"])
        favorite = favorite(Map.take(value, ["id", "folder"]))
        Map.put(favorite, "action", enum(value["action"], ["add", "remove", "move"], "favorite_action"))
      "talk" ->
        keys(value, ["message"])
        %{"message" => enum(value["message"], @messages, "message_enum")}
      "achievement" ->
        keys(value, ["code"])
        %{"code" => enum(value["code"], @codes, "achievement_code")}
    end
  end
end
