import * as Astronomy from "astronomy-engine";

/** Astronomy Engine adapters. Angles are degrees, except right ascension (hours). */
export const DATE_RANGE = Object.freeze({ minYear: 1600, maxYear: 2400 });
export const AU_KM = Astronomy.KM_PER_AU;

// Mean planetary radii in km; the Sun uses the IAU nominal photospheric radius.
const BODY_DEFINITIONS = Object.freeze([
  { id: "sun", body: Astronomy.Body.Sun, radiusKm: 695700 },
  {
    id: "mercury",
    body: Astronomy.Body.Mercury,
    radiusKm: 2439.7,
    periodDays: 87.969,
  },
  {
    id: "venus",
    body: Astronomy.Body.Venus,
    radiusKm: 6051.8,
    periodDays: 224.701,
  },
  {
    id: "earth",
    body: Astronomy.Body.Earth,
    radiusKm: 6371.0,
    periodDays: 365.256,
  },
  {
    id: "mars",
    body: Astronomy.Body.Mars,
    radiusKm: 3389.5,
    periodDays: 686.98,
  },
  {
    id: "jupiter",
    body: Astronomy.Body.Jupiter,
    radiusKm: 69911,
    periodDays: 4332.589,
  },
  {
    id: "saturn",
    body: Astronomy.Body.Saturn,
    radiusKm: 58232,
    periodDays: 10759.22,
  },
  {
    id: "uranus",
    body: Astronomy.Body.Uranus,
    radiusKm: 25362,
    periodDays: 30685.4,
  },
  {
    id: "neptune",
    body: Astronomy.Body.Neptune,
    radiusKm: 24622,
    periodDays: 60189.0,
  },
  { id: "moon", body: Astronomy.Body.Moon, radiusKm: 1737.4 },
]);

export const ECLIPSE_PRESETS = Object.freeze([
  Object.freeze({
    id: "solar-2024-dallas",
    kind: "solar",
    time: "2024-04-08T18:40:00.000Z",
    searchFrom: "2024-04-01T00:00:00.000Z",
    observer: Object.freeze({
      latitude: 32.7767,
      longitude: -96.797,
      elevation: 131,
    }),
  }),
  Object.freeze({
    id: "lunar-2025-dallas",
    kind: "lunar",
    time: "2025-03-14T06:59:00.000Z",
    searchFrom: "2025-03-01T00:00:00.000Z",
    observer: Object.freeze({
      latitude: 32.7767,
      longitude: -96.797,
      elevation: 131,
    }),
  }),
]);

const DEG = Math.PI / 180;
const MINUTE_MS = 60000;
const DAY_MS = 86400000;
const orbitCache = new Map();
const presetCache = new Map();
const trajectoryCaches = { solar: new Map(), sky: new Map() };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const vectorArray = (vector) => [vector.x, vector.y, vector.z];
const normalizedVector = (vector) => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return [vector.x / length, vector.y / length, vector.z / length];
};

function observationTime(isoDate) {
  if (
    !(isoDate instanceof Date) &&
    (typeof isoDate !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(isoDate))
  ) {
    throw new TypeError(
      "Time must be an ISO timestamp with an explicit timezone.",
    );
  }
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime()))
    throw new RangeError("Invalid observation time.");
  const year = date.getUTCFullYear();
  if (year < DATE_RANGE.minYear || year > DATE_RANGE.maxYear) {
    throw new RangeError(
      `Observation year must be ${DATE_RANGE.minYear}–${DATE_RANGE.maxYear}.`,
    );
  }
  return date;
}

/** Longitudes are east-positive; elevations are metres above mean sea level. */
export function normalizeObserver(input = {}) {
  const observer = {
    latitude: input.latitude,
    longitude: input.longitude,
    elevation: input.elevation ?? 0,
  };
  if (
    !Number.isFinite(observer.latitude) ||
    observer.latitude < -90 ||
    observer.latitude > 90
  ) {
    throw new RangeError("Latitude must be between −90 and 90 degrees.");
  }
  if (
    !Number.isFinite(observer.longitude) ||
    observer.longitude < -180 ||
    observer.longitude > 180
  ) {
    throw new RangeError("Longitude must be between −180 and 180 degrees.");
  }
  if (
    !Number.isFinite(observer.elevation) ||
    observer.elevation < -1000 ||
    observer.elevation > 100000
  ) {
    throw new RangeError("Elevation must be between −1000 and 100000 metres.");
  }
  return observer;
}

