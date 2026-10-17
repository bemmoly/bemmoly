import { isRedirect } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSetupStore } from '../store/setup.ts';
import { testQueryClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { isProductPath, leaveFor, requireSession } from './guards.ts';

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
    expect(target).toMatchObject({ to: '/setup', search: { step: 5, welcome: true } });
  });

  it('starts at the import step when no step is remembered', async () => {
    mockApi.reset('wizard');
    const target = await redirectOf(requireSession(testQueryClient(), '/settings/appearance'));
    expect(target).toMatchObject({ to: '/setup', search: { step: 3 } });
  });

  it('lets an admin who skipped setup in, and Home lists what is left', async () => {
    mockApi.reset('wizard');
    useSetupStore.getState().update({ setupSkipped: true });
    const me = await requireSession(testQueryClient(), '/');
    expect(me.user.email).toBe('rohan@acmelabs.dev');
  });

  it('lets everyone in once setup is finished', async () => {
    useSetupStore.getState().update({ lastStep: 5 });
    const me = await requireSession(testQueryClient(), '/settings/appearance');
    expect(me.user).toBeTruthy();
  });
});

describe('product paths', () => {
  it('loads another product’s app for its paths and routes everything else in place', () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
    const navigate = vi.fn();
    leaveFor('/pipelines/catalog?tier=0', navigate);
    expect(assign).toHaveBeenCalledWith('/pipelines/catalog?tier=0');
    expect(navigate).not.toHaveBeenCalled();
    leaveFor('/work/board', navigate);
    expect(navigate).toHaveBeenCalledWith('/work/board');
    leaveFor('//evil.example/pipelines', navigate);
    expect(navigate).toHaveBeenLastCalledWith('/');
    expect(isProductPath('/pipelinesx')).toBe(false);
    assign.mockRestore();
  });
});
