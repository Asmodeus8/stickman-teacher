export type EaseFn = (t: number) => number;

export const Ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
} satisfies Record<string, EaseFn>;

export class Cancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'Cancelled';
  }
}

interface Tween {
  ms: number;
  start: number | null;
  onUpdate: (t: number) => void;
  ease: EaseFn;
  resolve: () => void;
  reject: (e: Error) => void;
}

export class Animator {
  speed = 1;
  private tweens = new Set<Tween>();
  private blocked = false;

  tween(ms: number, onUpdate: (t: number) => void, ease: EaseFn = Ease.inOut): Promise<void> {
    if (this.blocked) return Promise.reject(new Cancelled());
    return new Promise((resolve, reject) => {
      this.tweens.add({ ms: Math.max(1, ms / this.speed), start: null, onUpdate, ease, resolve, reject });
    });
  }

  wait(ms: number): Promise<void> {
    return this.tween(ms, () => {}, Ease.linear);
  }

  update(now: number): void {
    for (const t of this.tweens) {
      if (t.start === null) t.start = now;
      const p = Math.min(1, (now - t.start) / t.ms);
      t.onUpdate(t.ease(p));
      if (p >= 1) {
        this.tweens.delete(t);
        t.resolve();
      }
    }
  }

  cancelAll(): void {
    this.blocked = true;
    for (const t of this.tweens) t.reject(new Cancelled());
    this.tweens.clear();
  }

  unblock(): void {
    this.blocked = false;
  }

  get active(): number {
    return this.tweens.size;
  }
}
