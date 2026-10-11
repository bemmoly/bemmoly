import { seedWorkRules } from '../seed/work-rules.ts';
import type { Row } from './work-state.ts';

/*
 * The draft checks of modules/work/server/src/services/workflow/validate.ts,
 * in the same order and with the same codes, so the editor's Validate panel
 * reads the same against the mock as against the server. Rule arguments are
 * checked for their required keys only; the server runs each rule's schema.
 */

interface RuleEntry {
  name: string;
  args?: Record<string, unknown>;
}

export interface DraftStatus extends Row {
  name: string;
  category: string;
  position: number;
  x?: number;
  y?: number;
}

export interface DraftTransition extends Row {
  fromStatusId: string | null;
  toStatusId: string;
  name: string;
  rules?: { conditions?: RuleEntry[]; validators?: RuleEntry[]; postActions?: RuleEntry[] };
  position: number;
}

export interface Draft {
  statuses: DraftStatus[];
  transitions: DraftTransition[];
}

export interface Problem {
  code: string;
  message: string;
  statusId?: string;
  transitionId?: string;
}

const SLOTS = { conditions: 'condition', validators: 'validator', postActions: 'post_action' };
const REGISTRY = new Map(seedWorkRules().map((rule) => [rule.name, rule]));

function reachability(draft: Draft, problems: Problem[]): void {
  const start = [...draft.statuses].sort((a, b) => a.position - b.position)[0];
  if (!start) return;
  const reached = new Set<string>([start.id]);
  for (const transition of draft.transitions)
    if (transition.fromStatusId === null) reached.add(transition.toStatusId);
  const queue = [...reached];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    for (const transition of draft.transitions) {
      if (transition.fromStatusId !== current || reached.has(transition.toStatusId)) continue;
      reached.add(transition.toStatusId);
      queue.push(transition.toStatusId);
    }
  }
  for (const status of draft.statuses)
    if (!reached.has(status.id))
      problems.push({
        code: 'unreachable_status',
        message: `No transition leads to "${status.name}"`,
        statusId: status.id,
      });
}

function rules(transition: DraftTransition, problems: Problem[]): void {
  for (const [slot, kind] of Object.entries(SLOTS) as [keyof typeof SLOTS, string][]) {
    for (const entry of transition.rules?.[slot] ?? []) {
      const rule = REGISTRY.get(entry.name);
      if (!rule || rule.kind !== kind) {
        problems.push({
          code: 'unknown_rule',
          message: `"${transition.name}" uses an unknown ${kind.replace('_', ' ')} "${entry.name}"`,
          transitionId: transition.id,
        });
        continue;
      }
      const required = (rule.params['required'] as string[] | undefined) ?? [];
      const missing = required.find((key) => {
        const value = entry.args?.[key];
        return value === undefined || value === '' || (Array.isArray(value) && !value.length);
      });
      if (missing)
        problems.push({
          code: 'invalid_rule_params',
          message: `"${transition.name}": ${rule.label} ${missing}: Required`,
          transitionId: transition.id,
        });
    }
  }
}

export function validateDraft(draft: Draft): { valid: boolean; problems: Problem[] } {
  const problems: Problem[] = [];
  if (!draft.statuses.some((status) => status.category === 'done'))
    problems.push({ code: 'no_done_status', message: 'Add a status in the Done category' });
  const seen = new Set<string>();
  for (const status of draft.statuses) {
    const key = status.name.trim().toLowerCase();
    if (seen.has(key))
      problems.push({
        code: 'duplicate_status_name',
        message: `Two statuses are named "${status.name}"`,
        statusId: status.id,
      });
    seen.add(key);
  }
  reachability(draft, problems);
  const ids = new Set(draft.statuses.map((status) => status.id));
  for (const transition of draft.transitions)
    for (const end of [transition.fromStatusId, transition.toStatusId])
      if (end !== null && !ids.has(end))
        problems.push({
          code: 'transition_missing_status',
          message: `"${transition.name}" points at a status that no longer exists`,
          transitionId: transition.id,
        });
  for (const transition of draft.transitions) rules(transition, problems);
  return { valid: problems.length === 0, problems };
}
