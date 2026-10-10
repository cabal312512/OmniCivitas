import { describe, expect, it } from 'vitest';
import { constrainGlassFrame } from '../config/apps/portal/src/q7/glass-drag.mjs';

describe('empty glass frames remain reachable when moved or resized', () => {
  it('preserves an ordinary in-bounds drag without rounding its coordinates', () => {
    expect(constrainGlassFrame({ x: 224.5, y: 306.25 }, { width: 382, height: 262 }, { width: 1440, height: 960 })).toEqual({ x: 224.5, y: 306.25 });
  });
  it('keeps the whole frame reachable at all four viewport edges', () => {
    const size = { width: 302, height: 192 }, viewport = { width: 390, height: 844 };
    for (const x of [-10000, 10000]) for (const y of [-10000, 10000]) {
      const result = constrainGlassFrame({ x, y }, size, viewport);
      expect(result.x).toBeGreaterThanOrEqual(8);
      expect(result.y).toBeGreaterThanOrEqual(8);
      expect(result.x + size.width).toBeLessThanOrEqual(viewport.width - 8);
      expect(result.y + size.height).toBeLessThanOrEqual(viewport.height - 8);
    }
  });
  it('uses the available margin for very narrow layouts', () => {
    expect(constrainGlassFrame({ x: 80, y: 90 }, { width: 388, height: 840 }, { width: 390, height: 844 })).toEqual({ x: 1, y: 2 });
  });
  it('never writes non-finite positions for invalid or transient viewport data', () => {
    const position = constrainGlassFrame({ x: NaN, y: Infinity }, { width: 300, height: 200 }, { width: 0, height: 0 });
    expect(position).toEqual({ x: 0, y: 0 });
  });
});
