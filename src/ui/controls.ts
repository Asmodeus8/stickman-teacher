import { ACTIONS, writeValue, type ActionDef, type Group } from '../actions/catalog';
import { comment, introduce, poked, strollTo, tip, tipsLeft } from '../actions/personality';
import type { Teacher } from '../actions/teacher';
import type { ActionQueue } from '../core/queue';
import type { Vec } from '../core/math';
import type { BoardSnapshot } from '../scene/board';
import { CHALK_COLORS } from '../scene/chalk';
import { FLOOR_Y, H, W, hitTest, type BoardNumber } from '../scene/layout';
import { QuizSession } from '../quiz/session';

const GROUP_TITLES: Record<Group, string> = {
  selected: 'Selected numbers',
  board: 'Whole board',
  class: 'Class',
};

const HISTORY_LIMIT = 20;
const IDLE_TIP_MS = 18000;

export class Controls {
  selection: BoardNumber[] = [];
  hover: BoardNumber | null = null;
  pointer: Vec | null = null;
  started = false;
  readonly quiz: QuizSession;
  private history: BoardSnapshot[] = [];
  private lastInteraction = performance.now();
  private chalk: string = CHALK_COLORS[0].value;

  private el = {
    status: byId('status'),
    statusText: byId('status-text'),
    queued: byId('queued'),
    selected: byId('selected-value'),
    selectedChip: byId('selected-chip'),
    stop: byId<HTMLButtonElement>('stop'),
    undo: byId<HTMLButtonElement>('undo'),
    sound: byId<HTMLButtonElement>('sound'),
    speed: byId<HTMLInputElement>('speed'),
    speedLabel: byId('speed-label'),
    writeForm: byId<HTMLFormElement>('write-form'),
    writeInput: byId<HTMLInputElement>('write-input'),
    groups: byId('action-groups'),
    swatches: byId('swatches'),
    overlay: byId('start-overlay'),
    startBtn: byId<HTMLButtonElement>('start-class'),
    quizBanner: byId('quiz-banner'),
    quizProgress: byId('quiz-progress'),
    quizPrompt: byId('quiz-prompt'),
    quizScore: byId('quiz-score'),
    quizEnd: byId<HTMLButtonElement>('quiz-end'),
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private teacher: Teacher,
    private queue: ActionQueue,
  ) {
    this.quiz = new QuizSession(teacher, () => this.refresh());
    this.buildButtons();
    this.buildSwatches();
    this.bindCanvas();
    this.bindKeys();
    this.bindSettings();
    this.bindStart();
    this.refresh();
    window.setInterval(() => this.idleCheck(), 1000);
  }

  private bindStart(): void {
    this.el.startBtn.addEventListener('click', () => {
      this.teacher.sfx.unlock();
      this.started = true;
      this.el.overlay.classList.add('is-hidden');
      this.touch();
      this.queue.add('Introducing himself', () => introduce(this.teacher));
      this.el.startBtn.blur();
    });
    this.el.quizEnd.addEventListener('click', () => this.stopAll());
  }

  private touch(): void {
    this.lastInteraction = performance.now();
  }

  private get idle(): boolean {
    return !this.queue.busy && this.queue.pending.length === 0;
  }

  private idleCheck(): void {
    if (!this.started || !this.idle || this.quiz.active || !tipsLeft()) return;
    if (performance.now() - this.lastInteraction < IDLE_TIP_MS) return;
    this.touch();
    this.queue.add('Giving a tip', () => tip(this.teacher));
  }

  stopAll(): void {
    this.quiz.end();
    this.queue.stop();
  }

  private startQuiz(): void {
    this.selection = [];
    this.queue.add('Quiz time', async () => {
      this.remember();
      await this.quiz.begin();
    });
  }

  run(def: ActionDef): void {
    if (!this.started) return;
    this.touch();
    if (def.id === 'quiz') {
      if (!this.quiz.active) this.startQuiz();
      return;
    }
    if (this.quiz.active) this.quiz.end();
    const sel = [...this.selection];
    if (def.needs && sel.length < def.needs) {
      const msg = def.needs === 2 ? 'Pick two numbers first!' : 'Click a number first!';
      this.queue.add('Waiting for a selection', () => this.teacher.shrug(msg));
      this.flashSelection();
      return;
    }
    this.queue.add(def.status(sel), async () => {
      this.teacher.man.penColor = this.chalk;
      if (def.mutates) this.remember();
      await def.run(this.teacher, sel);
    });
  }

  private write(value: number): void {
    if (!this.started) return;
    this.touch();
    if (this.quiz.active) this.quiz.end();
    this.queue.add(`Writing ${value}`, async () => {
      this.remember();
      await writeValue(this.teacher, value);
    });
  }

