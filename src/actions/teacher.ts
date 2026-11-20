import { REST_TIP, Stickman, type Facing, type Gesture } from '../actor/stickman';
import type { Sfx } from '../audio/sfx';
import type { Voice } from '../audio/voice';
import { Ease, type Animator } from '../core/animator';
import type { Layer } from '../core/layers';
import { clamp, lerp, type Vec } from '../core/math';
import type { Board } from '../scene/board';
import { CHALK_WHITE, EQUATION_FONT, NUMBER_FONT, prepareText, revealText } from '../scene/chalk';
import { EQUATION_Y, INNER, STAND_OFFSET, W, standSpot, type BoardNumber, type Rect } from '../scene/layout';

const WALK_STRIDE = 36;

export class Teacher {
  constructor(
    readonly man: Stickman,
    readonly board: Board,
    readonly anim: Animator,
    readonly voice: Voice,
    readonly sfx: Sfx,
  ) {}

  async turn(dir: Facing): Promise<void> {
    const man = this.man;
    if (man.facing === dir) return;
    const from = man.tip.dx;
    await this.anim.tween(240, t => {
      man.tip.dx = lerp(from, -from, t);
      if (t > 0.5) man.facing = dir;
    });
  }

  async walkTo(x: number): Promise<void> {
    const man = this.man;
    x = clamp(x, 60, W - 60);
    const distance = Math.abs(x - man.x);
    if (distance < 4) return;
    await this.turn(x > man.x ? 1 : -1);
    const x0 = man.x;
    const phase0 = man.walkPhase;
    man.walking = true;
    await this.anim.tween(250 + distance * 3.1, t => {
      man.x = lerp(x0, x, t);
      man.walkPhase = phase0 + Math.abs(man.x - x0) / WALK_STRIDE;
    });
    man.walking = false;
  }

  async moveTip(wx: number, wy: number, ms = 500): Promise<void> {
    const man = this.man;
    const fromDx = man.tip.dx;
    const fromY = man.tip.y;
    const toDx = wx - man.x;
    await this.anim.tween(ms, t => {
      man.tip.dx = lerp(fromDx, toDx, t);
      man.tip.y = lerp(fromY, wy, t);
    });
  }

  async restArm(ms = 450): Promise<void> {
    this.man.tool = 'stick';
    await this.moveTip(this.man.x + this.man.facing * REST_TIP.dx, REST_TIP.y, ms);
  }

  async approach(p: Vec): Promise<void> {
    await this.restArm();
    await this.walkTo(standSpot(p.x, this.man.x));
    await this.turn(p.x >= this.man.x ? 1 : -1);
    this.man.look = { x: p.x, y: p.y };
  }

  async gesture(kind: Gesture, holdMs: number): Promise<void> {
    const man = this.man;
    man.gesture = kind;
    await this.anim.tween(250, t => { man.gestureAmt = t; });
    await this.anim.wait(holdMs);
    await this.anim.tween(250, t => { man.gestureAmt = 1 - t; });
    man.gesture = 'none';
  }

  async hop(times = 2): Promise<void> {
    for (let i = 0; i < times; i++) {
      await this.anim.tween(380, t => { this.man.hop = Math.sin(t * Math.PI) * 26; }, Ease.linear);
    }
    this.man.hop = 0;
  }

  setBubble(text: string, spoken = text): void {
    const man = this.man;
    man.bubble.text = text;
    man.bubble.alpha = 1;
    man.talkUntil = performance.now() + Math.min(1400, 250 + text.length * 45) / this.anim.speed;
    this.voice.speak(spoken);
  }

  async say(text: string, holdMs = 1300, spoken = text): Promise<void> {
    const man = this.man;
    man.bubble.text = text;
    man.talkUntil = performance.now() + Math.min(holdMs, 250 + text.length * 45) / this.anim.speed;
    this.voice.speak(spoken);
    const a0 = man.bubble.alpha;
    await this.anim.tween(150, t => { man.bubble.alpha = lerp(a0, 1, t); });
    await this.anim.wait(holdMs);
    await this.hideBubble();
  }

