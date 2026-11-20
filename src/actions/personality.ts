import { numberFact, spoken } from '../quiz/facts';
import type { BoardNumber } from '../scene/layout';
import type { Teacher } from './teacher';

export const TEACHER_NAME = 'Michael';

const POKES = [
  'Hey, that tickles!',
  "I'm ready when you are!",
  'Seven is my favourite number.',
  'Maths is my superpower!',
  'Try the quiz, I dare you!',
];

const TIPS = [
  "Psst! Press Quiz me and I'll test you.",
  'Pick two numbers, then press Compare.',
  "Type a number and I'll write it on the board.",
  'Press Play lesson and just watch me go!',
];

export async function introduce(t: Teacher): Promise<void> {
  const man = t.man;
  man.x = -160;
  man.facing = 1;
  await t.walkTo(190);
  man.look = null;
  await Promise.all([
    t.gesture('wave', 2200),
    t.say(`Hello, my name is ${TEACHER_NAME}, and I'll be your teacher for today!`, 2600),
  ]);
  await t.say('Click a number on the board, or press Quiz me.', 1800);
}

let pokeIndex = 0;

export async function poked(t: Teacher): Promise<void> {
  const line = POKES[pokeIndex++ % POKES.length];
  t.man.look = null;
  t.sfx.tap();
  await Promise.all([t.hop(1), t.say(line, 1300)]);
}

export async function comment(t: Teacher, n: BoardNumber): Promise<void> {
  const man = t.man;
  const from = man.look;
  man.look = { x: n.x, y: n.y };
  const text = numberFact(n.value);
  await t.say(text, 1500, spoken(text));
  man.look = from;
}

let tipIndex = 0;

export const tipsLeft = (): boolean => tipIndex < TIPS.length;

export async function tip(t: Teacher): Promise<void> {
  const text = TIPS[tipIndex++];
  if (!text) return;
  t.man.look = null;
  await Promise.all([t.gesture('wave', 900), t.say(text, 1800)]);
}

export async function strollTo(t: Teacher, x: number): Promise<void> {
  t.man.look = null;
  await t.restArm();
  await t.walkTo(x);
}
