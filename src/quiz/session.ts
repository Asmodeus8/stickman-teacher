import { circle, tick } from '../actions/catalog';
import type { Teacher } from '../actions/teacher';
import { INNER, type BoardNumber } from '../scene/layout';
import { isCorrect, makeQuestion, type Question } from './questions';

const PRAISE = ['Yes! Well done!', 'Brilliant!', "That's right!", 'Spot on!', 'You got it!'];

export class QuizSession {
  readonly total = 5;
  active = false;
  awaiting = false;
  round = 0;
  score = 0;
  question: Question | null = null;
  private attempts = 0;

  constructor(private t: Teacher, private onChange: () => void) {}

  async begin(): Promise<void> {
    this.active = true;
    this.round = 0;
    this.score = 0;
    this.question = null;
    this.onChange();
    if (this.t.board.equation) await this.t.sweepBoard(false);
    await this.t.say("Quiz time! I'll ask, you click the answer on the board.", 1800);
    await this.ask();
  }

  async answer(n: BoardNumber): Promise<void> {
    const q = this.question;
    if (!q || !this.awaiting) return;
    this.awaiting = false;
    this.onChange();
    const t = this.t;
    await t.hideBubble();
    await t.pointTo(n);

    if (isCorrect(q, n)) {
      this.score++;
      this.onChange();
      await tick(t, n);
      await t.restArm();
      await t.cheer(PRAISE[(this.round + this.score) % PRAISE.length]);
      await this.next();
      return;
    }

    this.attempts++;
    if (this.attempts < 2) {
      await t.restArm();
      await t.say(`Not ${n.value}. ${q.hint}`, 1800);
      this.waitForAnswer('Try again!');
      return;
    }

    const right = q.answers[0];
    await t.restArm();
    await t.say(`Good try! It was ${right.value}.`, 1200);
    await circle(t, right, '#ffe680');
    await t.restArm();
    await this.next();
  }

  end(): void {
    this.active = false;
    this.awaiting = false;
    this.question = null;
    this.onChange();
  }

  private async ask(): Promise<void> {
    const t = this.t;
    const q = makeQuestion(t.board.numbers, Math.random, this.question?.kind);
    if (!q) {
      await t.shrug('I need numbers on the board first!');
      this.end();
      return;
    }
    this.round++;
    this.attempts = 0;
    this.question = q;
    this.onChange();
    await t.restArm();
    await t.walkTo(110);
    await t.turn(1);
    t.man.look = { x: INNER.x + INNER.w / 2, y: INNER.y + 200 };
    this.waitForAnswer(q.spoken);
  }

  private waitForAnswer(spokenLine: string): void {
    const q = this.question;
    if (!q) return;
    this.t.setBubble(q.prompt, spokenLine);
    this.awaiting = true;
    this.onChange();
  }

  private async next(): Promise<void> {
    if (this.round >= this.total) return this.finish();
    await this.ask();
  }

  private async finish(): Promise<void> {
    const t = this.t;
    this.awaiting = false;
    this.onChange();
    await t.writeEquation(`Score: ${this.score} / ${this.total}`);
    if (this.score >= 4) await t.cheer(`Amazing! ${this.score} out of ${this.total}!`);
    else if (this.score >= 2) await t.say(`Nice work, ${this.score} out of ${this.total}!`, 1500);
    else await t.say("Good effort! Let's practise and try again.", 1600);
    this.end();
  }
}
