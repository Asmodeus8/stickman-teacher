export interface Vec {
  x: number;
  y: number;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rand = (a: number, b: number, rng: () => number = Math.random): number => a + rng() * (b - a);
export const dist = (a: Vec, b: Vec): number => Math.hypot(b.x - a.x, b.y - a.y);
export const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
