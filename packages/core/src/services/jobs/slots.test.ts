import { describe, expect, it } from 'vitest';
import { createJobSlots, DEFAULT_JOB_HANDLER_LIMIT } from './slots.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('job slots', () => {
  it('runs at most `limit` tasks at once and hands freed slots out in arrival order', async () => {
    const slots = createJobSlots(2);
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const started: number[] = [];
    const runs = gates.map((gate, i) =>
      slots.run(async () => {
        started.push(i);
        await gate.promise;
        return i;
      }),
    );
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    expect(slots.active()).toBe(2);
    expect(slots.waiting()).toBe(2);
    gates[1]!.resolve();
    await runs[1];
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    for (const gate of gates) gate.resolve();
    expect(await Promise.all(runs)).toEqual([0, 1, 2, 3]);
    expect(slots.active()).toBe(0);
    expect(slots.waiting()).toBe(0);
  });

  it('frees the slot when a task throws', async () => {
    const slots = createJobSlots(1);
    await expect(
      slots.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await slots.run(async () => 'next')).toBe('next');
    expect(slots.active()).toBe(0);
  });

  it('gives up a wait when the job is aborted, without taking a slot', async () => {
    const slots = createJobSlots(1);
    const gate = deferred();
    const holder = slots.run(() => gate.promise);
    const abort = new AbortController();
    let ran = false;
    const waiter = slots.run(async () => void (ran = true), abort.signal);
    expect(slots.waiting()).toBe(1);
    abort.abort(new Error('expired'));
    await expect(waiter).rejects.toThrow('expired');
    expect(slots.waiting()).toBe(0);
    gate.resolve();
    await holder;
    expect(ran).toBe(false);
    expect(slots.active()).toBe(0);
  });

  it('refuses a limit that is not a positive integer', () => {
    expect(() => createJobSlots(0)).toThrow(RangeError);
    expect(() => createJobSlots(1.5)).toThrow(RangeError);
    expect(createJobSlots().limit).toBe(DEFAULT_JOB_HANDLER_LIMIT);
  });
});