function engineObserver(observer) {
  return new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.elevation,
  );
}

/**
 * Column-major Matrix4 mapping the sky renderer's J2000 coordinates
 * [cos(dec)cos(ra), sin(dec), −cos(dec)sin(ra)] to local [east, up, −north].
 * Astronomy Engine stores its own matrices by input axis, so transform basis
 * vectors explicitly rather than assuming row-major matrix conventions.
 */
function localSkyTransform(date, observer) {
  const rotation = Astronomy.Rotation_EQJ_HOR(date, observer);
  const time = Astronomy.MakeTime(date);
  const result = [];
  for (const [x, y, z] of [
    [1, 0, 0],
    [0, 0, 1],
    [0, -1, 0],
  ]) {
    const horizontal = Astronomy.RotateVector(
      rotation,
      new Astronomy.Vector(x, y, z, time),
    );
    result.push(-horizontal.y, horizontal.z, -horizontal.x, 0);
  }
  result.push(0, 0, 0, 1);
  return result;
}

/** Fraction of the first circular disc covered by the second; units may be km or degrees. */
function discOverlap(radius, occluderRadius, separation) {
  if (separation >= radius + occluderRadius) return 0;
  if (separation <= Math.abs(radius - occluderRadius)) {
    return Math.min(1, (occluderRadius / radius) ** 2);
  }
  const a = Math.acos(
    clamp(
      (separation ** 2 + radius ** 2 - occluderRadius ** 2) /
        (2 * separation * radius),
      -1,
      1,
    ),
  );
  const b = Math.acos(
    clamp(
      (separation ** 2 + occluderRadius ** 2 - radius ** 2) /
        (2 * separation * occluderRadius),
      -1,
      1,
    ),
  );
  const triangle = Math.sqrt(
    Math.max(
      0,
      (-separation + radius + occluderRadius) *
        (separation + radius - occluderRadius) *
        (separation - radius + occluderRadius) *
        (separation + radius + occluderRadius),
    ),
  );
  return clamp(
    (radius ** 2 * a + occluderRadius ** 2 * b - triangle / 2) /
      (Math.PI * radius ** 2),
    0,
    1,
  );
}

/** Geometric lunar shadow, for shading only; contact times come from SearchLunarEclipse. */
function lunarShadow(date, observer) {
  const moon = vectorArray(Astronomy.GeoMoon(date)).map(
    (value) => value * AU_KM,
  );
  const sun = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  const sunDistanceKm = Math.hypot(sun.x, sun.y, sun.z) * AU_KM;
  const axis = normalizedVector(sun).map((value) => -value);
  const axialDistanceKm = moon.reduce(
    (sum, value, index) => sum + value * axis[index],
    0,
  );
  if (axialDistanceKm <= 0) return { umbraFraction: 0, penumbraFraction: 0 };
  const offset = moon.map(
    (value, index) => value - axialDistanceKm * axis[index],
  );
  const axisDistanceKm = Math.hypot(...offset);
  const earthRadiusKm = 6371;
  const sunRadiusKm = 695700;
  const umbraRadiusKm =
    earthRadiusKm -
    (axialDistanceKm * (sunRadiusKm - earthRadiusKm)) / sunDistanceKm;
  const penumbraRadiusKm =
    earthRadiusKm +
    (axialDistanceKm * (sunRadiusKm + earthRadiusKm)) / sunDistanceKm;
  // The shadow cross-section lies in the Moon's axial plane. Remove the
  // observer's actual geocentric position before projecting its centre into
  // the sky, so the moving shadow edge uses the same topocentric frame as Moon.
  const observerPosition = vectorArray(
    Astronomy.ObserverVector(date, observer, false),
  );
  const shadowCentre = axis.map(
    (value, index) => value * axialDistanceKm - observerPosition[index] * AU_KM,
  );
  const shadowDistanceKm = Math.hypot(...shadowCentre);
  const shadowDirectionEqj = shadowCentre.map(
    (value) => value / shadowDistanceKm,
  );
  return {
    umbraFraction: discOverlap(
      1737.4,
      Math.max(0, umbraRadiusKm),
      axisDistanceKm,
    ),
    penumbraFraction: discOverlap(1737.4, penumbraRadiusKm, axisDistanceKm),
    axisDistanceKm,
    umbraRadiusKm,
    penumbraRadiusKm,
    angularRadius:
      Math.asin(clamp(umbraRadiusKm / shadowDistanceKm, 0, 1)) / DEG,
    penumbraAngularRadius:
      Math.asin(clamp(penumbraRadiusKm / shadowDistanceKm, 0, 1)) / DEG,
    shadowDirectionEqj,
    shadowDirection: [
      shadowDirectionEqj[0],
      shadowDirectionEqj[2],
      -shadowDirectionEqj[1],
    ],
  };
}

