import { typeLook, type IssueTypeRef, type Priority } from '../glyphs/glyphs.tsx';
import type { TypeColorToken } from '../../tokens/semantic.ts';

/**
 * The Board Settings "Card color" rules: a 3px left stripe by priority (red to green), by issue
 * type (story / bug / task) or by epic (the lane colour). None keeps the 1px border.
 */
export type CardStripeRule = 'none' | 'priority' | 'type' | 'epic';

const PRIORITY_STRIPES: Record<Priority, string> = {
  highest: 'border-l-red-tx',
  high: 'border-l-amber',
  medium: 'border-l-amber',
  low: 'border-l-green',
  lowest: 'border-l-tx-3',
};

const TYPE_STRIPES: Record<TypeColorToken, string> = {
  'type-story': 'border-l-type-story',
  'type-bug': 'border-l-type-bug',
  'type-task': 'border-l-type-task',
  'type-epic': 'border-l-type-epic',
  'type-incident': 'border-l-type-incident',
  'type-subtask': 'border-l-type-subtask',
};

export interface StripeSource {
  priority: Priority;
  type: IssueTypeRef;
  /** The epic's colour as a border utility, e.g. "border-l-epic-1" or "border-l-epic-2". */
  epicClassName?: string;
}

/** The border-left utility for a card under a colour rule, or undefined for no stripe. */
export function cardStripe(rule: CardStripeRule, source: StripeSource): string | undefined {
  if (rule === 'priority') return PRIORITY_STRIPES[source.priority];
  if (rule === 'type') return TYPE_STRIPES[typeLook(source.type).color];
  if (rule === 'epic') return source.epicClassName;
  return undefined;
}
