import { useQuery } from '@tanstack/react-query';
import { useSetupStore } from '../store/setup.ts';
import { meQuery, setupStatusQuery } from './use-session.ts';
import { FIRST_ADMIN_STEP, LAST_STEP, resumeStep, SETUP_STEPS } from './use-setup-wizard.ts';
import { isOrgAdmin } from '../lib/session.ts';

export type LeftState = 'done' | 'skipped' | 'next' | 'todo';

export interface LeftStep {
  n: number;
  name: string;
  sub: string;
  state: LeftState;
}

/**
 * The wizard steps an admin has not finished, for the first-sign-in welcome and Home's
 * checklist: the workspace and the account are done once the admin exists; the steps after
 * them are done, skipped, or still to do, and the one to resume is "next".
 */
export function setupLeft(lastStep: number | null, skipped: readonly number[]): LeftStep[] {
  const next = resumeStep(lastStep);
  return SETUP_STEPS.filter((step) => step.n < LAST_STEP).map((step) => {
    const state: LeftState =
      step.n < FIRST_ADMIN_STEP
        ? 'done'
        : step.n === next
          ? 'next'
          : skipped.includes(step.n)
            ? 'skipped'
            : step.n < next
              ? 'done'
              : 'todo';
    return { n: step.n, name: step.name, sub: step.sub, state };
  });
}

/** Whether this admin's setup is unfinished, and what is left of it. */
export function useSetupLeft() {
  const status = useQuery(setupStatusQuery);
  const me = useQuery({ ...meQuery, enabled: false });
  const lastStep = useSetupStore((state) => state.lastStep);
  const skipped = useSetupStore((state) => state.skipped);
  const update = useSetupStore((state) => state.update);
  const admin = me.data ? isOrgAdmin(me.data) : false;
  return {
    unfinished: admin && status.data?.initialized === true && status.data.completedAt === null,
    steps: setupLeft(lastStep, skipped),
    resume: resumeStep(lastStep),
    remaining: setupLeft(lastStep, skipped).filter((step) => step.state !== 'done').length,
    /** "Skip setup": the app opens on this device, and Home keeps the list. */
    skip: () => update({ setupSkipped: true }),
  };
}