/**
 * Apparent observer-centric celestial positions; RA/Dec are J2000 for catalogue
 * alignment. Altitude/azimuth use the true equator of date, without refraction:
 * eclipse geometry remains consistent and below-horizon objects stay below.
 */
export function skySnapshot(isoDate, inputObserver) {
  const date = observationTime(isoDate);
  const observer = normalizeObserver(inputObserver);
  const location = engineObserver(observer);
  const bodies = BODY_DEFINITIONS.filter((item) => item.id !== "earth").map(
    (definition) => {
      const equatorial = Astronomy.Equator(
        definition.body,
        date,
        location,
        false,
        true,
      );
      const ofDate = Astronomy.Equator(
        definition.body,
        date,
        location,
        true,
        true,
      );
      const horizontal = Astronomy.Horizon(
        date,
        location,
        ofDate.ra,
        ofDate.dec,
      );
      const illumination = Astronomy.Illumination(definition.body, date);
      const directionEqj = normalizedVector(equatorial.vec);
      return {
        id: definition.id,
        ra: equatorial.ra,
        dec: equatorial.dec,
        raOfDate: ofDate.ra,
        decOfDate: ofDate.dec,
        altitude: horizontal.altitude,
        azimuth: horizontal.azimuth,
        distanceAu: equatorial.dist,
        angularRadius:
          Math.asin(
            clamp(definition.radiusKm / (equatorial.dist * AU_KM), 0, 1),
          ) / DEG,
        illumination: illumination.phase_fraction,
        phaseAngle: illumination.phase_angle,
        magnitude: illumination.mag,
        directionEqj,
        direction: [directionEqj[0], directionEqj[2], -directionEqj[1]],
      };
    },
  );
  const sun = bodies.find((body) => body.id === "sun");
  const moon = bodies.find((body) => body.id === "moon");
  const separation =
    Math.acos(
      clamp(
        sun.directionEqj.reduce(
          (sum, value, index) => sum + value * moon.directionEqj[index],
          0,
        ),
        -1,
        1,
      ),
    ) / DEG;
  const deltaRa = (sun.ra - moon.ra) * 15 * DEG;
  moon.brightLimbAngle =
    Math.atan2(
      Math.cos(sun.dec * DEG) * Math.sin(deltaRa),
      Math.sin(sun.dec * DEG) * Math.cos(moon.dec * DEG) -
        Math.cos(sun.dec * DEG) * Math.sin(moon.dec * DEG) * Math.cos(deltaRa),
    ) / DEG;
  return {
    time: date.toISOString(),
    observer,
    sunAltitude: sun.altitude,
    skyTransform: localSkyTransform(date, location),
    bodies,
    solarSeparation: separation,
    solarObscuration: discOverlap(
      sun.angularRadius,
      moon.angularRadius,
      separation,
    ),
    lunarShadow: lunarShadow(date, location),
  };
}