  private remember(): void {
    this.history.push(this.teacher.board.snapshot());
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  undo(): void {
    if (this.queue.busy) return;
    const snap = this.history.pop();
    if (!snap) return;
    this.teacher.board.restore(snap);
    this.selection = [];
    this.refresh();
  }

  refresh(): void {
    const board = this.teacher.board;
    this.selection = this.selection.filter(n => board.numbers.includes(n));
    const busy = this.queue.busy;
    const current = this.queue.current;
    const pending = this.queue.pending.length;

    this.el.statusText.textContent = current ? current.label : 'Ready';
    this.el.status.classList.toggle('is-busy', busy);
    this.el.queued.textContent = pending ? `+${pending} queued` : '';
    this.el.queued.hidden = !pending;
    this.el.stop.disabled = !busy && !pending;
    this.el.undo.disabled = busy || !this.history.length;

    this.el.selected.textContent = this.selection.length ? this.selection.map(n => n.value).join(', ') : '–';
    this.el.selectedChip.classList.toggle('has-value', this.selection.length > 0);
    for (const btn of this.el.groups.querySelectorAll<HTMLButtonElement>('[data-needs]')) {
      btn.classList.toggle('is-ready', this.selection.length >= Number(btn.dataset.needs));
    }

    const quiz = this.quiz;
    this.el.quizBanner.hidden = !quiz.active;
    if (quiz.active) {
      this.el.quizProgress.textContent = quiz.round ? `Question ${quiz.round} of ${quiz.total}` : 'Quiz';
      this.el.quizPrompt.textContent = quiz.question ? quiz.question.prompt : 'Get ready…';
      this.el.quizScore.textContent = `★ ${quiz.score}`;
      this.el.quizBanner.classList.toggle('is-waiting', quiz.awaiting);
    }
  }

  private buildButtons(): void {
    const groups = new Map<Group, HTMLElement>();
    for (const def of ACTIONS) {
      let list = groups.get(def.group);
      if (!list) {
        const card = document.createElement('section');
        card.className = 'group';
        card.innerHTML = `<h2>${GROUP_TITLES[def.group]}</h2><div class="buttons"></div>`;
        this.el.groups.append(card);
        list = card.querySelector<HTMLElement>('.buttons')!;
        groups.set(def.group, list);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = def.label;
      if (def.needs) btn.dataset.needs = String(def.needs);
      if (def.key) {
        const kbd = document.createElement('kbd');
        kbd.textContent = def.key.toUpperCase();
        btn.append(kbd);
        btn.setAttribute('aria-keyshortcuts', def.key.toUpperCase());
      }
      btn.addEventListener('click', () => this.run(def));
      list.append(btn);
    }
  }

  private buildSwatches(): void {
    for (const [i, col] of CHALK_COLORS.entries()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.setProperty('--c', col.swatch);
      b.setAttribute('aria-label', `${col.name} chalk`);
      b.setAttribute('aria-pressed', String(i === 0));
      b.addEventListener('click', () => {
        this.chalk = col.value;
        if (!this.queue.busy) this.teacher.man.penColor = col.value;
        for (const s of this.el.swatches.children) s.setAttribute('aria-pressed', String(s === b));
      });
      this.el.swatches.append(b);
    }
  }

  private toWorld(e: PointerEvent | MouseEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  private bindCanvas(): void {
    this.canvas.addEventListener('pointermove', e => {
      const p = this.toWorld(e);
      this.pointer = p;
      this.hover = hitTest(this.teacher.board.numbers, p) ?? null;
      const onMan = this.teacher.man.contains(p);
      const onFloor = p.y > FLOOR_Y + 8;
      this.canvas.style.cursor = this.started && (this.hover || onMan || onFloor) ? 'pointer' : 'default';
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.hover = null;
      this.pointer = null;
    });
    this.canvas.addEventListener('click', e => this.handleClick(this.toWorld(e)));
  }

  private handleClick(p: Vec): void {
    if (!this.started) return;
    this.touch();
    const t = this.teacher;
    const n = hitTest(t.board.numbers, p);

    if (this.quiz.active) {
      if (n && this.quiz.awaiting) this.queue.add(`Checking ${n.value}`, () => this.quiz.answer(n));
      return;
    }
    if (!n && t.man.contains(p)) {
      if (this.idle) this.queue.add('Chatting', () => poked(t));
      return;
    }
    if (!n && p.y > FLOOR_Y + 8) {
      this.selection = [];
      this.refresh();
      this.queue.add('Walking over', () => strollTo(t, p.x));
      return;
    }
    if (!n) {
      this.selection = [];
    } else if (this.selection.includes(n)) {
      this.selection = this.selection.filter(s => s !== n);
    } else {
      this.selection = [...this.selection, n];
      if (this.idle) this.queue.add(`Looking at ${n.value}`, () => comment(t, n));
    }
    this.refresh();
  }

  private bindKeys(): void {
    window.addEventListener('keydown', e => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        this.stopAll();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const def = ACTIONS.find(a => a.key === e.key.toLowerCase());
      if (def) this.run(def);
    });
  }

  private bindSettings(): void {
    this.el.stop.addEventListener('click', () => this.stopAll());
    this.el.undo.addEventListener('click', () => this.undo());

    this.el.sound.addEventListener('click', () => {
      const on = this.el.sound.getAttribute('aria-pressed') !== 'true';
      this.el.sound.setAttribute('aria-pressed', String(on));
      this.teacher.sfx.setEnabled(on);
      this.teacher.voice.enabled = on;
      if (!on) this.teacher.voice.stop();
    });

    this.el.speed.addEventListener('input', () => {
      const v = Number(this.el.speed.value);
      this.teacher.anim.speed = v;
      this.teacher.voice.rate = v;
      this.el.speedLabel.textContent = `${v}×`;
    });

    this.el.writeForm.addEventListener('submit', e => {
      e.preventDefault();
      const v = Number(this.el.writeInput.value);
      if (!this.el.writeInput.value || !Number.isInteger(v) || v < 0 || v > 999) {
        this.el.writeInput.focus();
        this.el.writeInput.select();
        return;
      }
      this.write(v);
      this.el.writeInput.value = '';
    });
  }

  private flashSelection(): void {
    this.el.selectedChip.classList.remove('flash');
    void this.el.selectedChip.offsetWidth;
    this.el.selectedChip.classList.add('flash');
  }
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
}
