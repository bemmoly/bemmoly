import type { ImportInclude, ImportIncludeKey, ImportJob, ImportSource } from '@bemmoly/shared';
import { nounsOf } from '../components/import/import-words.ts';
import { useImportPeople } from './use-import-people.ts';
import { useImportPlanUpdate } from './use-import-plan-update.ts';
import { useImportTargetOptions } from './use-import-target-options.ts';
import { useImportTargets } from './use-import-targets.ts';

/**
 * Options: what to bring, where each container goes, who the people are, and the fine print.
 * Every change is a PATCH that answers with the new plan; Review waits while a key is wrong,
 * a typed key has not been checked yet, or an Existing row has nothing picked.
 */
export function useImportOptions(job: ImportJob, source: ImportSource | null) {
  const update = useImportPlanUpdate(job.id);
  const targets = useImportTargets(job, update);
  const people = useImportPeople(job, update);
  const picking = [...targets.top, ...targets.rest].some(
    (row) => targets.modeOf(row) === 'existing',
  );
  const holders = useImportTargetOptions(job.id, picking);
  const plan = job.plan;
  const pendingInclude = update.isPending ? update.variables.include : undefined;
  const include: Partial<ImportInclude> = { ...plan?.include, ...pendingInclude };

  return {
    plan,
    nouns: nounsOf(source),
    label: source?.label ?? job.sourceLabel,
    options: source?.options ?? [],
    include,
    toggle: (name: ImportIncludeKey, on: boolean) => update.mutate({ include: { [name]: on } }),
    targets,
    holders,
    people,
    saving: update.isPending,
    error: update.error,
    blocked: targets.blocked || update.isPending,
  };
}

export type ImportOptions = ReturnType<typeof useImportOptions>;
