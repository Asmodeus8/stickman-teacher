import { describe, expect, it } from 'vitest';
import {
  INNER, SLOTS, W, freeSlots, hitTest, pickSlots, pickValues, readingOrder, standSpot, type BoardNumber,
} from '../src/scene/layout';

const num = (value: number, slot: number): BoardNumber => ({ value, slot, x: SLOTS[slot].x, y: SLOTS[slot].y, w: 60, h: 48 });

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('board layout', () => {
  it('keeps every slot on the blackboard', () => {
    for (const s of SLOTS) {
      expect(s.x).toBeGreaterThan(INNER.x + 60);
      expect(s.x).toBeLessThan(INNER.x + INNER.w - 60);
      expect(s.y).toBeGreaterThan(INNER.y + 60);
    }
  });

  it('picks unique values in range', () => {
    for (let i = 0; i < 50; i++) {
      const values = pickValues(8, seeded(i));
      expect(new Set(values).size).toBe(8);
      expect(values.every(v => v >= 1 && v <= 99)).toBe(true);
    }
  });

  it('picks unique slots in reading order', () => {
    const slots = pickSlots(8, seeded(7));
    expect(new Set(slots).size).toBe(8);
    expect([...slots].sort((a, b) => a - b)).toEqual(slots);
  });

  it('finds which slots are still free', () => {
    expect(freeSlots([num(5, 0), num(9, 3)])).toEqual([1, 2, 4, 5, 6, 7, 8, 9]);
  });

  it('hit-tests numbers with some padding and misses empty board', () => {
    const n = num(42, 2);
    expect(hitTest([n], { x: n.x + 40, y: n.y })).toBe(n);
    expect(hitTest([n], { x: n.x + 80, y: n.y })).toBeUndefined();
  });

  it('reads numbers top row first, left to right', () => {
    const ns = [num(1, 7), num(2, 0), num(3, 4), num(4, 5)];
    expect(readingOrder(ns).map(n => n.value)).toEqual([2, 3, 4, 1]);
  });
});

describe('standSpot', () => {
  it('stands on the side he is already on', () => {
    expect(standSpot(600, 100)).toBe(495);
    expect(standSpot(600, 1000)).toBe(705);
  });

  it('never walks off screen', () => {
    expect(standSpot(120, 40)).toBe(225);
    expect(standSpot(W - 100, W - 10)).toBe(W - 205);
  });
});
