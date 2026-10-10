import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSetupStore } from '../store/setup.ts';
import { renderPage, testQueryClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  canSkip,
  LAST_STEP,
  railItems,
  resolveStep,
  resumeStep,
  SETUP_STEPS,
  stepDef,
  useSetupWizard,
} from './use-setup-wizard.ts';

beforeEach(() => useSetupStore.getState().reset());

describe('wizard steps', () => {
  it('labels each step as the mock does', () => {
    expect(SETUP_STEPS.map((step) => step.nextLabel)).toEqual([
      'Create admin and continue',
      'Start import in background',
      'Continue',
      'Save AI settings',
      'Finish setup',
      null,
    ]);
    expect(stepDef(4).title).toBe('AI, on your terms');
  });

  it('allows skipping steps 2 to 5 only', () => {
    expect([1, 2, 3, 4, 5, 6].map(canSkip)).toEqual([false, true, true, true, true, false]);
  });

  it('keeps everyone on step 1 until the admin exists, then resumes at 2', () => {
    expect(resolveStep(4, false)).toBe(1);
    expect(resolveStep(undefined, true)).toBe(2);
    expect(resolveStep(1, true)).toBe(1);
    expect(resolveStep(9, true)).toBe(LAST_STEP);
  });

  it('resumes at the last of steps 2 to 5 the admin was on', () => {
    expect(resolveStep(undefined, true, 5)).toBe(5);
    expect(resolveStep(3, true, 5)).toBe(3);
    expect(resolveStep(undefined, false, 5)).toBe(1);
    expect([null, 1, 2, 4, 5, 6, 2.5].map(resumeStep)).toEqual([2, 2, 2, 4, 5, 2, 2]);
  });

  it('marks rail dots and only lets an admin jump between steps 1 to 5', () => {
    const before = railItems(1, false);
    expect(before.every((item) => !item.canVisit)).toBe(true);
    const during = railItems(3, true);
    expect(during.map((item) => item.state)).toEqual([
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(during.map((item) => item.marker)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(during.map((item) => item.state).slice(0, 3)).toEqual(['done', 'done', 'current']);
    expect(during.map((item) => item.canVisit)).toEqual([true, true, false, true, true, false]);
    expect(railItems(6, true).every((item) => !item.canVisit)).toBe(true);
  });
});

describe('useSetupWizard', () => {
  it('moves forward through the URL once the admin exists', async () => {
    mockApi.reset('wizard');
    let wizard: ReturnType<typeof useSetupWizard> | undefined;
    const { router } = await renderPage(
      () => {
        wizard = useSetupWizard(3);
        return null;
      },
      '/setup?step=3',
      testQueryClient(),
    );
    await waitFor(() => expect(wizard?.loading).toBe(false));
    expect(wizard?.adminExists).toBe(true);
    expect(wizard?.signedIn).toBe(true);
    expect(wizard?.counter).toBe('Step 3 of 6');
    await act(async () => {
      await wizard?.next();
    });
    expect(router.state.location.pathname).toBe('/setup');
    expect(router.state.location.search).toEqual({ step: 4 });
  });

  it('remembers the step and picks up there when the URL names none', async () => {
    mockApi.reset('wizard');
    let wizard: ReturnType<typeof useSetupWizard> | undefined;
    const client = testQueryClient();
    const first = await renderPage(
      () => {
        wizard = useSetupWizard(5);
        return null;
      },
      '/setup?step=5',
      client,
    );
    await waitFor(() => expect(useSetupStore.getState().lastStep).toBe(5));
    first.unmount();
    await renderPage(
      () => {
        wizard = useSetupWizard(undefined);
        return null;
      },
      '/setup',
      client,
    );
    await waitFor(() => expect(wizard?.loading).toBe(false));
    expect(wizard?.step).toBe(5);
  });

  it('stays on step 1 on a fresh install', async () => {
    mockApi.reset('fresh');
    let wizard: ReturnType<typeof useSetupWizard> | undefined;
    await renderPage(
      () => {
        wizard = useSetupWizard(4);
        return null;
      },
      '/setup?step=4',
      testQueryClient(),
    );
    await waitFor(() => expect(wizard?.loading).toBe(false));
    expect(wizard?.adminExists).toBe(false);
    expect(wizard?.step).toBe(1);
    expect(wizard?.canSkip).toBe(false);
  });
});
