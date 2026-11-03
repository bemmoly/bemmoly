import {
  environmentIdSchema,
  type ApplySuggestedSetupBody,
  type SuggestedEnvironment,
} from '@bemmoly/module-pipelines/shared';

/*
 * The suggested setup as a form (product rule 1): it fills in a common starting point, and the
 * person unticks what they don't want and edits each environment's name, ID and project before
 * anything is created. Ticks that depend on an unticked environment are switched off with it.
 */

export type Which = 'dev' | 'stage' | 'prod';
export const WHICH: readonly Which[] = ['dev', 'stage', 'prod'];

export type Tick = Which | 'order' | 'prodApproval' | 'stageApproval' | 'window';

export interface SuggestedEnv {
  name: string;
  id: string;
  /** A project ID Bemmoly can reach, or empty for none yet. */
  project: string;
}

export interface SuggestedDraft {
  ticks: Record<Tick, boolean>;
  env: Record<Which, SuggestedEnv>;
}

const HINTS: Record<Which, RegExp> = { dev: /dev/, stage: /stag/, prod: /prod/ };

/** A project whose ID says which environment it is for, else the projects in order. */
export function projectFor(which: Which, projects: readonly string[]): string {
  const named = projects.find((project) => HINTS[which].test(project));
  return named ?? projects[WHICH.indexOf(which)] ?? '';
}

export function draftFor(projects: readonly string[]): SuggestedDraft {
  return {
    ticks: {
      dev: true,
      stage: true,
      prod: true,
      order: true,
      prodApproval: true,
      stageApproval: false,
      window: false,
    },
    env: {
      dev: { name: 'Dev', id: 'dev', project: projectFor('dev', projects) },
      stage: { name: 'Stage', id: 'stage', project: projectFor('stage', projects) },
      prod: { name: 'Production', id: 'production', project: projectFor('prod', projects) },
    },
  };
}

export const chosen = (draft: SuggestedDraft) => WHICH.filter((which) => draft.ticks[which]);

/** Whether a tick can be on at all, given the environments ticked. */
export function tickAvailable(draft: SuggestedDraft, tick: Tick): boolean {
  if (tick === 'order') return chosen(draft).length > 1;
  if (tick === 'prodApproval' || tick === 'window') return draft.ticks.prod;
  if (tick === 'stageApproval') return draft.ticks.stage;
  return true;
}

const effective = (draft: SuggestedDraft, tick: Tick) =>
  draft.ticks[tick] && tickAvailable(draft, tick);

/** How many things Create makes: each ticked box that still applies. */
export function countOf(draft: SuggestedDraft): number {
  return (Object.keys(draft.ticks) as Tick[]).filter((tick) => effective(draft, tick)).length;
}

export type EnvProblem = 'id' | 'taken' | null;

export function problemOf(draft: SuggestedDraft, which: Which): EnvProblem {
  const id = draft.env[which].id;
  if (!environmentIdSchema.safeParse(id).success) return 'id';
  const clash = chosen(draft).some((other) => other !== which && draft.env[other].id === id);
  return clash ? 'taken' : null;
}

export function draftReady(draft: SuggestedDraft): boolean {
  const envs = chosen(draft);
  return (
    envs.length > 0 &&
    envs.every((which) => draft.env[which].name.trim() !== '' && problemOf(draft, which) === null)
  );
}

/** The body Create sends; `group` names an approval group from the environment's name. */
export function bodyOf(
  draft: SuggestedDraft,
  group: (environmentName: string) => string,
  timeZone: string,
): ApplySuggestedSetupBody {
  const envs = chosen(draft);
  const ordered = effective(draft, 'order');
  const environments: SuggestedEnvironment[] = envs.map((which, index) => {
    const { name, id, project } = draft.env[which];
    const approval =
      (which === 'prod' && effective(draft, 'prodApproval')) ||
      (which === 'stage' && effective(draft, 'stageApproval'));
    return {
      name: name.trim(),
      key: id,
      ...(project ? { project: { provider: 'gcp' as const, externalId: project } } : {}),
      versionsAllowed: ordered && index > 0 ? 'passed_previous' : 'any',
      approval: approval ? { groupName: group(name.trim()), count: 1 } : null,
      window:
        which === 'prod' && effective(draft, 'window')
          ? { days: ['mon', 'tue', 'wed', 'thu', 'fri'], from: '10:00', to: '18:00', timeZone }
          : null,
    };
  });
  return { environments };
}
