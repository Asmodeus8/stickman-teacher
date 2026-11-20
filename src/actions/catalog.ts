import { freeSlots, pickSlots, pickValues, readingOrder, type BoardNumber } from '../scene/layout';
import type { Teacher } from './teacher';

export type Group = 'selected' | 'board' | 'class';

export interface ActionDef {
  id: string;
  label: string;
  group: Group;
  key?: string;
  needs?: 1 | 2;
  mutates?: boolean;
  status: (sel: BoardNumber[]) => string;
  run: (t: Teacher, sel: BoardNumber[]) => Promise<void>;
}

const names = (sel: BoardNumber[]) => sel.map(n => n.value).join(', ');

async function point(t: Teacher, n: BoardNumber, speak: boolean): Promise<void> {
  await t.pointTo(n);
  await t.tap(t.pointSpot(n));
  if (speak) await t.say(`That's ${n.value}!`);
  else {
    t.setBubble(String(n.value));
    await t.anim.wait(500);
  }
}

export async function circle(t: Teacher, n: BoardNumber, color?: string): Promise<void> {
  await t.approach(n);
  const rx = n.w / 2 + 24;
  const ry = n.h / 2 + 18;
  const a0 = t.man.facing > 0 ? Math.PI * 0.85 : Math.PI * 0.15;
  const dir = t.man.facing;
  await t.chalkPath(p => {
    const a = a0 + dir * p * Math.PI * 2.12;
    const wobble = 1 + Math.sin(a * 3) * 0.035;
    return { x: n.x + Math.cos(a) * rx * wobble, y: n.y + Math.sin(a) * ry * wobble };
  }, 1100, color);
}

async function underline(t: Teacher, n: BoardNumber): Promise<void> {
  await t.approach(n);
  const y = n.y + n.h / 2 + 12;
  const x1 = n.x - n.w / 2 - 10;
  const x2 = n.x + n.w / 2 + 10;
  const [from, to] = t.man.facing > 0 ? [x1, x2] : [x2, x1];
  await t.chalkPath(p => ({ x: from + (to - from) * p, y: y + Math.sin(p * Math.PI) * 3 }), 550);
  await t.chalkPath(p => ({ x: from + 6 + (to - from - 12) * p, y: y + 9 + Math.sin(p * Math.PI) * 2 }), 450);
}

export async function tick(t: Teacher, n: BoardNumber): Promise<void> {
  await t.approach(n);
  const x = n.x + n.w / 2 + 16;
  const y = n.y + 4;
  await t.chalkPath(p => (p < 0.3
    ? { x: x + 14 * (p / 0.3), y: y + 18 * (p / 0.3) }
    : { x: x + 14 + 30 * ((p - 0.3) / 0.7), y: y + 18 - 48 * ((p - 0.3) / 0.7) }), 520);
}

async function cross(t: Teacher, n: BoardNumber): Promise<void> {
  await t.approach(n);
  const hw = n.w / 2 + 12;
  const hh = n.h / 2 + 6;
  await t.chalkPath(p => ({ x: n.x - hw + 2 * hw * p, y: n.y - hh + 2 * hh * p }), 380);
  await t.chalkPath(p => ({ x: n.x + hw - 2 * hw * p, y: n.y - hh + 2 * hh * p }), 380);
}

function forEach(mark: (t: Teacher, n: BoardNumber) => Promise<void>, one: (n: BoardNumber) => string, many: (sel: BoardNumber[]) => string) {
  return async (t: Teacher, sel: BoardNumber[]) => {
    const list = readingOrder(sel.filter(n => t.board.numbers.includes(n)));
    for (const n of list) await mark(t, n);
    await t.restArm();
    if (list.length) await t.say(list.length === 1 ? one(list[0]) : many(list), 1000);
    t.man.look = null;
  };
}