  async hideBubble(): Promise<void> {
    const man = this.man;
    const a0 = man.bubble.alpha;
    if (a0 <= 0) return;
    await this.anim.tween(180, t => { man.bubble.alpha = lerp(a0, 0, t); });
  }

  async shrug(text: string): Promise<void> {
    this.man.look = null;
    await Promise.all([this.gesture('shrug', 1100), this.say(text, 1300)]);
  }

  async cheer(text: string, spoken = text): Promise<void> {
    this.sfx.chime();
    await Promise.all([this.gesture('cheer', 900), this.hop(2), this.say(text, 1300, spoken)]);
  }

  pointSpot(n: BoardNumber): Vec {
    return { x: n.x - this.man.facing * (n.w / 2 + 10), y: n.y + 26 };
  }

  async pointTo(n: BoardNumber): Promise<void> {
    await this.approach(n);
    const s = this.pointSpot(n);
    await this.moveTip(s.x, s.y, 520);
  }

  async tap(at: Vec): Promise<void> {
    for (let i = 0; i < 2; i++) {
      await this.moveTip(at.x - this.man.facing * 8, at.y + 6, 120);
      this.sfx.tap();
      await this.moveTip(at.x, at.y, 120);
    }
  }

  async chalkPath(fn: (t: number) => Vec, ms: number, color = this.man.penColor): Promise<void> {
    const man = this.man;
    man.tool = 'chalk';
    const start = fn(0);
    await this.moveTip(start.x, start.y, 380);
    const prev = man.penColor;
    man.penColor = color;
    man.penDown = true;
    try {
      await this.anim.tween(ms, t => {
        const pt = fn(t);
        man.tip.dx = pt.x - man.x;
        man.tip.y = pt.y;
      }, Ease.linear);
    } finally {
      man.penDown = false;
      man.penColor = prev;
    }
  }

  async writeText(text: string, x: number, y: number, target: Layer, font: string,
    opts: { align?: 'left' | 'center'; msPerPx?: number; color?: string } = {}): Promise<Rect> {
    const man = this.man;
    const prepared = prepareText(text, font, opts.color ?? man.penColor, x, y, opts.align ?? 'left');
    const left = prepared.rect.left + 12;
    const right = prepared.rect.right - 12;
    await this.restArm();
    await this.walkTo(left - STAND_OFFSET);
    await this.turn(1);
    man.look = { x: left, y };
    man.tool = 'chalk';
    await this.moveTip(left, y, 300);

    const x0 = man.x;
    const shuffle = Math.max(0, right - left - 60);
    const phase0 = man.walkPhase;
    const width = prepared.layer.w;
    man.walking = shuffle > 20;
    man.writing = true;
    try {
      await this.anim.tween(Math.max(450, width * (opts.msPerPx ?? 7)), t => {
        const tipX = lerp(left, right, t);
        man.x = x0 + shuffle * t;
        man.walkPhase = phase0 + (man.x - x0) / WALK_STRIDE;
        man.tip.dx = tipX - man.x;
        man.tip.y = y + Math.sin((t * width) / 7) * 10;
        revealText(prepared, target, tipX - prepared.rect.left + 16);
      }, Ease.linear);
      revealText(prepared, target, width);
    } finally {
      man.walking = false;
      man.writing = false;
    }
    return prepared.rect;
  }

