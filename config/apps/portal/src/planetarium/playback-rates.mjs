export const DEFAULT_PLAYBACK_RATES = Object.freeze({
  sky: 60,
  solar: 30 * 86400,
});

/** Studio and historical eclipse playback keep their temporary local rate. */
export function playbackRateForView(rates, view, fallback) {
  return view === "sky" || view === "solar" ? rates[view] : fallback;
}

export function rememberPlaybackRate(rates, view, value) {
  if (
    (view !== "sky" && view !== "solar") ||
    !Number.isFinite(value) ||
    value <= 0
  )
    return rates;
  return { ...rates, [view]: value };
}