async function findExtreme(t: Teacher, kind: 'max' | 'min'): Promise<void> {
  if (!t.board.numbers.length) return t.shrug('The board is empty!');
  await t.scanBoard();
  const pick = t.board.numbers.reduce((best, n) => ((kind === 'max' ? n.value > best.value : n.value < best.value) ? n : best));
  await circle(t, pick, '#ffe680');
  await t.restArm();
  await t.cheer(`${pick.value} is the ${kind === 'max' ? 'biggest' : 'smallest'}!`);
  t.man.look = null;
}

export const ACTIONS: ActionDef[] = [
  {
    id: 'point', label: 'Point', group: 'selected', key: 'p', needs: 1,
    status: sel => `Pointing at ${names(sel)}`,
    run: async (t, sel) => {
      const list = readingOrder(sel.filter(n => t.board.numbers.includes(n)));
      for (const n of list) await point(t, n, list.length === 1);
      await t.hideBubble();
      await t.restArm();
      t.man.look = null;
    },
  },
  {
    id: 'circle', label: 'Circle', group: 'selected', key: 'c', needs: 1, mutates: true,
    status: sel => `Circling ${names(sel)}`,
    run: forEach((t, n) => circle(t, n), n => `Circled ${n.value}`, sel => `Circled ${sel.length} numbers`),
  },
  {
    id: 'underline', label: 'Underline', group: 'selected', key: 'u', needs: 1, mutates: true,
    status: sel => `Underlining ${names(sel)}`,
    run: forEach(underline, n => `${n.value}, underlined`, sel => `Underlined ${sel.length}`),
  },
  {
    id: 'tick', label: 'Tick', group: 'selected', key: 't', needs: 1, mutates: true,
    status: sel => `Ticking ${names(sel)}`,
    run: forEach(tick, () => 'Correct!', () => 'All correct!'),
  },
  {
    id: 'cross', label: 'Cross out', group: 'selected', key: 'x', needs: 1, mutates: true,
    status: sel => `Crossing out ${names(sel)}`,
    run: forEach(cross, n => `No ${n.value}!`, () => 'Crossed out'),
  },
  {
    id: 'compare', label: 'Compare', group: 'selected', key: 'o', needs: 2, mutates: true,
    status: sel => `Comparing ${names(sel.slice(0, 2))}`,
    run: async (t, sel) => {
      const [a, b] = sel;
      await point(t, a, false);
      await point(t, b, false);
      await t.hideBubble();
      const sign = a.value > b.value ? '>' : a.value < b.value ? '<' : '=';
      await t.writeEquation(`${a.value} ${sign} ${b.value}`);
      const word = sign === '>' ? 'is bigger than' : sign === '<' ? 'is smaller than' : 'is equal to';
      await t.say(`${a.value} ${word} ${b.value}`);
    },
  },
  {
    id: 'addSelected', label: 'Add these', group: 'selected', key: 's', needs: 2, mutates: true,
    status: sel => `Adding ${names(sel)}`,
    run: async (t, sel) => {
      const list = sel.filter(n => t.board.numbers.includes(n));
      let total = 0;
      for (const n of list) {
        await t.pointTo(n);
        const before = total;
        total += n.value;
        t.setBubble(before ? `${before} + ${n.value} = ${total}` : String(n.value), before ? `plus ${n.value}, ${total}` : String(n.value));
        await t.anim.wait(700);
      }
      await t.hideBubble();
      await t.writeEquation(`${list.map(n => n.value).join(' + ')} = ${total}`);
      await t.say(`That makes ${total}!`);
    },
  },

  {
    id: 'readAll', label: 'Read all', group: 'board', key: 'r',
    status: () => 'Reading every number',
    run: async t => {
      for (const n of readingOrder(t.board.numbers)) {
        await t.pointTo(n);
        t.setBubble(String(n.value));
        await t.anim.wait(550);
      }
      await t.hideBubble();
      await t.restArm();
      t.man.look = null;
    },
  },
  {
    id: 'addUp', label: 'Add up', group: 'board', key: 'a', mutates: true,
    status: () => 'Adding everything up',
    run: async t => {
      let total = 0;
      for (const n of readingOrder(t.board.numbers)) {
        await t.pointTo(n);
        const before = total;
        total += n.value;
        t.setBubble(before ? `${before} + ${n.value} = ${total}` : String(n.value), before ? String(total) : String(n.value));
        await t.anim.wait(650);
      }
      await t.hideBubble();
      await t.writeEquation(`Total = ${total}`);
      await t.cheer(`They add up to ${total}!`);
    },
  },
  {
    id: 'biggest', label: 'Biggest', group: 'board', key: 'b', mutates: true,
    status: () => 'Finding the biggest',
    run: t => findExtreme(t, 'max'),
  },
  {
    id: 'smallest', label: 'Smallest', group: 'board', key: 'm', mutates: true,
    status: () => 'Finding the smallest',
    run: t => findExtreme(t, 'min'),
  },
  {
    id: 'evens', label: 'Evens', group: 'board', key: 'v', mutates: true,
    status: () => 'Circling even numbers',
    run: async t => {
      const evens = readingOrder(t.board.numbers.filter(n => n.value % 2 === 0));
      if (!evens.length) return t.shrug('No even numbers here!');
      for (const n of evens) await circle(t, n, '#8fd3ff');
      await t.restArm();
      await t.say(`${evens.length} even number${evens.length > 1 ? 's' : ''}`, 1200);
      t.man.look = null;
    },
  },
  {
    id: 'sort', label: 'Sort', group: 'board', key: 'g', mutates: true,
    status: () => 'Sorting smallest to biggest',
    run: async t => {
      const values = t.board.numbers.map(n => n.value).sort((a, b) => a - b);
      if (values.length < 2) return t.shrug('Nothing to sort!');
      await t.say('Smallest to biggest!', 900);
      await t.sweepBoard(true);
      await t.writeNumbers(values, values.map((_, i) => i));
      await t.cheer('Sorted!');
    },
  },

  {
    id: 'quiz', label: 'Quiz me', group: 'class', key: 'q',
    status: () => 'Quiz time',
    run: async () => {},
  },
  {
    id: 'clean', label: 'Clean', group: 'class', key: 'e', mutates: true,
    status: () => 'Cleaning the board',
    run: async t => {
      await t.sweepBoard(false);
      t.man.look = null;
    },
  },
  {
    id: 'newNumbers', label: 'New numbers', group: 'class', key: 'n', mutates: true,
    status: () => 'Writing new numbers',
    run: async t => {
      await t.sweepBoard(true);
      await t.writeNumbers(pickValues(8), pickSlots(8));
      await t.say('Fresh numbers!', 1000);
    },
  },
  {
    id: 'lesson', label: 'Play lesson', group: 'class', key: 'l', mutates: true,
    status: () => 'Teaching a lesson',
    run: async t => {
      await t.say("Class, let's look at these numbers.", 1500);
      await ACTIONS_BY_ID.readAll.run(t, []);
      await ACTIONS_BY_ID.biggest.run(t, []);
      await ACTIONS_BY_ID.smallest.run(t, []);
      await t.say('Now the even ones.', 1000);
      await ACTIONS_BY_ID.evens.run(t, []);
      await ACTIONS_BY_ID.addUp.run(t, []);
      await t.say('Class dismissed!', 1200);
    },
  },
  {
    id: 'wave', label: 'Wave', group: 'class', key: 'w',
    status: () => 'Saying hi',
    run: async t => {
      t.man.look = null;
      await Promise.all([t.gesture('wave', 1200), t.say('Hi there!', 1300)]);
    },
  },
];

export const ACTIONS_BY_ID = Object.fromEntries(ACTIONS.map(a => [a.id, a])) as Record<string, ActionDef>;

export async function writeValue(t: Teacher, value: number): Promise<void> {
  const free = freeSlots(t.board.numbers);
  if (!free.length) return t.shrug('The board is full!');
  const slot = free[Math.floor(Math.random() * free.length)];
  await t.writeNumbers([value], [slot]);
  await t.say(`I wrote ${value}`, 900);
  t.man.look = null;
}
