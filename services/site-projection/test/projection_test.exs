defmodule OcvSiteProjection.ProjectionTest do
  use ExUnit.Case, async: true
  alias OcvSiteProjection.Config.Common, as: Config
  alias OcvSiteProjection.Common2, as: Projection

  defp fixture do
    Path.expand("../fixtures/reversed.json", __DIR__) |> File.read!() |> Jason.decode!()
  end

  defp run(raw, cached \\ nil) do
    with {:ok, request} <- Config.read(raw), do: Projection.run(request, cached)
  end

  test "reversed delivery, duplicate collapse and snapshot authority survive checkpoint recovery" do
    raw = fixture()
    assert {:ok, first, _} = run(raw)
    assert first["mask"] == 7 and first["count"] == 3
    assert first["history"]["collects"] == [0, 2]
    assert first["talks"]["count"] == 1
    assert first["deduplicated"] == 1
    assert first["sequence"]["gaps"] == []
    assert first["sequence"]["complete"]
    replay = Map.put(raw, "prior", %{"checkpoint" => first["checkpoint"]})
    assert {:ok, second, _} = run(replay)
    assert second["talks"] == first["talks"]
    assert second["checkpoint"] == first["checkpoint"]
    assert second["digest"] == first["digest"]
    assert second["deduplicated"] == 4
    snapshot = %{"mask" => 1, "favorites" => [], "nickname" => "路人"}
    assert {:ok, changed, _} = run(replay |> Map.put("snapshot", snapshot))
    assert changed["mask"] == 1 and changed["count"] == 1 and changed["favorites"] == []
    assert changed["history"]["collects"] == [0, 2]
  end

  test "late gap fill reorders talk history and recovers the newest dialogue" do
    raw = fixture() |> Map.put("snapshot", %{"mask" => 1_073_741_823, "favorites" => [], "nickname" => ""})
    events = [
      %{"id" => "00000000-0000-4000-8000-000000000001", "seq" => 1, "kind" => "collect", "data" => %{"slot" => 0}},
      %{"id" => "00000000-0000-4000-8000-000000000003", "seq" => 3, "kind" => "talk", "data" => %{"message" => "bye"}}
    ]
    assert {:ok, first, _} = run(Map.put(raw, "events", events))
    assert first["sequence"]["gaps"] == [[2, 2]]
    refute first["sequence"]["complete"]
    late = %{"id" => "00000000-0000-4000-8000-000000000002", "seq" => 2, "kind" => "talk", "data" => %{"message" => "where"}}
    assert {:ok, recovered, _} = run(raw |> Map.put("events", [late]) |>
      Map.put("prior", %{"checkpoint" => first["checkpoint"]}))
    assert recovered["talks"]["count"] == 2
    assert recovered["talks"]["last"] == "bye"
    assert recovered["talks"]["history"] == [%{"seq" => 2, "message" => "where"}, %{"seq" => 3, "message" => "bye"}]
    assert recovered["dialogue"]["phase"] == "resting"
    assert recovered["sequence"]["complete"]
  end

  test "conflicting duplicates reject a whole batch; checkpoint cannot cross sessions or change its checksum" do
    raw = fixture()
    [event | _] = raw["events"]
    assert {:error, "event_batch_conflict", 409} = run(Map.put(raw, "events", [event, %{event | "seq" => 8}]))
    assert {:ok, first, _} = run(raw)
    foreign = raw |> Map.put("session", "00000000-0000-4000-8000-000000000014") |>
      Map.put("prior", %{"checkpoint" => first["checkpoint"]})
    assert {:error, "checkpoint_session", 422} = run(foreign)
    bad = put_in(first, ["checkpoint", "receipt", "checksum"], String.duplicate("0", 64))
    assert {:error, "checkpoint_checksum", 422} = run(Map.put(raw, "prior", %{"checkpoint" => bad["checkpoint"]}))
  end

  test "retention limits old replay without changing authoritative progress" do
    raw = fixture()
    last = %{"id" => "00000000-0000-4000-8000-000000000099", "seq" => 1_000_000_000,
      "kind" => "talk", "data" => %{"message" => "again"}}
    assert {:ok, first, _} = run(Map.put(raw, "events", [last]))
    assert first["sequence"]["floor"] == 999_999_744
    assert length(first["sequence"]["gaps"]) == 1
    assert {:ok, replay, _} = run(raw |> Map.put("prior", %{"checkpoint" => first["checkpoint"]}))
    assert replay["sequence"]["expired"] == 4
    assert replay["talks"]["count"] == 1
    assert replay["mask"] == 7
    assert byte_size(Jason.encode!(replay["checkpoint"])) < 49_152
  end

  test "arbitrary text and personal fields never enter projection data" do
    raw = fixture()
    assert {:error, "unknown_field", 422} = Config.read(Map.put(raw, "password", "synthetic"))
    assert {:error, "nickname", 422} = Config.read(put_in(raw, ["snapshot", "nickname"], "test@example.invalid"))
    assert {:error, "personal_data_rejected", 422} = Config.read(put_in(raw, ["snapshot", "nickname"], "12345678901"))
    assert {:error, "unknown_field", 422} = Config.read(put_in(raw, ["events", Access.at(0), "data", "text"], "arbitrary"))
  end

  test "favorite and achievement receipts are isolated history and survive the nested protocol" do
    raw = fixture() |> Map.put("snapshot", %{"mask" => 0, "favorites" => [], "nickname" => ""})
    events = [
      %{"id" => "00000000-0000-4000-8000-000000000001", "seq" => 1, "kind" => "favorite",
        "data" => %{"id" => "json", "folder" => "默认", "action" => "add"}},
      %{"id" => "00000000-0000-4000-8000-000000000002", "seq" => 2, "kind" => "achievement",
        "data" => %{"code" => "favorite-first"}}
    ]
    assert {:ok, first, _} = run(Map.put(raw, "events", events))
    assert first["favorites"] == [] and first["mask"] == 0
    assert first["history"]["favorites"] == [%{"seq" => 1, "id" => "json", "folder" => "默认", "action" => "add"}]
    assert first["history"]["achievements"] == ["favorite-first"]
    assert {:ok, recovered, _} = run(raw |> Map.put("events", events) |>
      Map.put("prior", %{"checkpoint" => first["checkpoint"]}))
    assert recovered["history"] == first["history"]
    assert recovered["deduplicated"] == 2
  end

  test "a mature 256 UUID-and-digest checkpoint roundtrips within the shared storage budget" do
    events = for index <- 1..256 do
      seq = 999_999_744 + index
      id = "ffffffff-ffff-4fff-8fff-" <> (index |> Integer.to_string(16) |> String.pad_leading(12, "0"))
      {kind, data} = cond do
        index <= 16 -> {"favorite", %{"id" => String.duplicate("x", 96),
          "folder" => String.duplicate("𠀀", 32), "action" => "remove"}}
        index <= 32 -> {"talk", %{"message" => "again"}}
        index <= 35 -> {"achievement", %{"code" => Enum.at(["hunt-30", "favorite-first", "visitor-return"], index - 33)}}
        true -> {"collect", %{"slot" => rem(seq, 30)}}
      end
      %{"id" => id, "seq" => seq, "kind" => kind, "data" => data}
    end
    raw = fixture() |> Map.put("snapshot", %{"mask" => 1_073_741_823,
      "favorites" => [], "nickname" => String.duplicate("𠀀", 40)})
    assert {:ok, first, _} = run(Map.put(raw, "events", Enum.take(events, 128)))
    assert {:ok, mature, mature_state} = run(raw |> Map.put("events", Enum.drop(events, 128)) |>
      Map.put("prior", %{"checkpoint" => first["checkpoint"]}))
    assert mature["sequence"]["retained"] == 256
    assert mature["sequence"]["high"] == 1_000_000_000
    refute mature["sequence"]["complete"]
    csv_bytes = byte_size(hd(mature["checkpoint"]["receipt"]["rows"]))
    json_bytes = byte_size(Jason.encode!(mature["checkpoint"]))
    assert csv_bytes <= 49_152
    assert json_bytes <= 65_536
    maximum_counters = %{mature_state | "revision" => 1_000_000_000,
      "talks" => Map.put(mature_state["talks"], "count", 1_000_000_000)}
    largest = OcvSiteProjection.Locker.Common.pack(maximum_counters, raw["session"])
    assert {:ok, recovered_max, _} = run(raw |> Map.put("events", []) |>
      Map.put("prior", %{"checkpoint" => largest}))
    largest_csv_bytes = byte_size(hd(largest["receipt"]["rows"]))
    largest_json_bytes = byte_size(Jason.encode!(largest))
    assert recovered_max["checkpoint"] == largest
    assert largest_csv_bytes <= 49_152 and largest_json_bytes <= 65_536
    IO.puts(Jason.encode!(%{mature_checkpoint_csv_bytes: csv_bytes, mature_checkpoint_json_bytes: json_bytes,
      maximum_counter_checkpoint_csv_bytes: largest_csv_bytes, maximum_counter_checkpoint_json_bytes: largest_json_bytes}))
    replay = raw |> Map.put("events", Enum.take(events, -128)) |>
      Map.put("prior", %{"checkpoint" => mature["checkpoint"]})
    assert byte_size(Jason.encode!(replay)) <= 196_608
    assert {:ok, recovered, _} = run(replay)
    assert recovered["checkpoint"] == mature["checkpoint"]
    assert recovered["history"] == mature["history"]
    assert recovered["talks"] == mature["talks"]
    assert recovered["deduplicated"] == 128
    assert recovered["dialogue"] == mature["dialogue"]
  end
end
