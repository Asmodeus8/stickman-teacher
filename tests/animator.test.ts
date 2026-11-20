import { describe, expect, it } from 'vitest';
import { Animator, Cancelled, Ease } from '../src/core/animator';

describe('Animator', () => {
  it('drives progress from 0 to 1 and resolves when done', async () => {
    const anim = new Animator();
    const seen: number[] = [];
    let done = false;
    const p = anim.tween(100, t => seen.push(t), Ease.linear).then(() => { done = true; });
    anim.update(1000);
    anim.update(1050);
    anim.update(1100);
    await p;
    expect(seen).toEqual([0, 0.5, 1]);
    expect(done).toBe(true);
    expect(anim.active).toBe(0);
  });

  it('runs faster when speed is raised', async () => {
    const anim = new Animator();
    anim.speed = 2;
    const seen: number[] = [];
    const p = anim.tween(100, t => seen.push(t), Ease.linear);
    anim.update(0);
    anim.update(50);
    await p;
    expect(seen.at(-1)).toBe(1);
  });

  it('cancelAll rejects running tweens and blocks new ones until unblocked', async () => {
    const anim = new Animator();
    const running = anim.tween(1000, () => {});
    anim.update(0);
    anim.cancelAll();
    await expect(running).rejects.toBeInstanceOf(Cancelled);
    await expect(anim.wait(10)).rejects.toBeInstanceOf(Cancelled);
    anim.unblock();
    const after = anim.wait(10);
    anim.update(0);
    anim.update(20);
    await expect(after).resolves.toBeUndefined();
  });

  it('unwinds a whole async script when cancelled mid-way', async () => {
    const anim = new Animator();
    const steps: string[] = [];
    const script = (async () => {
      await anim.wait(10);
      steps.push('first');
      await anim.wait(1000);
      steps.push('second');
    })();
    anim.update(0);
    anim.update(20);
    await Promise.resolve();
    await Promise.resolve();
    anim.update(30);
    anim.cancelAll();
    await expect(script).rejects.toBeInstanceOf(Cancelled);
    expect(steps).toEqual(['first']);
  });
});
