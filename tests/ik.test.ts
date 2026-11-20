import { describe, expect, it } from 'vitest';
import { gripFor, solveIK } from '../src/actor/ik';
import { dist } from '../src/core/math';

const shoulder = { x: 0, y: 0 };
const UPPER = 85;
const FORE = 80;

describe('solveIK', () => {
  it('lands the hand exactly on a reachable target', () => {
    const target = { x: 100, y: -60 };
    const { hand, reached } = solveIK(shoulder, target, UPPER, FORE, 1);
    expect(reached).toBe(true);
    expect(hand.x).toBeCloseTo(target.x, 5);
    expect(hand.y).toBeCloseTo(target.y, 5);
  });

  it('keeps both bones at their real lengths', () => {
    const { elbow, hand } = solveIK(shoulder, { x: 70, y: 90 }, UPPER, FORE, 1);
    expect(dist(shoulder, elbow)).toBeCloseTo(UPPER, 5);
    expect(dist(elbow, hand)).toBeCloseTo(FORE, 5);
  });

  it('clamps an out-of-reach target to a straight arm pointing at it', () => {
    const target = { x: 400, y: 0 };
    const { hand, elbow, reached } = solveIK(shoulder, target, UPPER, FORE, 1);
    expect(reached).toBe(false);
    expect(dist(shoulder, hand)).toBeCloseTo(UPPER + FORE, 1);
    expect(hand.y).toBeCloseTo(0, 5);
    expect(Math.abs(elbow.y)).toBeLessThan(2);
  });

  it('folds the elbow to opposite sides for opposite bend signs', () => {
    const target = { x: 120, y: 0 };
    const down = solveIK(shoulder, target, UPPER, FORE, 1);
    const up = solveIK(shoulder, target, UPPER, FORE, -1);
    expect(down.elbow.y).toBeGreaterThan(0);
    expect(up.elbow.y).toBeLessThan(0);
  });
});

describe('gripFor', () => {
  it('holds the stick exactly one stick-length from the tip, toward the grip', () => {
    const tip = { x: 300, y: 100 };
    const grip = { x: 0, y: 100 };
    const hand = gripFor(tip, grip, 150);
    expect(hand).toEqual({ x: 150, y: 100 });
  });
});
