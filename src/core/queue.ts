import { Cancelled } from './animator';

export interface Job {
  id: number;
  label: string;
  run: () => Promise<void>;
}

export interface QueueHooks {
  onChange: () => void;
  cancelCurrent: () => void;
  recover: () => Promise<void>;
  onError?: (e: unknown) => void;
}

export class ActionQueue {
  private jobs: Job[] = [];
  private nextId = 1;
  current: Job | null = null;

  constructor(private hooks: QueueHooks) {}

  add(label: string, run: () => Promise<void>): Job {
    const job = { id: this.nextId++, label, run };
    this.jobs.push(job);
    this.hooks.onChange();
    void this.pump();
    return job;
  }

  get pending(): readonly Job[] {
    return this.jobs;
  }

  get busy(): boolean {
    return this.current !== null;
  }

  stop(): void {
    this.jobs = [];
    if (this.current) this.hooks.cancelCurrent();
    this.hooks.onChange();
  }

  private async pump(): Promise<void> {
    if (this.current) return;
    const job = this.jobs.shift();
    if (!job) return;
    this.current = job;
    this.hooks.onChange();
    try {
      await job.run();
    } catch (e) {
      if (e instanceof Cancelled) await this.hooks.recover();
      else this.hooks.onError?.(e);
    } finally {
      this.current = null;
      this.hooks.onChange();
    }
    void this.pump();
  }
}
