import {
  skySnapshot,
  solarSnapshot,
  skyMotionSnapshot,
  solarMotionSnapshot,
  solarOrbitPaths,
  findEclipses,
  presetEclipse,
} from "./ephemeris.mjs";

/** Plain, structured-clone-safe request/response protocol; no network or server. */
export function processEphemerisRequest(request = {}) {
  const { id, type, time, observer, limit, samples, eventId, speed } = request;
  try {
    let result;
    switch (type) {
      case "sky":
        result = Number.isFinite(speed)
          ? skyMotionSnapshot(time, observer, speed)
          : skySnapshot(time, observer);
        break;
      case "solar":
        result = Number.isFinite(speed)
          ? solarMotionSnapshot(time, speed)
          : solarSnapshot(time);
        break;
      case "orbits":
        result = solarOrbitPaths(time, samples);
        break;
      case "eclipses":
        result = findEclipses(time, observer, limit);
        break;
      case "preset":
        result = presetEclipse(eventId);
        break;
      default:
        throw new RangeError("Unknown ephemeris request type.");
    }
    return { id, type, result };
  } catch (error) {
    return {
      id,
      type,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

if (typeof self !== "undefined" && typeof document === "undefined") {
  self.addEventListener("message", (event) => {
    self.postMessage(processEphemerisRequest(event.data));
  });
}
