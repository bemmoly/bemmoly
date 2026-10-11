import type { TriggerDefinition } from '../contract.ts';
import { commentAdded } from './comment-added.ts';
import { fieldChanged } from './field-changed.ts';
import { issueCreated } from './issue-created.ts';
import { issueTransitioned } from './issue-transitioned.ts';
import { scheduled } from './scheduled.ts';

/*
 * Every trigger a rule can start from. Adding one is its file plus a line here; the rule
 * validator, the engine, the scheduler and the builder's catalog read this list only.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- each trigger parses its own args; the registry erases them */
const TRIGGERS: readonly TriggerDefinition<any>[] = [
  issueCreated,
  fieldChanged,
  issueTransitioned,
  commentAdded,
  scheduled,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const byName = new Map<string, TriggerDefinition>(TRIGGERS.map((entry) => [entry.name, entry]));

export function findTrigger(name: string): TriggerDefinition | undefined {
  return byName.get(name);
}

/** Names of the triggers that listen to one domain event kind. */
export function triggersFor(kind: string): string[] {
  return TRIGGERS.filter((entry) => entry.events.includes(kind)).map((entry) => entry.name);
}

/** Every event kind some trigger listens to, for the engine's subscriptions. */
export const TRIGGER_EVENT_KINDS: readonly string[] = [
  ...new Set(TRIGGERS.flatMap((entry) => entry.events)),
];

export const SCHEDULED_TRIGGERS: readonly string[] = TRIGGERS.filter(
  (entry) => entry.cron !== undefined,
).map((entry) => entry.name);

export const allTriggers = (): readonly TriggerDefinition[] => TRIGGERS;

export { lastFireTime } from './scheduled.ts';
