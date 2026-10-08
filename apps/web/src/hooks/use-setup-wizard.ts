import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useSetupStore } from '../store/setup.ts';
import { meQuery, setupStatusQuery } from './use-session.ts';

export interface SetupStep {
  n: number;
  /** Rail label and its one-line hint. */
  name: string;
  sub: string;
  title: string;
  subtitle: string;
  /** The bottom bar's primary button; the last step has its own buttons. */
  nextLabel: string | null;
  canSkip: boolean;
}

export const LAST_STEP = 6;

export const SETUP_STEPS: readonly SetupStep[] = [
  {
    n: 1,
    name: 'Server and admin',
    sub: 'Health checks, first account',
    title: 'Your server is up',
    subtitle: 'Create the first admin account; it owns this workspace.',
    nextLabel: 'Create admin and continue',
    canSkip: false,
  },
  {
    n: 2,
    name: 'Import',
    sub: 'Jira, Confluence, CSV, or clean',
    title: 'Bring your data, or start clean',
    subtitle:
      'Import will keep keys, history, comments, attachments and page trees, and you can run it again for a second project.',
    nextLabel: 'Start import in background',
    canSkip: true,
  },
  {
    n: 3,
    name: 'People',
    sub: 'Invites by email',
    title: 'Invite your team',
    subtitle: 'Paste emails and everyone gets an invitation to set a password.',
    nextLabel: 'Continue',
    canSkip: true,
  },
  {
    n: 4,
    name: 'AI provider',
    sub: 'Optional, private by default',
    title: 'AI, on your terms',
    subtitle:
      'Bemmoly works fully without AI. Connect a provider to get summaries, planning help, doc Q&A and the command bar. Nothing is sent anywhere until you do.',
    nextLabel: 'Save AI settings',
    canSkip: true,
  },
  {
    n: 5,
    name: 'Appearance',
    sub: 'Theme and logo',
    title: 'Make it yours',
    subtitle: 'Pick a theme now or upload a logo and brand color. Everyone sees this by default.',
    nextLabel: 'Finish setup',
    canSkip: true,
  },
  {
    n: 6,
    name: 'Done',
    sub: 'Summary',
    title: 'Ready',
    subtitle: "Here's what we set up. Everything can be changed later in Workspace settings.",
    nextLabel: null,
    canSkip: false,
  },
];

/** The white note under the rail. */
export const RAIL_NOTE = 'Everything here can be changed later in Workspace settings.';

export function stepDef(n: number): SetupStep {
  return SETUP_STEPS[Math.min(Math.max(n, 1), LAST_STEP) - 1] as SetupStep;
}

/** Steps 2 to 5 may be skipped; the admin account and the summary may not. */
export function canSkip(n: number): boolean {
  return stepDef(n).canSkip;
}

/**
 * Where an unfinished wizard picks up: the last of steps 2 to 5 the admin was
 * on in this tab, else 2. The summary is never resumed; reaching it finishes setup.
 */
export function resumeStep(lastStep: number | null | undefined): number {
  const resumable =
    typeof lastStep === 'number' &&
    Number.isInteger(lastStep) &&
    lastStep >= 2 &&
    lastStep < LAST_STEP;
  return resumable ? lastStep : 2;
}

/**
 * Which step to show. Before the admin exists only step 1 makes sense; after,
 * a missing step resumes where the admin left off, as the router guard does.
 */
export function resolveStep(
  requested: number | undefined,
  adminExists: boolean,
  lastStep: number | null = null,
): number {
  if (!adminExists) return 1;
  if (requested === undefined || !Number.isInteger(requested)) return resumeStep(lastStep);
  return Math.min(Math.max(requested, 1), LAST_STEP);
}

export type RailState = 'done' | 'current' | 'upcoming';

export interface RailItem extends SetupStep {
  state: RailState;
  /** Shown as ✓ when done, otherwise the number. */
  marker: string;
  /**
   * Nothing is clickable before the admin exists. The summary is reached only
   * through "Finish setup", because arriving there marks setup finished.
   */
  canVisit: boolean;
}

export function railItems(current: number, adminExists: boolean): RailItem[] {
  return SETUP_STEPS.map((step) => {
    const state: RailState =
      step.n < current ? 'done' : step.n === current ? 'current' : 'upcoming';
    return {
      ...step,
      state,
      marker: state === 'done' ? '✓' : String(step.n),
      canVisit: adminExists && step.n !== current && step.n < LAST_STEP && current < LAST_STEP,
    };
  });
}

/** Where the wizard is and how to move: the step lives in the URL (?step=N). */
export function useSetupWizard(requested: number | undefined) {
  const status = useQuery(setupStatusQuery);
  const adminExists = status.data?.initialized ?? false;
  const me = useQuery({ ...meQuery, enabled: adminExists });
  const navigate = useNavigate();
  const lastStep = useSetupStore((state) => state.lastStep);
  const update = useSetupStore((state) => state.update);
  const step = resolveStep(requested, adminExists, lastStep);
  useEffect(() => {
    if (adminExists && resumeStep(step) === step && step !== lastStep) update({ lastStep: step });
  }, [adminExists, step, lastStep, update]);
  const goTo = (n: number) => navigate({ to: '/setup', search: { step: resolveStep(n, true) } });
  const next = () => goTo(Math.min(step + 1, LAST_STEP));
  return {
    loading: status.isPending || (adminExists && me.isPending),
    error: status.error,
    adminExists,
    signedIn: Boolean(me.data),
    me: me.data ?? null,
    step,
    def: stepDef(step),
    steps: railItems(step, adminExists),
    isLast: step === LAST_STEP,
    canSkip: canSkip(step),
    counter: `Step ${step} of ${LAST_STEP}`,
    goTo,
    next,
  };
}
