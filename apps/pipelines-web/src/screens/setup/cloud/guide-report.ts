import type { CloudAccessCheckResponse } from '@bemmoly/module-pipelines/shared';
import type { GuideStep, StepKey } from './guide-steps.ts';

/*
 * What Check found, step by step, in words: which steps are done and, for the first one that
 * is not, what is missing and which step to run. Google Cloud's own sentences stay beside it
 * as the detail.
 */

export type ReportState = 'done' | 'failed' | 'todo';

export type ReportNote =
  | 'notCreated'
  | 'cannotAct'
  | 'noSignIn'
  | 'actingAs'
  | 'vmNoAccount'
  | 'vmActingAs'
  | 'fileFailed'
  | 'signedInAs'
  | 'grantsMissing'
  | 'folderUnseen'
  | 'folderReady'
  | 'noProjects'
  | 'blocked'
  | 'projectsReady'
  | 'grantedOther'
  | 'machineFailed';

export interface StepReport {
  key: StepKey;
  state: ReportState;
  note: ReportNote | null;
  /** Values for the note; `step` is the number of the step to run. */
  params: Record<string, string | number>;
}

export interface CheckReport {
  steps: StepReport[];
  /** Everything checked holds: Connect may go ahead. */
  ready: boolean;
}

export interface ReportInput {
  steps: GuideStep[];
  response: CloudAccessCheckResponse;
  /** Who the steps make Bemmoly sign in as; null when they leave it open. */
  expected: string | null;
  folderId: string;
}

const SIGN_IN_STEPS: StepKey[] = [
  'bootstrap',
  'tokenCreator',
  'serviceAccount',
  'signIn',
  'docker',
];

/** Which earlier step a failed gcloud sign-in points back to, from Google Cloud's words. */
function signInCause(problems: string[]): 'notCreated' | 'cannotAct' | 'noSignIn' {
  const text = problems.join(' ');
  if (/\b404\b|not ?found|does not exist/i.test(text)) return 'notCreated';
  if (/\b403\b|permission|denied|getAccessToken|Token Creator/i.test(text)) return 'cannotAct';
  return 'noSignIn';
}

const CAUSE_STEP: Record<'notCreated' | 'cannotAct' | 'noSignIn', StepKey[]> = {
  notCreated: ['bootstrap', 'serviceAccount'],
  cannotAct: ['tokenCreator', 'serviceAccount'],
  noSignIn: ['signIn'],
};

export function checkReport({ steps, response, expected, folderId }: ReportInput): CheckReport {
  const number = (key: StepKey) => steps.findIndex((step) => step.key === key) + 1;
  const out = new Map<StepKey, StepReport>(
    steps.map((step) => [step.key, { key: step.key, state: 'todo', note: null, params: {} }]),
  );
  const set = (key: StepKey, state: ReportState, note: ReportNote | null, params = {}) => {
    if (out.has(key)) out.set(key, { key, state, note, params });
  };
  const has = (key: StepKey) => out.has(key);
  const account = expected ?? '';
  const principal = response.principal ?? '';
  const finish = (ready: boolean) => ({ steps: steps.map((step) => out.get(step.key)!), ready });

  if (!response.signedIn) {
    if (has('attachVm')) set('attachVm', 'failed', 'vmNoAccount', { step: number('attachVm') });
    else if (has('wifFile')) set('wifFile', 'failed', 'fileFailed');
    else if (has('signIn')) {
      const cause = signInCause(response.problems);
      const key = CAUSE_STEP[cause].find(has) ?? 'signIn';
      set(key, 'failed', cause, { account, step: number(key) });
    } else set('grant', 'failed', 'machineFailed');
    return finish(false);
  }

  const signInStep = (['signIn', 'attachVm', 'wifFile'] as const).find(has);
  if (expected && principal !== expected) {
    if (signInStep) {
      const note = signInStep === 'attachVm' ? 'vmActingAs' : 'actingAs';
      set(signInStep, 'failed', note, { principal, account, step: number(signInStep) });
    } else {
      set('grant', 'failed', 'grantedOther', { principal, expected, step: number('grant') });
    }
    return finish(false);
  }
  for (const key of SIGN_IN_STEPS) if (key !== 'bootstrap') set(key, 'done', null);
  if (signInStep) set(signInStep, 'done', 'signedInAs', { principal });
  set('bootstrap', 'done', null);

  if (has('folderId')) {
    const folder = folderId;
    const unseen = response.problems.some(
      (problem) => problem.includes(`folder ${folder}`) && /cannot see/i.test(problem),
    );
    if (unseen) {
      set('folderId', 'failed', 'folderUnseen', { folder });
      return finish(false);
    }
    if (response.problems.length > 0) {
      set('bootstrap', 'failed', 'grantsMissing', { account, step: number('bootstrap') });
      set('folderId', 'done', null);
      return finish(false);
    }
    set('folderId', 'done', 'folderReady', { folder });
    return finish(true);
  }

  if (has('grant')) {
    const blocked = response.projects.filter((project) => !project.ok).length;
    const step = number('grant');
    if (response.projects.length === 0) set('grant', 'failed', 'noProjects', { step });
    else if (blocked > 0) set('grant', 'failed', 'blocked', { count: blocked, step });
    else set('grant', 'done', 'projectsReady', { count: response.projects.length });
    // Some projects blocked can still be connected and fixed later; none found cannot.
    return finish(response.projects.length > 0);
  }
  return finish(true);
}