  async eraseBand(r: Rect): Promise<void> {
    const man = this.man;
    await this.restArm();
    await this.walkTo(r.left - STAND_OFFSET + 10);
    await this.turn(1);
    man.tool = 'eraser';
    await this.moveTip(r.left + 10, r.top + 10, 300);
    man.eraseLayers = [this.board.marks];
    const x0 = man.x;
    const x1 = Math.max(x0, r.right - STAND_OFFSET - 10);
    const phase0 = man.walkPhase;
    const passes = Math.max(4, Math.round((r.right - r.left) / 40));
    man.walking = x1 - x0 > 20;
    try {
      await this.anim.tween(Math.max(700, (r.right - r.left) * 4), t => {
        man.x = lerp(x0, x1, t);
        man.walkPhase = phase0 + (man.x - x0) / WALK_STRIDE;
        man.tip.dx = lerp(r.left + 10, r.right - 10, t) - man.x;
        man.tip.y = lerp(r.top + 8, r.bottom - 8, 0.5 - 0.5 * Math.cos(t * Math.PI * passes));
      }, Ease.linear);
    } finally {
      man.eraseLayers = null;
      man.walking = false;
    }
    this.board.clearRect(this.board.marks, r);
    await this.restArm();
  }

  async writeEquation(text: string): Promise<void> {
    if (this.board.equation) {
      await this.eraseBand(this.board.equation);
      this.board.equation = null;
    }
    const rect = await this.writeText(text, W / 2, EQUATION_Y, this.board.marks, EQUATION_FONT, { align: 'center' });
    this.board.equation = rect;
    await this.restArm();
    await this.walkTo(rect.right + 70);
    await this.turn(-1);
    this.man.look = { x: (rect.left + rect.right) / 2, y: EQUATION_Y };
  }

  async sweepBoard(includeNumbers: boolean): Promise<void> {
    const man = this.man;
    const board = this.board;
    await this.restArm();
    await this.walkTo(70);
    await this.turn(1);
    man.tool = 'eraser';
    const top = INNER.y + 50;
    const bottom = INNER.y + INNER.h - 30;
    await this.moveTip(man.x + STAND_OFFSET, top, 350);
    man.eraseLayers = includeNumbers ? [board.marks, board.ink] : [board.marks];
    const x0 = man.x;
    const x1 = INNER.x + INNER.w - STAND_OFFSET;
    const phase0 = man.walkPhase;
    man.walking = true;
    try {
      await this.anim.tween(3400, t => {
        man.x = lerp(x0, x1, t);
        man.walkPhase = phase0 + (man.x - x0) / WALK_STRIDE;
        man.tip.dx = STAND_OFFSET;
        man.tip.y = lerp(top, bottom, 0.5 - 0.5 * Math.cos(t * Math.PI * 22));
      }, Ease.linear);
    } finally {
      man.walking = false;
      man.eraseLayers = null;
    }
    board.wipe(includeNumbers);
    await this.restArm();
  }

  async writeNumbers(values: number[], slots: number[]): Promise<void> {
    for (let i = 0; i < values.length; i++) {
      const n = this.board.place(values[i], slots[i]);
      await this.writeText(String(n.value), n.x, n.y, this.board.ink, NUMBER_FONT,
        { align: 'center', msPerPx: 9, color: CHALK_WHITE });
      this.board.numbers.push(n);
    }
    await this.restArm();
  }

  async scanBoard(): Promise<void> {
    const man = this.man;
    await this.restArm();
    await this.walkTo(W / 2 - 40);
    await this.turn(1);
    this.setBubble('Hmm...', 'Hmm');
    await this.anim.tween(1100, t => {
      man.look = { x: lerp(INNER.x, INNER.x + INNER.w, t), y: INNER.y + 160 + Math.sin(t * Math.PI * 2) * 60 };
    });
    await this.hideBubble();
  }

  async recover(): Promise<void> {
    const man = this.man;
    this.anim.unblock();
    this.voice.stop();
    this.sfx.silence();
    man.penDown = false;
    man.writing = false;
    man.eraseLayers = null;
    man.walking = false;
    man.hop = 0;
    man.look = null;
    const g0 = man.gestureAmt;
    const a0 = man.bubble.alpha;
    await this.anim.tween(250, t => {
      man.gestureAmt = g0 * (1 - t);
      man.bubble.alpha = a0 * (1 - t);
    });
    man.gesture = 'none';
    await this.restArm(300);
  }
}
