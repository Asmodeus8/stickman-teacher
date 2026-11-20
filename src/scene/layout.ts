import type { Vec } from '../core/math';

export const W = 1280;
export const H = 720;

export const BOARD = { x: 150, y: 60, w: 980, h: 412, frame: 16 };
export const INNER = {
  x: BOARD.x + BOARD.frame,
  y: BOARD.y + BOARD.frame,
  w: BOARD.w - BOARD.frame * 2,
  h: BOARD.h - BOARD.frame * 2,
};
export const FLOOR_Y = 600;
export const FOOT_Y = 668;
export const EQUATION_Y = 420;
export const NUMBER_HEIGHT = 48;
export const STAND_OFFSET = 105;

const COLS = [285, 460, 635, 810, 985];
const ROWS = [205, 335];
export const SLOTS: Vec[] = ROWS.flatMap(y => COLS.map(x => ({ x, y })));

export interface BoardNumber {
  value: number;
  slot: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function hitTest(numbers: readonly BoardNumber[], p: Vec, padX = 16, padY = 14): BoardNumber | undefined {
  return numbers.find(n =>
    p.x > n.x - n.w / 2 - padX && p.x < n.x + n.w / 2 + padX &&
    p.y > n.y - n.h / 2 - padY && p.y < n.y + n.h / 2 + padY);
}

export function readingOrder(numbers: readonly BoardNumber[]): BoardNumber[] {
  return [...numbers].sort((a, b) => a.slot - b.slot);
}

export function pickValues(count: number, rng: () => number = Math.random, min = 1, max = 99): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

export function pickSlots(count: number, rng: () => number = Math.random, total = SLOTS.length): number[] {
  const all = Array.from({ length: total }, (_, i) => i);
  return shuffle(all, rng).slice(0, Math.min(count, total)).sort((a, b) => a - b);
}

export function freeSlots(numbers: readonly BoardNumber[]): number[] {
  const used = new Set(numbers.map(n => n.slot));
  return SLOTS.map((_, i) => i).filter(i => !used.has(i));
}

export function standSpot(targetX: number, currentX: number, offset = STAND_OFFSET, minX = 60, maxX = W - 60): number {
  const side = currentX <= targetX ? -1 : 1;
  let x = targetX + side * offset;
  if (x < minX) x = targetX + offset;
  if (x > maxX) x = targetX - offset;
  return x;
}

export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
