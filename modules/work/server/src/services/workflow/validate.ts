import type {
  WorkflowDraft,
  WorkflowProblem,
  WorkflowValidationResponse,
} from '../../../../shared/index.ts';
import { findRule, parseRuleArgs, RULE_SLOTS } from './rules/index.ts';

type Draft = WorkflowDraft;
type Transition = Draft['transitions'][number];

/*
 * What the editor's Validate panel shows before publish, in the order a
 * person would fix them: a workflow with no exit, statuses nothing leads
 * to, edges pointing nowhere, then rules the registry does not know.
 */

function doneStatus(draft: Draft, problems: WorkflowProblem[]): void {
  if (!draft.statuses.some((status) => status.category === 'done')) {
    problems.push({ code: 'no_done_status', message: 'Add a status in the Done category' });
  }
}

function duplicateNames(draft: Draft, problems: WorkflowProblem[]): void {
  const seen = new Map<string, string>();
  for (const status of draft.statuses) {
    const key = status.name.trim().toLowerCase();
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, status.id);
      continue;
    }
    problems.push({
      code: 'duplicate_status_name',
      message: `Two statuses are named "${status.name}"`,
      statusId: status.id,
    });
  }
}

/** The start is the first status by position; everything else needs a path in from it. */
function reachability(draft: Draft, problems: WorkflowProblem[]): void {
  const ids = new Set(draft.statuses.map((status) => status.id));
  const start = [...draft.statuses].sort((a, b) => a.position - b.position)[0];
  if (!start) return;
  const anyTargets = new Set<string>();
  const edges = new Map<string, Set<string>>();
  for (const transition of draft.transitions) {
    if (!ids.has(transition.toStatusId)) continue;
    if (transition.fromStatusId === null) {
      anyTargets.add(transition.toStatusId);
      continue;
    }
    const targets = edges.get(transition.fromStatusId) ?? new Set<string>();
    targets.add(transition.toStatusId);
    edges.set(transition.fromStatusId, targets);
  }
  const reached = new Set<string>([start.id, ...anyTargets]);
  const queue = [...reached];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    for (const next of edges.get(current) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  for (const status of draft.statuses) {
    if (reached.has(status.id)) continue;
    problems.push({
      code: 'unreachable_status',
      message: `No transition leads to "${status.name}"`,
      statusId: status.id,
    });
  }
}

function missingStatuses(draft: Draft, problems: WorkflowProblem[]): void {
  const ids = new Set(draft.statuses.map((status) => status.id));
  for (const transition of draft.transitions) {
    const ends = [transition.fromStatusId, transition.toStatusId];
    for (const end of ends) {
      if (end === null || ids.has(end)) continue;
      problems.push({
        code: 'transition_missing_status',
        message: `"${transition.name}" points at a status that no longer exists`,
        transitionId: transition.id,
      });
    }
  }
}

function rules(transition: Transition, problems: WorkflowProblem[]): void {
  for (const [slot, kind] of Object.entries(RULE_SLOTS) as [keyof typeof RULE_SLOTS, string][]) {
    for (const entry of transition.rules?.[slot] ?? []) {
      const rule = findRule(entry.name);
      if (!rule || rule.kind !== kind) {
        problems.push({
          code: 'unknown_rule',
          message: `"${transition.name}" uses an unknown ${kind.replace('_', ' ')} "${entry.name}"`,
          transitionId: transition.id,
        });
        continue;
      }
      const parsed = parseRuleArgs(rule, entry.args ?? {});
      if (parsed.ok) continue;
      problems.push({
        code: 'invalid_rule_params',
        message: `"${transition.name}": ${rule.label} ${parsed.message}`,
        transitionId: transition.id,
      });
    }
  }
}

/** Pure: the service calls it before publish and the route exposes it to the editor. */
export function validateDraft(draft: Draft): WorkflowValidationResponse {
  const problems: WorkflowProblem[] = [];
  doneStatus(draft, problems);
  duplicateNames(draft, problems);
  reachability(draft, problems);
  missingStatuses(draft, problems);
  for (const transition of draft.transitions) rules(transition, problems);
  return { valid: problems.length === 0, problems };
}
