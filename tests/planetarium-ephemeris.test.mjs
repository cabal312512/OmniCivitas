import { describe, it, expect } from 'vitest';
import {
  skySnapshot, solarSnapshot, solarOrbitPaths, findEclipses, presetEclipse,
  normalizeObserver, ECLIPSE_PRESETS, AU_KM,
} from '../config/apps/portal/src/planetarium/ephemeris.mjs';
import { processEphemerisRequest } from '../config/apps/portal/src/planetarium/ephemeris.worker.mjs';

const DALLAS = ECLIPSE_PRESETS[0].observer;
const LA_PALMA = { latitude: 28.76, longitude: -17.89, elevation: 2300 };
const TEST_TIME = '2025-08-12T22:00:00.000Z';
const angularDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

describe('planetarium ephemeris', () => {
  it('uses actual observer-centric positions with a stable complete body set', () => {
    const snapshot = skySnapshot(TEST_TIME, LA_PALMA);
    expect(snapshot.time).toBe(TEST_TIME);
    expect(snapshot.bodies.map(body => body.id).sort()).toEqual([
      'jupiter', 'mars', 'mercury', 'moon', 'neptune', 'saturn', 'sun', 'uranus', 'venus',
    ]);
    expect(snapshot.sunAltitude).toBeLessThan(-15);
    for (const body of snapshot.bodies) {
      expect(body.ra).toBeGreaterThanOrEqual(0);
      expect(body.ra).toBeLessThan(24);
      expect(body.dec).toBeGreaterThanOrEqual(-90);
      expect(body.dec).toBeLessThanOrEqual(90);
      expect(body.altitude).toBeGreaterThanOrEqual(-90);
      expect(body.altitude).toBeLessThanOrEqual(90);
      expect(body.azimuth).toBeGreaterThanOrEqual(0);
      expect(body.azimuth).toBeLessThan(360);
      expect(body.distanceAu).toBeGreaterThan(0);
      expect(body.angularRadius).toBeGreaterThan(0);
      expect(body.illumination).toBeGreaterThanOrEqual(0);
      expect(body.illumination).toBeLessThanOrEqual(1);
      expect(Math.hypot(...body.direction)).toBeCloseTo(1, 12);
    }
  });

  it('transforms catalogue coordinates into the exact renderer horizon convention', () => {
    const snapshot = skySnapshot(TEST_TIME, LA_PALMA);
    const m = snapshot.skyTransform;
    expect(m).toHaveLength(16);
    for (const body of snapshot.bodies) {
      const [x, y, z] = body.direction;
      const local = [
        m[0] * x + m[4] * y + m[8] * z,
        m[1] * x + m[5] * y + m[9] * z,
        m[2] * x + m[6] * y + m[10] * z,
      ];
      expect(Math.hypot(...local)).toBeCloseTo(1, 12);
      const altitude = Math.asin(local[1]) * 180 / Math.PI;
      const azimuth = (Math.atan2(local[0], -local[2]) * 180 / Math.PI + 360) % 360;
      expect(altitude).toBeCloseTo(body.altitude, 7);
      expect(angularDifference(azimuth, body.azimuth)).toBeLessThan(1e-7);
    }
  });

  it('changes the actual sky when observer longitude or simulation time changes', () => {
    const night = skySnapshot(TEST_TIME, LA_PALMA);
    const opposite = skySnapshot(TEST_TIME, { ...LA_PALMA, longitude: 162.11 });
    const later = skySnapshot('2025-08-13T10:00:00.000Z', LA_PALMA);
    expect(opposite.sunAltitude).toBeGreaterThan(30);
    expect(later.sunAltitude).toBeGreaterThan(30);
    const moon = night.bodies.find(body => body.id === 'moon');
    const movedMoon = later.bodies.find(body => body.id === 'moon');
    expect(angularDifference(moon.ra * 15, movedMoon.ra * 15)).toBeGreaterThan(3);
  });

  it('calculates Dallas totality contacts and apparent Sun/Moon alignment', () => {
    const event = presetEclipse('solar-2024-dallas');
    expect(event.kind).toBe('solar');
    expect(event.type).toBe('total');
    expect(event.visibleAtPeak).toBe(true);
    expect(event.visibility).toBe('full');
    expect(Date.parse(event.peak)).toBeGreaterThan(Date.parse('2024-04-08T18:38:00.000Z'));
    expect(Date.parse(event.peak)).toBeLessThan(Date.parse('2024-04-08T18:45:00.000Z'));
    expect(event.contacts.map(contact => contact.label)).toEqual(['C1', 'C2', 'MAX', 'C3', 'C4']);
    expect(event.contacts.map(contact => contact.time)).toEqual(event.contacts.map(contact => contact.time).sort());
    const totalitySeconds = (Date.parse(event.contacts[3].time) - Date.parse(event.contacts[1].time)) / 1000;
    expect(totalitySeconds).toBeGreaterThan(180);
    expect(totalitySeconds).toBeLessThan(300);
    const snapshot = skySnapshot(event.peak, DALLAS);
    expect(snapshot.solarObscuration).toBeGreaterThan(0.999);
    expect(snapshot.solarSeparation).toBeLessThan(0.05);
    const sun = snapshot.bodies.find(body => body.id === 'sun');
    const moon = snapshot.bodies.find(body => body.id === 'moon');
    expect(moon.angularRadius).toBeGreaterThan(sun.angularRadius);
    const before = skySnapshot('2024-04-08T16:00:00.000Z', DALLAS);
    expect(before.solarObscuration).toBe(0);
  });

  it('calculates March 2025 lunar phases and the real Earth-shadow geometry', () => {
    const event = presetEclipse('lunar-2025-dallas');
    expect(event.kind).toBe('lunar');
    expect(event.type).toBe('total');
    expect(event.visibleAtPeak).toBe(true);
    expect(Date.parse(event.peak)).toBeGreaterThan(Date.parse('2025-03-14T06:57:00.000Z'));
    expect(Date.parse(event.peak)).toBeLessThan(Date.parse('2025-03-14T07:02:00.000Z'));
    expect(event.contacts.map(contact => contact.label)).toEqual(['P1', 'U1', 'U2', 'MAX', 'U3', 'U4', 'P4']);
    const totalityMinutes = (Date.parse(event.contacts[4].time) - Date.parse(event.contacts[2].time)) / 60000;
    expect(totalityMinutes).toBeGreaterThan(60);
    expect(totalityMinutes).toBeLessThan(70);
    const snapshot = skySnapshot(event.peak, DALLAS);
    expect(snapshot.lunarShadow.umbraFraction).toBe(1);
    expect(snapshot.lunarShadow.penumbraFraction).toBe(1);
    expect(Math.hypot(...snapshot.lunarShadow.shadowDirectionEqj)).toBeCloseTo(1, 12);
    const moon = snapshot.bodies.find(body => body.id === 'moon');
    const shadowSeparation = Math.acos(Math.min(1, snapshot.lunarShadow.shadowDirectionEqj.reduce(
      (sum, value, index) => sum + value * moon.directionEqj[index], 0,
    ))) * 180 / Math.PI;
    expect(shadowSeparation + moon.angularRadius).toBeLessThan(snapshot.lunarShadow.angularRadius);
    expect(snapshot.lunarShadow.penumbraAngularRadius).toBeGreaterThan(snapshot.lunarShadow.angularRadius);
    expect(snapshot.bodies.find(body => body.id === 'moon').illumination).toBeGreaterThan(0.999);
    expect(snapshot.solarObscuration).toBe(0);
  });

  it('omits below-horizon lunar events from bounded location-specific search', () => {
    const events = findEclipses('2025-03-01T00:00:00.000Z', { latitude: 39.9042, longitude: 116.4074 }, 2);
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(2);
    expect(events.every(event => event.visible)).toBe(true);
    expect(events.some(event => event.kind === 'lunar' && event.peak.startsWith('2025-03-14'))).toBe(false);
    expect(events.map(event => event.peak)).toEqual(events.map(event => event.peak).sort());
  });

  it('returns a physically coherent heliocentric solar system and rotation axes', () => {
    const snapshot = solarSnapshot(TEST_TIME);
    expect(snapshot.bodies).toHaveLength(10);
    const byId = Object.fromEntries(snapshot.bodies.map(body => [body.id, body]));
    expect(byId.sun.position).toEqual([0, 0, 0]);
    expect(Math.hypot(...byId.earth.position)).toBeGreaterThan(0.98);
    expect(Math.hypot(...byId.earth.position)).toBeLessThan(1.02);
    const moonDistanceKm = Math.hypot(...byId.moon.position.map((value, index) => value - byId.earth.position[index])) * AU_KM;
    expect(moonDistanceKm).toBeGreaterThan(350000);
    expect(moonDistanceKm).toBeLessThan(410000);
    expect(Math.hypot(...byId.neptune.position)).toBeGreaterThan(29);
    for (const body of snapshot.bodies) {
      expect(body.radiusKm).toBeGreaterThan(0);
      expect(body.rotationAngle).toBeGreaterThanOrEqual(0);
      expect(body.rotationAngle).toBeLessThan(360);
      expect(Math.hypot(...body.north)).toBeCloseTo(1, 12);
      expect(body.position.every(Number.isFinite)).toBe(true);
    }
  });

  it('samples bounded real orbit guides only on request', () => {
    const paths = solarOrbitPaths(TEST_TIME, 12);
    expect(Object.keys(paths).sort()).toEqual(['earth', 'jupiter', 'mars', 'mercury', 'neptune', 'saturn', 'uranus', 'venus']);
    for (const points of Object.values(paths)) {
      expect(points).toHaveLength(13);
      expect(points.every(point => point.length === 3 && point.every(Number.isFinite))).toBe(true);
    }
    const earthDistances = paths.earth.map(point => Math.hypot(...point));
    expect(Math.max(...earthDistances) - Math.min(...earthDistances)).toBeGreaterThan(0.02);
    expect(solarOrbitPaths('2025-08-12T00:01:00.000Z', 12)).toBe(paths);
    expect(() => solarOrbitPaths(TEST_TIME, 65)).toThrow(/12 and 64/);
  });

  it('rejects ambiguous dates, invalid locations and unbounded search requests', () => {
    expect(() => skySnapshot('2025-08-12T22:00', LA_PALMA)).toThrow(/timezone/);
    expect(() => skySnapshot('not-a-dateZ', LA_PALMA)).toThrow();
    expect(() => solarSnapshot('1500-01-01T00:00:00Z')).toThrow(/1600/);
    expect(() => normalizeObserver({ latitude: 91, longitude: 0 })).toThrow(/Latitude/);
    expect(() => normalizeObserver({ latitude: 0, longitude: -181 })).toThrow(/Longitude/);
    expect(() => normalizeObserver({ latitude: 0, longitude: 0, elevation: NaN })).toThrow(/Elevation/);
    expect(() => findEclipses(TEST_TIME, LA_PALMA, 1000)).toThrow(/1 or 2/);
    expect(() => presetEclipse('fictional-event')).toThrow(/Unknown/);
  });

  it('returns structured-clone-safe worker responses and recoverable request errors', () => {
    const response = processEphemerisRequest({ id: 7, type: 'sky', time: TEST_TIME, observer: LA_PALMA });
    expect(response.id).toBe(7);
    expect(response.type).toBe('sky');
    expect(response.error).toBeUndefined();
    expect(structuredClone(response)).toEqual(response);
    const badTime = processEphemerisRequest({ id: 8, type: 'solar', time: 'invalid' });
    expect(badTime.error).toMatch(/timezone/);
    expect(badTime.result).toBeUndefined();
    const unknown = processEphemerisRequest({ id: 9, type: 'other' });
    expect(unknown.error).toMatch(/Unknown/);
    const preset = processEphemerisRequest({ id: 10, type: 'preset', eventId: 'solar-2024-dallas' });
    expect(preset.result.type).toBe('total');
  });
});
