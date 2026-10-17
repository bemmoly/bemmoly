import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useSetupStore } from '../store/setup.ts';
import { meQuery, setupStatusQuery } from './use-session.ts';
import { ACCOUNT_STEP, FIRST_ADMIN_STEP, LAST_STEP, resumeStep } from '../lib/setup-steps.ts';

export { ACCOUNT_STEP, FIRST_ADMIN_STEP, LAST_STEP, resumeStep };

export interface SetupStep {
  n: number;
  /** The stepper's label, and the one line shown under it while the step is current. */
  name: string;
  sub: string;
  title: string;
  subtitle: string;
  /** The footer's primary button; the last step has its own. */
  nextLabel: string | null;
  canSkip: boolean;
}

export const SETUP_STEPS: readonly SetupStep[] = [
  {
    n: 1,
    name: 'Workspace',
    sub: 'Its name and address',
    title: 'Welcome to Bemmoly',
    subtitle: 'Name your workspace. Everything here can be changed later.',
    nextLabel: 'Continue',
    canSkip: false,
  },
  {
    n: 2,
    name: 'Your account',
    sub: 'The workspace owner',
    title: 'Create your account',
    subtitle:
      'You will own this workspace. Keep this password after you turn on single sign-on: it is the way in if sign-on breaks.',
    nextLabel: 'Create account',
    canSkip: false,
  },
  {
    n: 3,
    name: 'Import',
    sub: 'Bring data, or start clean',
    title: 'Bring your data, or start clean',
    subtitle:
      'Import keeps keys, comments, attachments and page trees, and running it again updates what it made instead of copying it.',
    nextLabel: 'Continue',
    canSkip: true,
  },
  {
    n: 4,
    name: 'People',
    sub: 'Invite your team',
    title: 'Invite your team',
    subtitle: 'Paste emails and everyone gets an invitation to set a password.',
    nextLabel: 'Continue',
    canSkip: true,
  },
  {
    n: 5,
    name: 'AI',
    sub: 'Optional, private by default',
    title: 'AI, on your terms',
    subtitle:
      'Bemmoly works fully without AI. Connect a provider for summaries, planning help and answers from your docs. Nothing is sent anywhere until you do.',
    nextLabel: 'Save AI settings',
    canSkip: true,
  },
  {
    n: 6,
    name: 'Look',
    sub: 'Theme and default mode',
    title: 'Make it yours',
    subtitle:
      'Pick a theme and a default mode. Everyone sees this until they choose their own mode.',
    nextLabel: 'Finish setup',
    canSkip: true,
  },
  {
    n: 7,
    name: 'Done',
    sub: 'What is next',
    title: 'You are all set',
    subtitle: 'Here is what is set up. Anything you skipped is one click away in Settings.',
    nextLabel: 'Open Bemmoly',
    canSkip: false,
  },
];

export function stepDef(n: number): SetupStep {
  return SETUP_STEPS[Math.min(Math.max(n, 1), LAST_STEP) - 1] as SetupStep;
}

/** Import, People, AI and Look may be skipped; the workspace, account and summary may not. */
export function canSkip(n: number): boolean {
  return stepDef(n).canSkip;
}

/**
 * Which step to show. Before the admin exists only the workspace and the account make sense,
 * and the account only once the workspace has a name; after, a missing step resumes where the
 * admin left off (as the router guard does), and the first two are behind them.
 */
export function resolveStep(
  requested: number | undefined,
  adminExists: boolean,
  lastStep: number | null = null,
  workspaceNamed = false,
): number {
  if (!adminExists) {
    const wanted = requested ?? lastStep ?? 1;
    return wanted >= ACCOUNT_STEP && workspaceNamed ? ACCOUNT_STEP : 1;
  }
  if (requested === undefined || !Number.isInteger(requested)) return resumeStep(lastStep);
  return Math.min(Math.max(requested, FIRST_ADMIN_STEP), LAST_STEP);
}

export type RailState = 'done' | 'skipped' | 'current' | 'upcoming';

export interface RailItem extends SetupStep {
  state: RailState;
  /**
   * Nothing is clickable before the admin exists except going back to the workspace. After,
   * the first two steps are done for good, and the summary is reached only through "Finish
   * setup", because arriving there marks setup finished.
   */
  canVisit: boolean;
}

export function railItems(
  current: number,
  adminExists: boolean,
  skipped: readonly number[] = [],
): RailItem[] {
  return SETUP_STEPS.map((step) => {
    const passed = step.n < current;
    const state: RailState =
      step.n === current
        ? 'current'
        : passed
          ? skipped.includes(step.n)
            ? 'skipped'
            : 'done'
          : 'upcoming';
    const canVisit = adminExists
      ? step.n !== current &&
        step.n >= FIRST_ADMIN_STEP &&
        step.n < LAST_STEP &&
        current < LAST_STEP
      : step.n === 1 && current === ACCOUNT_STEP;
    return { ...step, state, canVisit };
  });
}

/** Where the wizard is and how to move: the step lives in the URL (?step=N). */
export function useSetupWizard(requested: number | undefined) {
  const status = useQuery(setupStatusQuery);
  const adminExists = status.data?.initialized ?? false;
  const me = useQuery({ ...meQuery, enabled: adminExists });
  const navigate = useNavigate();
  const lastStep = useSetupStore((state) => state.lastStep);
  const skipped = useSetupStore((state) => state.skipped);
  const workspaceNamed = useSetupStore((state) => state.workspaceName.trim() !== '');
  const update = useSetupStore((state) => state.update);
  const step = resolveStep(requested, adminExists, lastStep, workspaceNamed);
  useEffect(() => {
    if (step !== lastStep && step < LAST_STEP && (adminExists || step < FIRST_ADMIN_STEP)) {
      update({ lastStep: step });
    }
  }, [adminExists, step, lastStep, update]);
  const goTo = (n: number) =>
    navigate({ to: '/setup', search: { step: Math.min(Math.max(n, 1), LAST_STEP) } });
  const next = () => {
    if (skipped.includes(step)) update({ skipped: skipped.filter((n) => n !== step) });
    return goTo(step + 1);
  };
  const skip = () => {
    if (!skipped.includes(step)) update({ skipped: [...skipped, step] });
    return goTo(step + 1);
  };
  const first = adminExists ? FIRST_ADMIN_STEP : 1;
  return {
    loading: status.isPending || (adminExists && me.isPending),
    error: status.error,
    retry: () => void status.refetch(),
    adminExists,
    signedIn: Boolean(me.data),
    me: me.data ?? null,
    step,
    def: stepDef(step),
    steps: railItems(step, adminExists, skipped),
    isLast: step === LAST_STEP,
    canSkip: canSkip(step),
    /** Back is offered where the step before can still be changed. */
    canGoBack: step > first && step < LAST_STEP,
    counter: `Step ${step} of ${LAST_STEP}`,
    goTo,
    next,
    skip,
    back: () => goTo(step - 1),
  };
}
