import { clamp, dist, type Vec } from '../core/math';

export interface ArmSolution {
  elbow: Vec;
  hand: Vec;
  reached: boolean;
}

export function solveIK(shoulder: Vec, target: Vec, upper: number, fore: number, bend: number): ArmSolution {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const raw = Math.hypot(dx, dy);
  const d = clamp(raw, Math.abs(upper - fore) + 0.01, upper + fore - 0.01);
  const base = Math.atan2(dy, dx);
  const cosA = clamp((upper * upper + d * d - fore * fore) / (2 * upper * d), -1, 1);
  const angle = base + Math.sign(bend || 1) * Math.acos(cosA);
  return {
    elbow: { x: shoulder.x + Math.cos(angle) * upper, y: shoulder.y + Math.sin(angle) * upper },
    hand: { x: shoulder.x + Math.cos(base) * d, y: shoulder.y + Math.sin(base) * d },
    reached: Math.abs(raw - d) < 0.5,
  };
}

export function gripFor(tip: Vec, grip: Vec, stick: number): Vec {
  const d = dist(tip, grip) || 1;
  return {
    x: tip.x + ((grip.x - tip.x) / d) * stick,
    y: tip.y + ((grip.y - tip.y) / d) * stick,
  };
}
