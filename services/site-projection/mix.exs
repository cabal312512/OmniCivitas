defmodule OcvSiteProjection.MixProject do
  use Mix.Project

  def project do
    deps_root = System.get_env("OCV_DEPS_ROOT")
    mix_home = System.get_env("MIX_HOME")
    if deps_root == nil and mix_home == nil and match?({:win32, _}, :os.type()) do
      raise "enter the OmniCivitas environment before running Mix on Windows"
    end
    cache_root = deps_root || Path.dirname(mix_home || "/ocv-cache/mix")
    cache = Path.join(cache_root, "cache/elixir/site-projection")
    external_sources = Enum.map(["../../config/7", "../../pcakage/locker13", "../../pinia/old13"], &Path.expand(&1, __DIR__))
    [app: :ocv_site_projection, version: "0.1.0", elixir: "~> 1.17",
     elixirc_paths: ["lib" | external_sources],
     deps_path: System.get_env("MIX_DEPS_PATH", Path.join(cache, "deps")),
     build_path: System.get_env("MIX_BUILD_PATH", Path.join(cache, "build")),
     deps: [{:phoenix, "== 1.7.24"}, {:plug_cowboy, "== 2.8.1"}, {:jason, "== 1.4.4"},
       {:cowboy, "== 2.20.0", override: true}, {:cowlib, "== 2.21.0", override: true}]]
  end

  def application do
    [mod: {OcvSiteProjection.Application, []}, extra_applications: [:logger, :crypto]]
  end
end