/** Heliocentric positions and north axes in the J2000 equatorial basis, in AU. */
export function solarSnapshot(isoDate) {
  const date = observationTime(isoDate);
  return {
    time: date.toISOString(),
    bodies: BODY_DEFINITIONS.map((definition) => {
      const axis = Astronomy.RotationAxis(definition.body, date);
      return {
        id: definition.id,
        position: vectorArray(Astronomy.HelioVector(definition.body, date)),
        radiusKm: definition.radiusKm,
        rotationAngle: ((axis.spin % 360) + 360) % 360,
        north: normalizedVector(axis.north),
      };
    }),
  };
}

/**
 * Fixed-grid ephemeris knots are shared between consecutive Worker requests.
 * The display consumes this small curve instead of extending a long chord.
 * At the largest speed the look-ahead is 90 days, never an unbounded scan.
 */
function motionTracks(kind, date, speed) {
  const signedSpeed = Number.isFinite(speed)
    ? clamp(speed, -30 * 86400, 30 * 86400)
    : 0;
  const lookAheadMs = Math.min(90 * DAY_MS, Math.abs(signedSpeed) * 3000);
  const early = date.getTime() - (signedSpeed < 0 ? lookAheadMs : 0);
  const late = date.getTime() + (signedSpeed >= 0 ? lookAheadMs : 0);
  const minTime = Date.UTC(DATE_RANGE.minYear, 0, 1);
  const maxTime = Date.UTC(DATE_RANGE.maxYear + 1, 0, 1) - 1;
  const cache = trajectoryCaches[kind];
  const tracks = {};
  for (const definition of BODY_DEFINITIONS) {
    if (kind === "sky" && definition.id === "earth") continue;
    const baseStep =
      definition.id === "moon"
        ? DAY_MS / 4
        : kind === "solar"
          ? 2 * DAY_MS
          : DAY_MS;
    const stepMs = Math.max(
      baseStep,
      Math.ceil(lookAheadMs / 116 / baseStep) * baseStep,
    );
    const first = Math.max(
      Math.ceil(minTime / stepMs),
      Math.floor(early / stepMs) - 2,
    );
    const last = Math.min(
      Math.floor(maxTime / stepMs),
      Math.ceil(late / stepMs) + 2,
    );
    const positions = [],
      velocities = [];
    for (let index = first; index <= last; index += 1) {
      const key = `${definition.id}:${stepMs}:${index}`;
      let knot = cache.get(key);
      if (!knot) {
        const time = new Date(index * stepMs);
        if (kind === "solar") {
          const value = Astronomy.HelioState(definition.body, time);
          knot = {
            position: vectorArray(value),
            velocity: [value.vx / DAY_MS, value.vy / DAY_MS, value.vz / DAY_MS],
          };
        } else {
          knot = {
            position: vectorArray(
              Astronomy.GeoVector(definition.body, time, true),
            ),
          };
        }
        if (cache.size >= 1024) cache.delete(cache.keys().next().value);
        cache.set(key, knot);
      }
      positions.push(knot.position);
      if (kind === "solar") velocities.push(knot.velocity);
    }
    tracks[definition.id] = {
      startTimeMs: first * stepMs,
      stepMs,
      positions,
      ...(kind === "solar" ? { velocities } : {}),
    };
  }
  return { kind, speed: signedSpeed, tracks };
}

export function solarMotionSnapshot(isoDate, speed = 0) {
  const date = observationTime(isoDate);
  const snapshot = solarSnapshot(date);
  snapshot.motion = motionTracks("solar", date, speed);
  return snapshot;
}

export function skyMotionSnapshot(isoDate, inputObserver, speed = 0) {
  const date = observationTime(isoDate);
  const snapshot = skySnapshot(date, inputObserver);
  const location = engineObserver(snapshot.observer);
  const vector = Astronomy.ObserverVector(date, location, false);
  const input = [vector.x, vector.z, -vector.y];
  const m = snapshot.skyTransform;
  snapshot.motion = {
    ...motionTracks("sky", date, speed),
    observerOffset: [
      m[0] * input[0] + m[4] * input[1] + m[8] * input[2],
      m[1] * input[0] + m[5] * input[1] + m[9] * input[2],
      m[2] * input[0] + m[6] * input[1] + m[10] * input[2],
    ],
  };
  return snapshot;
}

