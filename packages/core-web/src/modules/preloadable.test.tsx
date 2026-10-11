import { act, cleanup, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { preloadable, useLoaded, type Preloadable } from './preloadable.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const Hello = ({ name }: { name: string }) => <p>Hello {name}</p>;

function Gate({ target }: { target: Preloadable<{ name: string }> }) {
  const ready = useLoaded(target);
  return (
    <Suspense fallback={<p>suspense fallback</p>}>
      {ready ? <target.Component name="Priya" /> : <p>placeholder</p>}
    </Suspense>
  );
}

describe('preloadable', () => {
  afterEach(cleanup);

  it('loads once and then renders without ever showing a Suspense fallback', async () => {
    const chunk = deferred<{ default: typeof Hello }>();
    let calls = 0;
    const target = preloadable(() => {
      calls += 1;
      return chunk.promise;
    });
    render(<Gate target={target} />);
    expect(screen.getByText('placeholder')).toBeTruthy();
    expect(target.loaded()).toBe(false);
    await act(async () => chunk.resolve({ default: Hello }));
    expect(screen.getByText('Hello Priya')).toBeTruthy();
    expect(screen.queryByText('suspense fallback')).toBeNull();
    await target.load();
    expect(calls).toBe(1);
    expect(target.loaded()).toBe(true);
  });

  it('renders at once when already loaded, and lets a failed load reach the error path', async () => {
    const target = preloadable(async () => ({ default: Hello }));
    await target.load();
    render(<Gate target={target} />);
    expect(screen.getByText('Hello Priya')).toBeTruthy();

    const failing = preloadable<{ name: string }>(() => Promise.reject(new Error('offline')));
    function Probe() {
      return <p>{useLoaded(failing) ? 'ready' : 'waiting'}</p>;
    }
    render(<Probe />);
    expect(screen.getByText('waiting')).toBeTruthy();
    await act(async () => {
      await failing.load().catch(() => undefined);
    });
    expect(screen.getByText('ready')).toBeTruthy();
    expect(failing.loaded()).toBe(false);
  });
});
