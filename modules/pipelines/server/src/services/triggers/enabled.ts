import type { PipelineTrigger } from '../../../../shared/pipeline-setup.ts';
import { triggersOf } from '../pipeline-setup/reads.ts';

/*
 * Whether a service's pipeline starts on an event (product rule 1): only when the person
 * added that trigger. A pipeline with no triggers runs only when someone presses Run.
 */

export type TriggerEvent = { kind: 'push'; branch: string } | { kind: 'pull_request' };

/** "main", "release/*", "*": a branch name, where `*` stands for any run of characters. */
export function branchMatches(pattern: string, branch: string): boolean {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`).test(branch);
}

export function startsOn(raw: unknown, event: TriggerEvent): boolean {
  const triggers: PipelineTrigger[] = triggersOf(raw);
  return triggers.some((trigger) =>
    event.kind === 'push'
      ? trigger.kind === 'push' && branchMatches(trigger.branch, event.branch)
      : trigger.kind === 'pull_request',
  );
}
