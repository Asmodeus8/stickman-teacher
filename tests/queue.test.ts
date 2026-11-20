import { describe, expect, it, vi } from 'vitest';
import { Animator } from '../src/core/animator';
import { ActionQueue } from '../src/core/queue';

const flush = () => new Promise(r => setTimeout(r, 0));

function setup() {
  const anim = new Animator();
  const recover = vi.fn(async () => anim.unblock());
  const queue = new ActionQueue({
    onChange: () => {},
    cancelCurrent: () => anim.cancelAll(),
    recover,
  });
  return { anim, queue, recover };
}

describe('ActionQueue', () => {
  it('runs jobs one after another, in order', async () => {
    const { queue } = setup();
    const order: string[] = [];
    let release!: () => void;
    queue.add('a', () => new Promise<void>(r => { order.push('a start'); release = () => { order.push('a end'); r(); }; }));
    queue.add('b', async () => { order.push('b'); });
    await flush();
    expect(queue.current?.label).toBe('a');
    expect(queue.pending.map(j => j.label)).toEqual(['b']);
    release();
    await flush();
    expect(order).toEqual(['a start', 'a end', 'b']);
    expect(queue.busy).toBe(false);
  });

  it('stop() drops queued jobs and cancels the running one, then recovers', async () => {
    const { anim, queue, recover } = setup();
    const ran: string[] = [];
    queue.add('long', async () => {
      await anim.wait(10_000);
      ran.push('long finished');
    });
    queue.add('next', async () => { ran.push('next'); });
    await flush();
    anim.update(0);
    queue.stop();
    await flush();
    expect(recover).toHaveBeenCalledOnce();
    expect(ran).toEqual([]);
    expect(queue.busy).toBe(false);
    expect(queue.pending).toHaveLength(0);
  });

  it('keeps going after a job throws a real error', async () => {
    const anim = new Animator();
    const onError = vi.fn();
    const queue = new ActionQueue({ onChange: () => {}, cancelCurrent: () => anim.cancelAll(), recover: async () => {}, onError });
    const ran: string[] = [];
    queue.add('broken', async () => { throw new Error('boom'); });
    queue.add('fine', async () => { ran.push('fine'); });
    await flush();
    await flush();
    expect(onError).toHaveBeenCalledOnce();
    expect(ran).toEqual(['fine']);
  });
});
