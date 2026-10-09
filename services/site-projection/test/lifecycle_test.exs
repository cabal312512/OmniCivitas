defmodule OcvSiteProjection.LifecycleTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest
  @endpoint OcvSiteProjection.Endpoint

  defp raw(session) do
    %{"schema" => "ocv.site-projection/1", "session" => session,
      "snapshot" => %{"mask" => 1_073_741_823, "favorites" => [], "nickname" => ""},
      "events" => [%{"id" => "00000000-0000-4000-8000-000000000010", "seq" => 1,
        "kind" => "talk", "data" => %{"message" => "bye"}}]}
  end

  test "OTP actor loss recovers from a checkpoint, without replaying a talk" do
    session = "00000000-0000-4000-8000-000000000015"
    assert {:ok, first} = OcvSiteProjection.InvoiceBuilder.project(raw(session))
    [{actor, _}] = Registry.lookup(OcvSiteProjection.Registry, session)
    ref = Process.monitor(actor)
    Process.exit(actor, :kill)
    assert_receive {:DOWN, ^ref, :process, ^actor, :killed}, 1_000
    assert {:ok, recovered} = OcvSiteProjection.InvoiceBuilder.project(
      Map.put(raw(session), "prior", %{"checkpoint" => first["checkpoint"]}))
    assert recovered["talks"]["count"] == 1
    assert recovered["deduplicated"] == 1
    assert recovered["dialogue"]["phase"] == "resting"
  end

  test "Phoenix endpoint executes the projection and keeps unrelated routes unmounted" do
    session = "00000000-0000-4000-8000-000000000016"
    conn = Plug.Test.conn(:post, "/stock.php", Jason.encode!(raw(session))) |>
      Plug.Conn.put_req_header("content-type", "application/json") |> @endpoint.call([])
    assert conn.status == 200
    assert {:ok, body} = Jason.decode(conn.resp_body)
    assert body["count"] == 30
    assert body["dialogue"]["phase"] == "resting"
    assert {:ok, ^session} = Phoenix.Token.verify(@endpoint, "linen-v1", body["notification"]["token"], max_age: 600)
    assert_raise Phoenix.Router.NoRouteError, fn -> Plug.Test.conn(:post, "/account", "{}") |>
      Plug.Conn.put_req_header("content-type", "application/json") |> OcvSiteProjection.Router.call([]) end
  end

  test "a bounded read-only channel receives a real projection and rejects another session" do
    session = "00000000-0000-4000-8000-000000000017"
    socket = socket(OcvSiteProjection.LinenSocket, nil, %{session: session})
    assert {:ok, _, joined} = subscribe_and_join(socket, OcvSiteProjection.StockChannel, "stock:" <> session, %{})
    assert {:ok, _} = OcvSiteProjection.InvoiceBuilder.project(raw(session))
    assert_push "projection", %{"count" => 30, "dialogue" => %{"phase" => "resting"}}, 1_000
    ref = push(joined, "project", %{})
    assert_reply ref, :error, %{reason: "read_only"}
    assert {:error, %{reason: "session_mismatch"}} = subscribe_and_join(socket,
      OcvSiteProjection.StockChannel, "stock:00000000-0000-4000-8000-000000000018", %{})
  end

  test "idle expiry releases a supervised actor and its retained state recovers" do
    previous = Application.get_env(:ocv_site_projection, :session_ttl_ms, 600_000)
    Application.put_env(:ocv_site_projection, :session_ttl_ms, 100)
    on_exit(fn -> Application.put_env(:ocv_site_projection, :session_ttl_ms, previous) end)
    session = "00000000-0000-4000-8000-000000000019"
    assert {:ok, first} = OcvSiteProjection.InvoiceBuilder.project(raw(session))
    [{actor, _}] = Registry.lookup(OcvSiteProjection.Registry, session)
    ref = Process.monitor(actor)
    assert_receive {:DOWN, ^ref, :process, ^actor, :normal}, 1_000
    assert {:ok, recovered} = OcvSiteProjection.InvoiceBuilder.project(
      Map.put(raw(session), "prior", %{"checkpoint" => first["checkpoint"]}))
    assert recovered["talks"]["count"] == 1 and recovered["deduplicated"] == 1
  end

  test "each session refuses a fifth subscriber" do
    session = "00000000-0000-4000-8000-000000000020"
    subscribers = for _ <- 1..5, do: spawn(fn -> receive do :finish -> :ok end end)
    on_exit(fn -> Enum.each(subscribers, &send(&1, :finish)) end)
    [first, second, third, fourth, fifth] = subscribers
    Enum.each([first, second, third, fourth], fn pid ->
      assert :ok = OcvSiteProjection.InvoiceBuilder.subscribe(session, pid)
    end)
    assert {:error, "subscriber_limit", 429} = OcvSiteProjection.InvoiceBuilder.subscribe(session, fifth)
  end
end
