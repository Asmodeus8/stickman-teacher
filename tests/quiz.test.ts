import { describe, expect, it } from 'vitest';
import { isPrime, isSquare, numberFact, spoken } from '../src/quiz/facts';
import { QUESTION_KINDS, isCorrect, makeQuestion } from '../src/quiz/questions';
import { SLOTS, pickSlots, pickValues, type BoardNumber } from '../src/scene/layout';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function board(rng: () => number): BoardNumber[] {
  const values = pickValues(8, rng);
  return pickSlots(8, rng).map((slot, i) => ({ value: values[i], slot, x: SLOTS[slot].x, y: SLOTS[slot].y, w: 60, h: 48 }));
}

describe('number facts', () => {
  it('knows primes and squares', () => {
    expect([2, 3, 13, 97].every(isPrime)).toBe(true);
    expect([0, 1, 9, 51, 91].some(isPrime)).toBe(false);
    expect([4, 49, 81].every(isSquare)).toBe(true);
    expect(isSquare(1)).toBe(false);
  });

  it('picks the most interesting fact first', () => {
    expect(numberFact(36)).toBe('36 is a square number: 6 × 6!');
    expect(numberFact(17)).toBe('17 is a prime number!');
    expect(numberFact(40)).toBe('40 is a multiple of 10!');
    expect(numberFact(35)).toBe('35 is in the 5 times table!');
    expect(numberFact(42)).toBe('42 is even: 21 + 21');
    expect(numberFact(21)).toBe('21 is an odd number');
  });

  it('reads symbols out loud', () => {
    expect(spoken('36 is a square number: 6 × 6!')).toBe('36 is a square number, 6 times 6!');
  });
});

describe('quiz questions', () => {
  it('always has an answer that is on the board', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seeded(seed);
      const ns = board(rng);
      const q = makeQuestion(ns, rng);
      expect(q).not.toBeNull();
      expect(q!.answers.length).toBeGreaterThan(0);
      expect(q!.answers.every(a => ns.includes(a))).toBe(true);
    }
  });

  it('marks exactly the right numbers as correct', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seeded(seed);
      const ns = board(rng);
      const q = makeQuestion(ns, rng)!;
      const values = ns.map(n => n.value);
      for (const n of ns) {
        const expected = {
          biggest: n.value === Math.max(...values),
          smallest: n.value === Math.min(...values),
          even: n.value % 2 === 0,
          odd: n.value % 2 === 1,
        }[q.kind as 'biggest' | 'smallest' | 'even' | 'odd'];
        if (expected !== undefined) expect(isCorrect(q, n)).toBe(expected);
      }
      if (q.kind === 'find' || q.kind === 'closest' || q.kind === 'compare') expect(q.answers).toHaveLength(1);
    }
  });

  it('never repeats the kind it was asked to avoid', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed);
      const ns = board(rng);
      for (const avoid of QUESTION_KINDS) expect(makeQuestion(ns, rng, avoid)?.kind).not.toBe(avoid);
    }
  });

  it('returns null for an empty board', () => {
    expect(makeQuestion([])).toBeNull();
  });
});
