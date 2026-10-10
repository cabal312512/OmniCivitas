function smoothstep(value, low, high) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

// Keep real sky imagery present at every ordinary zoom level. Deep zoom gives
// more weight to independently rendered stars instead of enlarged photo pixels.
export function galaxyZoomVisibility(fieldOfView) {
  return 0.22 + 0.78 * smoothstep(fieldOfView, 2, 15);
}

export function starZoomScale(fieldOfView) {
  return Math.max(
    0.9,
    Math.min(1.45, Math.pow(56 / Math.max(0.1, fieldOfView), 0.13)),
  );
}

// Different entry/exit thresholds prevent download/disposal churn around one
// zoom boundary. Manual High bypasses this policy and pins the detailed map.
export function automaticSkyDetail(fieldOfView, current, tracking, eclipse) {
  if (!tracking || eclipse) return false;
  return current ? fieldOfView <= 45 : fieldOfView < 35;
}
