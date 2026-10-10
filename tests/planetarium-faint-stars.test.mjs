import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadFaintCatalogue,
  parseFaintCatalogue,
} from "../config/apps/portal/src/planetarium/faint-star-catalogue.mjs";

const sample = () => ({
  schemaVersion: 1,
  epoch: "J2000",
  coordinateUnits: "degrees",
  count: 2,
  columns: ["id", "ra", "dec", "mag", "bv"],
  stars: [
    [3, 0.005, 38.8593, 6.61, -0.019],
    [120404, 119.5121, -60.6148, 7.62, null],
  ],
});

afterEach(() => vi.unstubAllGlobals());

describe("bounded real faint-star catalogue", () => {
  it("retains actual catalogue coordinates/magnitudes in a compact typed buffer", () => {
    const parsed = parseFaintCatalogue(sample());
    expect(parsed.count).toBe(2);
    expect(parsed.values).toBeInstanceOf(Float32Array);
    expect(parsed.values.length).toBe(8);
    expect(parsed.values[0]).toBeCloseTo(0.005, 6);
    expect(parsed.values[1]).toBeCloseTo(38.8593, 4);
    expect(parsed.values[2]).toBeCloseTo(6.61, 5);
    expect(parsed.values[7]).toBeNaN();
  });

  it("rejects wrong units, duplicates and invalid sky positions before GPU allocation", () => {
    expect(() =>
      parseFaintCatalogue({ ...sample(), coordinateUnits: "radians" }),
    ).toThrow();
    const duplicate = sample();
    duplicate.stars[1][0] = 3;
    expect(() => parseFaintCatalogue(duplicate)).toThrow();
    const impossible = sample();
    impossible.stars[1][2] = 91;
    expect(() => parseFaintCatalogue(impossible)).toThrow();
    const bright = sample();
    bright.stars[1][3] = 4;
    expect(() => parseFaintCatalogue(bright)).toThrow();
  });

  it("streams a valid local catalogue and forwards cancellation to fetch", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(sample())));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    expect(
      (await loadFaintCatalogue("/catalogue.json", controller.signal)).count,
    ).toBe(2);
    expect(fetch).toHaveBeenCalledWith("/catalogue.json", {
      signal: controller.signal,
    });
  });

  it("cancels an oversized stream even when its server omits content-length", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(2_500_001));
      },
      cancel,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(loadFaintCatalogue("/oversized.json")).rejects.toThrow(
      "byte budget",
    );
    expect(cancel).toHaveBeenCalledOnce();
  });
});
