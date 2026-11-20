import { readingOrder, shuffle, type BoardNumber } from '../scene/layout';

export type QuestionKind = 'biggest' | 'smallest' | 'even' | 'odd' | 'find' | 'closest' | 'compare';

export interface Question {
  kind: QuestionKind;
  prompt: string;
  spoken: string;
  hint: string;
  answers: BoardNumber[];
}

export const isCorrect = (q: Question, n: BoardNumber): boolean => q.answers.includes(n);

type Builder = (ns: BoardNumber[], rng: () => number) => Question | null;

const pick = <T>(arr: readonly T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

const BUILDERS: Record<QuestionKind, Builder> = {
  biggest: ns => {
    const max = Math.max(...ns.map(n => n.value));
    return {
      kind: 'biggest',
      prompt: 'Click the biggest number!',
      spoken: 'Which number is the biggest? Click it!',
      hint: 'Look at the tens digit first.',
      answers: ns.filter(n => n.value === max),
    };
  },
  smallest: ns => {
    const min = Math.min(...ns.map(n => n.value));
    return {
      kind: 'smallest',
      prompt: 'Click the smallest number!',
      spoken: 'Which number is the smallest? Click it!',
      hint: 'Find the one with the fewest tens.',
      answers: ns.filter(n => n.value === min),
    };
  },
  even: ns => {
    const answers = ns.filter(n => n.value % 2 === 0);
    if (!answers.length || answers.length === ns.length) return null;
    return {
      kind: 'even',
      prompt: 'Click an even number!',
      spoken: 'Can you click an even number?',
      hint: 'Even numbers end in 0, 2, 4, 6 or 8.',
      answers,
    };
  },
  odd: ns => {
    const answers = ns.filter(n => n.value % 2 === 1);
    if (!answers.length || answers.length === ns.length) return null;
    return {
      kind: 'odd',
      prompt: 'Click an odd number!',
      spoken: 'Can you click an odd number?',
      hint: 'Odd numbers end in 1, 3, 5, 7 or 9.',
      answers,
    };
  },
  find: (ns, rng) => {
    const target = pick(ns, rng);
    return {
      kind: 'find',
      prompt: `Find ${target.value}!`,
      spoken: `Can you find the number ${target.value}?`,
      hint: `It's on the ${target.slot < 5 ? 'top' : 'bottom'} row.`,
      answers: [target],
    };
  },
  closest: (ns, rng) => {
    const onBoard = new Set(ns.map(n => n.value));
    const targets = [10, 20, 30, 40, 50, 60, 70, 80, 90].filter(t => !onBoard.has(t));
    for (let tries = 0; tries < 6 && targets.length; tries++) {
      const t = pick(targets, rng);
      const best = Math.min(...ns.map(n => Math.abs(n.value - t)));
      const answers = ns.filter(n => Math.abs(n.value - t) === best);
      if (answers.length === 1) {
        return {
          kind: 'closest',
          prompt: `Which is closest to ${t}?`,
          spoken: `Which number is closest to ${t}?`,
          hint: `Count how far each one is from ${t}.`,
          answers,
        };
      }
    }
    return null;
  },
  compare: (ns, rng) => {
    if (ns.length < 2) return null;
    const a = pick(ns, rng);
    const others = ns.filter(n => n !== a && n.value !== a.value);
    if (!others.length) return null;
    const b = pick(others, rng);
    const [first, second] = readingOrder([a, b]);
    const bigger = a.value > b.value ? a : b;
    return {
      kind: 'compare',
      prompt: `Which is bigger: ${first.value} or ${second.value}?`,
      spoken: `Which is bigger, ${first.value} or ${second.value}?`,
      hint: 'Compare the tens digits first.',
      answers: [bigger],
    };
  },
};

export const QUESTION_KINDS = Object.keys(BUILDERS) as QuestionKind[];

export function makeQuestion(ns: readonly BoardNumber[], rng: () => number = Math.random, avoid?: QuestionKind): Question | null {
  if (!ns.length) return null;
  const list = [...ns];
  const kinds = QUESTION_KINDS.filter(k => k !== avoid);
  for (const kind of shuffle(kinds, rng)) {
    const q = BUILDERS[kind](list, rng);
    if (q && q.answers.length) return q;
  }
  return null;
}
