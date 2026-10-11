import type { ActionDefinition } from '../contract.ts';
import { addComment } from './add-comment.ts';
import { addLabel } from './add-label.ts';
import { assign } from './assign.ts';
import { notify } from './notify.ts';
import { sendWebhook } from './send-webhook.ts';
import { setField } from './set-field.ts';
import { transition } from './transition.ts';

/*
 * Every action a rule can take. Adding one is its file plus a line here; the rule
 * validator, the runner and the builder's catalog read this list only.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- each action parses its own args; the registry erases them */
const ACTIONS: readonly ActionDefinition<any>[] = [
  setField,
  transition,
  assign,
  addComment,
  addLabel,
  sendWebhook,
  notify,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const byName = new Map<string, ActionDefinition>(ACTIONS.map((entry) => [entry.name, entry]));

export function findAction(name: string): ActionDefinition | undefined {
  return byName.get(name);
}

export const allActions = (): readonly ActionDefinition[] => ACTIONS;
