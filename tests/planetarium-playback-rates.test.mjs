import { expect, it } from "vitest";
import {
  DEFAULT_PLAYBACK_RATES,
  playbackRateForView,
  rememberPlaybackRate,
} from "../config/apps/portal/src/planetarium/playback-rates.mjs";

it("keeps sky and solar rates independent across switches and temporary experiences", () => {
  let rates = { ...DEFAULT_PLAYBACK_RATES };
  expect(playbackRateForView(rates, "sky", 1)).toBe(60);
  expect(playbackRateForView(rates, "solar", 1)).toBe(2592000);
  rates = rememberPlaybackRate(rates, "sky", 600);
  expect(playbackRateForView(rates, "solar", 600)).toBe(2592000);
  rates = rememberPlaybackRate(rates, "solar", 86400);
  expect(playbackRateForView(rates, "sky", 86400)).toBe(600);
  expect(playbackRateForView(rates, "solar", 600)).toBe(86400);
  expect(rememberPlaybackRate(rates, "eclipse", 180)).toBe(rates);
  expect(rememberPlaybackRate(rates, "studio", 1)).toBe(rates);
  expect(playbackRateForView(rates, "eclipse", 180)).toBe(180);
  expect(playbackRateForView(rates, "studio", 1)).toBe(1);
  expect(DEFAULT_PLAYBACK_RATES).toEqual({ sky: 60, solar: 2592000 });
});
