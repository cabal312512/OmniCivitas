import { describe, it, expect } from 'vitest';
import { createResidentPreviewMemory, residentPreviewKey } from '../config/apps/portal/src/q8/resident-preview.mjs';

function store(initial) {
  const values = new Map(Object.entries(initial || {}));
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), values };
}
describe('local resident appearance preview', () => {
  it('unlocks on precisely the twentieth press and persists without modifying hunt state', () => {
    const hunt = '{"session":"untouched","found":[3],"awarded":false}';
    const storage = store({ 'ocv.q8.hunt.v1': hunt });
    const memory = createResidentPreviewMemory(storage);
    for (let i = 1; i < 20; i++) expect(memory.tap()).toEqual({ count: i, unlocked: false, newlyUnlocked: false });
    expect(memory.tap()).toEqual({ count: 20, unlocked: true, newlyUnlocked: true });
    expect(memory.tap()).toEqual({ count: 20, unlocked: true, newlyUnlocked: false });
    expect(createResidentPreviewMemory(storage).snapshot()).toEqual({ count: 20, unlocked: true });
    expect(storage.values.get('ocv.q8.hunt.v1')).toBe(hunt);
    expect(storage.values.size).toBe(2);
  });
  it('rejects malformed counters and caps valid counters', () => {
    for (const count of [-3, '20', 19.5, null]) {
      expect(createResidentPreviewMemory(store({ [residentPreviewKey]: JSON.stringify({ count }) })).snapshot()).toEqual({ count: 0, unlocked: false });
    }
    expect(createResidentPreviewMemory(store({ [residentPreviewKey]: '{broken' })).snapshot().count).toBe(0);
    expect(createResidentPreviewMemory(store({ [residentPreviewKey]: '{"count":200}' })).snapshot()).toEqual({ count: 20, unlocked: true });
  });
  it('works in memory when browser storage is disabled', () => {
    const memory = createResidentPreviewMemory({ getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } });
    for (let i = 0; i < 20; i++) memory.tap();
    expect(memory.snapshot()).toEqual({ count: 20, unlocked: true });
  });
  it('observes saved progress from another tab before the next press', () => {
    const storage = store(), first = createResidentPreviewMemory(storage), second = createResidentPreviewMemory(storage);
    for (let i = 0; i < 12; i++) first.tap();
    expect(second.snapshot().count).toBe(12);
    for (let i = 0; i < 8; i++) second.tap();
    expect(first.snapshot()).toEqual({ count: 20, unlocked: true });
  });
});
