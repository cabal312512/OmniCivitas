defmodule OcvSiteProjection.BodyGate do
  import Plug.Conn
  def init(options), do: options
  def call(conn, _options) do
    case get_req_header(conn, "content-length") do
      [length] ->
        case Integer.parse(length) do
          {n, ""} when n >= 0 and n <= 196_608 -> conn
          _ -> conn |> put_resp_content_type("application/json") |>
            send_resp(413, ~s({"status":"rejected","successReason":"body_limit"})) |> halt()
        end
      [] -> conn
      _ -> conn |> send_resp(400, "") |> halt()
    end
  end
end

defmodule OcvSiteProjection.Endpoint do
  use Phoenix.Endpoint, otp_app: :ocv_site_projection

  socket "/linen", OcvSiteProjection.LinenSocket,
    websocket: [timeout: 30_000, max_frame_size: 2_048], longpoll: false

  plug OcvSiteProjection.BodyGate
  plug Plug.Parsers, parsers: [:json], pass: [], json_decoder: Jason,
    length: 196_608, read_length: 196_608, read_timeout: 3_000
  plug OcvSiteProjection.Router
end

defmodule OcvSiteProjection.ErrorJSON do
  def render(_template, _assigns), do: %{status: "rejected", successReason: "invalid_http_request"}
end
