import { isRedirect } from '@tanstack/react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSetupStore } from '../store/setup.ts';
import { testQueryClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { requireSession } from './guards.ts';

async function redirectOf(promise: Promise<unknown>) {
  const thrown = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  if (!isRedirect(thrown)) throw new Error('expected a redirect');
  return thrown.options;
}

beforeEach(() => useSetupStore.getState().reset());

describe('requireSession while setup is unfinished', () => {
  it('sends the admin back to the step they were on, not to the start', async () => {
    mockApi.reset('wizard');
    useSetupStore.getState().update({ lastStep: 5 });
    const target = await redirectOf(requireSession(testQueryClient(), '/settings/appearance'));
    expect(target).toMatchObject({ to: '/setup', search: { step: 5 } });
  });

  it('starts at the import step when no step is remembered', async () => {
    mockApi.reset('wizard');
    const target = await redirectOf(requireSession(testQueryClient(), '/settings/appearance'));
    expect(target).toMatchObject({ to: '/setup', search: { step: 2 } });
  });

  it('lets everyone in once setup is finished', async () => {
    useSetupStore.getState().update({ lastStep: 5 });
    const me = await requireSession(testQueryClient(), '/settings/appearance');
    expect(me.user).toBeTruthy();
  });
});
