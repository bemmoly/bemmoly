import type { IssueType, Priority } from '../glyphs/glyphs.tsx';

/**
 * The Board Settings "Card color" rules: a 3px left stripe by priority (red to green), by issue
 * type (story / bug / task) or by epic (the lane colour). None keeps the 1px border.
 */
export type CardStripeRule = 'none' | 'priority' | 'type' | 'epic';

const PRIORITY_STRIPES: Record<Priority, string> = {
  highest: 'border-l-danger-hi',
  high: 'border-l-warn',
  medium: 'border-l-caution',
  low: 'border-l-ok',
  lowest: 'border-l-tx5',
};

const TYPE_STRIPES: Record<IssueType, string> = {
  story: 'border-l-type-story',
  bug: 'border-l-type-bug',
  task: 'border-l-type-task',
  epic: 'border-l-type-epic',
  incident: 'border-l-type-incident',
  subtask: 'border-l-type-subtask',
};

export interface StripeSource {
  priority: Priority;
  type: IssueType;
  /** The epic's colour as a border utility, e.g. "border-l-epic-1" or "border-l-epic-2". */
  epicClassName?: string;
}

/** The border-left utility for a card under a colour rule, or undefined for no stripe. */
export function cardStripe(rule: CardStripeRule, source: StripeSource): string | undefined {
  if (rule === 'priority') return PRIORITY_STRIPES[source.priority];
  if (rule === 'type') return TYPE_STRIPES[source.type];
  if (rule === 'epic') return source.epicClassName;
  return undefined;
}