/**
 * Lazy, bounded orbit guides: actual ephemeris points over one approximate
 * sidereal period centred on the selected day. They are visual guides, not
 * predictive osculating elements. Never computed by the ordinary snapshots.
 */
export function solarOrbitPaths(isoDate, samples = 48) {
  const date = observationTime(isoDate);
  if (!Number.isInteger(samples) || samples < 12 || samples > 64) {
    throw new RangeError(
      "Orbit sampling must be an integer between 12 and 64.",
    );
  }
  const day = Math.floor(date.getTime() / DAY_MS);
  const cacheKey = `${day}:${samples}`;
  if (orbitCache.has(cacheKey)) return orbitCache.get(cacheKey);
  const centreTime = new Date(day * DAY_MS);
  const paths = {};
  for (const definition of BODY_DEFINITIONS.filter((item) => item.periodDays)) {
    paths[definition.id] = Array.from({ length: samples + 1 }, (_, index) => {
      const time = new Date(
        centreTime.getTime() +
          (index / samples - 0.5) * definition.periodDays * DAY_MS,
      );
      return vectorArray(Astronomy.HelioVector(definition.body, time));
    });
  }
  if (orbitCache.size >= 3) orbitCache.delete(orbitCache.keys().next().value);
  orbitCache.set(cacheKey, paths);
  return paths;
}

function altitudeAt(kind, date, observer) {
  const body = kind === "solar" ? Astronomy.Body.Sun : Astronomy.Body.Moon;
  const equatorial = Astronomy.Equator(body, date, observer, true, true);
  return Astronomy.Horizon(date, observer, equatorial.ra, equatorial.dec)
    .altitude;
}

function eclipseContact(kind, label, date, location) {
  const altitude = altitudeAt(kind, date, location);
  return { label, time: date.toISOString(), altitude, visible: altitude > 0 };
}

function eventVisibility(contacts, kind, start, end, location) {
  // Contacts alone can miss an event straddling sunrise/moonrise. A small fixed
  // sampling budget catches that case without an unbounded horizon search.
  const altitudes = contacts.map((contact) => contact.altitude);
  for (let index = 1; index < 8; index += 1) {
    altitudes.push(
      altitudeAt(
        kind,
        new Date(start.getTime() + ((end - start) * index) / 8),
        location,
      ),
    );
  }
  return {
    visible: altitudes.some((altitude) => altitude > 0),
    visibility: altitudes.every((altitude) => altitude > 0)
      ? "full"
      : "partial",
  };
}

function solarEvent(eclipse, observer, presetId) {
  const location = engineObserver(observer);
  const phases = [
    ["C1", eclipse.partial_begin],
    ["C2", eclipse.total_begin],
    ["MAX", eclipse.peak],
    ["C3", eclipse.total_end],
    ["C4", eclipse.partial_end],
  ].filter(([, phase]) => phase);
  const contacts = phases.map(([label, phase]) =>
    eclipseContact("solar", label, phase.time.date, location),
  );
  const start = eclipse.partial_begin.time.date;
  const end = eclipse.partial_end.time.date;
  const visibility = eventVisibility(contacts, "solar", start, end, location);
  return {
    id: presetId ?? `solar-${eclipse.peak.time.date.toISOString()}`,
    kind: "solar",
    type: eclipse.kind,
    peak: eclipse.peak.time.date.toISOString(),
    start: start.toISOString(),
    end: end.toISOString(),
    contacts,
    observer: { ...observer },
    obscuration: eclipse.obscuration,
    visibleAtPeak: contacts.find((contact) => contact.label === "MAX").visible,
    ...visibility,
  };
}

