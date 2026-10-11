import type { WorkflowRule } from '../../../shared/index.ts';
import { clientId, statusById, type DraftTransition, type EditorDraft } from './draft-model.ts';

/** The three lists a transition's rules live in, in the order the side panel shows them. */
export const RULE_SLOTS = ['conditions', 'validators', 'postActions'] as const;
export type RuleSlot = (typeof RULE_SLOTS)[number];

/** Which slot a registry kind belongs in. */
export const SLOT_OF_KIND = {
  condition: 'conditions',
  validator: 'validators',
  post_action: 'postActions',
} as const satisfies Record<string, RuleSlot>;

/**
 * A new transition is named after where it goes ("Done"), which a person
 * renames in the panel; from null is the "Any status" transition.
 */
export function addTransition(
  draft: EditorDraft,
  fromStatusId: string | null,
  toStatusId: string,
): { draft: EditorDraft; id: string } {
  const id = clientId('t');
  const position = Math.max(-1, ...draft.transitions.map((transition) => transition.position)) + 1;
  const transition: DraftTransition = {
    id,
    fromStatusId,
    toStatusId,
    name: (statusById(draft, toStatusId)?.name ?? 'Move').slice(0, 60),
    rules: { conditions: [], validators: [], postActions: [] },
    position,
  };
  return { draft: { ...draft, transitions: [...draft.transitions, transition] }, id };
}

export type TransitionPatch = Partial<
  Pick<DraftTransition, 'name' | 'fromStatusId' | 'toStatusId'>
>;

function mapTransition(
  draft: EditorDraft,
  id: string,
  change: (transition: DraftTransition) => DraftTransition,
): EditorDraft {
  return {
    ...draft,
    transitions: draft.transitions.map((transition) =>
      transition.id === id ? change(transition) : transition,
    ),
  };
}

export function updateTransition(
  draft: EditorDraft,
  id: string,
  patch: TransitionPatch,
): EditorDraft {
  return mapTransition(draft, id, (transition) => ({ ...transition, ...patch }));
}

export function removeTransition(draft: EditorDraft, id: string): EditorDraft {
  return { ...draft, transitions: draft.transitions.filter((transition) => transition.id !== id) };
}

function mapSlot(
  draft: EditorDraft,
  id: string,
  slot: RuleSlot,
  change: (rules: WorkflowRule[]) => WorkflowRule[],
): EditorDraft {
  return mapTransition(draft, id, (transition) => ({
    ...transition,
    rules: { ...transition.rules, [slot]: change(transition.rules[slot]) },
  }));
}

export function addRule(
  draft: EditorDraft,
  id: string,
  slot: RuleSlot,
  rule: WorkflowRule,
): EditorDraft {
  return mapSlot(draft, id, slot, (rules) => [...rules, rule]);
}

export function updateRuleArgs(
  draft: EditorDraft,
  id: string,
  slot: RuleSlot,
  index: number,
  args: Record<string, unknown>,
): EditorDraft {
  return mapSlot(draft, id, slot, (rules) =>
    rules.map((rule, at) => (at === index ? { ...rule, args } : rule)),
  );
}

export function removeRule(
  draft: EditorDraft,
  id: string,
  slot: RuleSlot,
  index: number,
): EditorDraft {
  return mapSlot(draft, id, slot, (rules) => rules.filter((_, at) => at !== index));
}

/** Transitions leaving a status, in their order; the "Any" ones are listed on their target. */
export const transitionsFrom = (draft: EditorDraft, statusId: string) =>
  draft.transitions.filter((transition) => transition.fromStatusId === statusId);

/** Transitions arriving at a status, whose rules run when an issue enters it. */
export const transitionsInto = (draft: EditorDraft, statusId: string) =>
  draft.transitions.filter((transition) => transition.toStatusId === statusId);
