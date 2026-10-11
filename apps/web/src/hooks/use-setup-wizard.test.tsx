import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSetupStore } from '../store/setup.ts';
import { renderPage, testQueryClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  ACCOUNT_STEP,
  canSkip,
  FIRST_ADMIN_STEP,
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
  it('names every step and its primary', () => {
    expect(SETUP_STEPS.map((step) => step.name)).toEqual([
      'Workspace',
      'Your account',
      'Import',
      'People',
      'AI',
      'Look',
      'Done',
    ]);
    expect(SETUP_STEPS.map((step) => step.nextLabel)).toEqual([
      'Continue',
      'Create account',
      'Continue',
      'Continue',
      'Save AI settings',
      'Finish setup',
      'Open Bemmoly',
    ]);
    expect(stepDef(1).title).toBe('Welcome to Bemmoly');
    expect(stepDef(5).title).toBe('AI, on your terms');
  });

  it('allows skipping import, people, AI and look only', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(canSkip)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('keeps everyone on workspace and account until the admin exists', () => {
    expect(resolveStep(4, false)).toBe(1);
    expect(resolveStep(2, false)).toBe(1);
    expect(resolveStep(2, false, null, true)).toBe(ACCOUNT_STEP);
    expect(resolveStep(undefined, false, 2, true)).toBe(ACCOUNT_STEP);
    expect(resolveStep(undefined, true)).toBe(FIRST_ADMIN_STEP);
    expect(resolveStep(1, true)).toBe(FIRST_ADMIN_STEP);
    expect(resolveStep(9, true)).toBe(LAST_STEP);
  });

  it('resumes at the last skippable step the admin was on', () => {
    expect(resolveStep(undefined, true, 5)).toBe(5);
    expect(resolveStep(4, true, 5)).toBe(4);
    expect([null, 1, 2, 3, 6, 7, 2.5].map(resumeStep)).toEqual([3, 3, 3, 3, 6, 3, 3]);
  });

  it('fills circles as steps pass and leaves skipped ones empty', () => {
    expect(railItems(1, false).every((item) => !item.canVisit)).toBe(true);
    expect(railItems(2, false).map((item) => item.canVisit)[0]).toBe(true);
    const during = railItems(5, true, [4]);
    expect(during.map((item) => item.state)).toEqual([
      'done',
      'done',
      'done',
      'skipped',
      'current',
      'upcoming',
      'upcoming',
    ]);
    expect(during.map((item) => item.canVisit)).toEqual([
      false,
      false,
      true,
      true,
      false,
      true,
      false,
    ]);
    expect(railItems(LAST_STEP, true).every((item) => !item.canVisit)).toBe(true);
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
    expect(wizard?.counter).toBe('Step 3 of 7');
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