function lunarEvent(eclipse, observer, presetId) {
  const location = engineObserver(observer);
  const peak = eclipse.peak.date;
  const phases = [
    ["P1", -eclipse.sd_penum],
    ...(eclipse.sd_partial > 0 ? [["U1", -eclipse.sd_partial]] : []),
    ...(eclipse.sd_total > 0 ? [["U2", -eclipse.sd_total]] : []),
    ["MAX", 0],
    ...(eclipse.sd_total > 0 ? [["U3", eclipse.sd_total]] : []),
    ...(eclipse.sd_partial > 0 ? [["U4", eclipse.sd_partial]] : []),
    ["P4", eclipse.sd_penum],
  ];
  const contacts = phases.map(([label, minutes]) =>
    eclipseContact(
      "lunar",
      label,
      new Date(peak.getTime() + minutes * MINUTE_MS),
      location,
    ),
  );
  const start = new Date(contacts[0].time);
  const end = new Date(contacts.at(-1).time);
  const visibility = eventVisibility(contacts, "lunar", start, end, location);
  return {
    id: presetId ?? `lunar-${peak.toISOString()}`,
    kind: "lunar",
    type: eclipse.kind,
    peak: peak.toISOString(),
    start: start.toISOString(),
    end: end.toISOString(),
    contacts,
    observer: { ...observer },
    obscuration: eclipse.obscuration,
    visibleAtPeak: contacts.find((contact) => contact.label === "MAX").visible,
    ...visibility,
  };
}

/** Compute one named event on demand; its peak and contacts are never hardcoded. */
export function presetEclipse(eventId) {
  if (presetCache.has(eventId)) return presetCache.get(eventId);
  const preset = ECLIPSE_PRESETS.find((event) => event.id === eventId);
  if (!preset) throw new RangeError("Unknown eclipse preset.");
  const observer = normalizeObserver(preset.observer);
  const searchTime = observationTime(preset.searchFrom);
  const event =
    preset.kind === "solar"
      ? solarEvent(
          Astronomy.SearchLocalSolarEclipse(
            searchTime,
            engineObserver(observer),
          ),
          observer,
          preset.id,
        )
      : lunarEvent(
          Astronomy.SearchLunarEclipse(searchTime),
          observer,
          preset.id,
        );
  presetCache.set(eventId, event);
  return event;
}

/** Backward-compatible list helper; callers should prefer one named preset. */
export function curatedEclipses() {
  return ECLIPSE_PRESETS.map((event) => presetEclipse(event.id));
}

/**
 * At most two upcoming visible events; examines at most six candidates of
 * each type within five years. Only call this explicitly, never every frame.
 * Empty/short results mean the bounded window has no further visible events.
 */
export function findEclipses(isoDate, inputObserver, limit = 2) {
  const date = observationTime(isoDate);
  const observer = normalizeObserver(inputObserver);
  const location = engineObserver(observer);
  if (!Number.isInteger(limit) || limit < 1 || limit > 2) {
    throw new RangeError("Eclipse result limit must be 1 or 2.");
  }
  const horizon = Math.min(
    date.getTime() + 5 * 365.25 * DAY_MS,
    Date.UTC(DATE_RANGE.maxYear + 1, 0, 1) - 1,
  );
  const events = [];
  for (const kind of ["solar", "lunar"]) {
    let eclipse =
      kind === "solar"
        ? Astronomy.SearchLocalSolarEclipse(date, location)
        : Astronomy.SearchLunarEclipse(date);
    let visibleCount = 0;
    for (let candidate = 0; candidate < 6; candidate += 1) {
      const peak = kind === "solar" ? eclipse.peak.time : eclipse.peak;
      if (peak.date.getTime() > horizon) break;
      const event =
        kind === "solar"
          ? solarEvent(eclipse, observer)
          : lunarEvent(eclipse, observer);
      if (event.visible && peak.date.getTime() >= date.getTime()) {
        events.push(event);
        visibleCount += 1;
        if (visibleCount >= limit) break;
      }
      eclipse =
        kind === "solar"
          ? Astronomy.NextLocalSolarEclipse(peak, location)
          : Astronomy.NextLunarEclipse(peak);
    }
  }
  return events.sort((a, b) => a.peak.localeCompare(b.peak)).slice(0, limit);
}
