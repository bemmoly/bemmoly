/*
 * The wizard's step numbers and where it resumes, apart from the wizard itself: the route guard
 * reads them on every visit, and the wizard's screens load only during setup.
 */

/** Workspace and account come before the admin exists; the rest is theirs to skip. */
export const ACCOUNT_STEP = 2;
export const FIRST_ADMIN_STEP = 3;
export const LAST_STEP = 7;

/**
 * Where an unfinished wizard picks up once the admin exists: the last of the skippable steps
 * the admin was on in this tab, else Import. The summary is never resumed; reaching it
 * finishes setup.
 */
export function resumeStep(lastStep: number | null | undefined): number {
  const resumable =
    typeof lastStep === 'number' &&
    Number.isInteger(lastStep) &&
    lastStep >= FIRST_ADMIN_STEP &&
    lastStep < LAST_STEP;
  return resumable ? lastStep : FIRST_ADMIN_STEP;
}
