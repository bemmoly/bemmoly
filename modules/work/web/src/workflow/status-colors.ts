import type { WorkflowCategory } from '@bemmoly/ui';
import type { StatusCategory } from '../../../shared/index.ts';

/*
 * A status stores its colour as a hex value, which is data, not styling: the
 * editor offers the swatches the Workflow mock uses and draws each with the
 * theme token that matches it, so a status reads right in every preset. A
 * value outside the list is drawn in its category's colour.
 */
export const STATUS_COLORS = [
  { value: '#8b5cf6', label: 'Violet', className: 'bg-violet' },
  { value: '#d49a1a', label: 'Amber', className: 'bg-caution' },
  { value: '#2456c9', label: 'Blue', className: 'bg-ac' },
  { value: '#2b9b5a', label: 'Green', className: 'bg-ok' },
  { value: '#d93838', label: 'Red', className: 'bg-danger' },
] as const;

export function colorClassOf(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  return STATUS_COLORS.find((swatch) => swatch.value === color.toLowerCase())?.className;
}

/** The server's category names to the canvas's: "in_progress" is drawn as "progress". */
export const canvasCategory = (category: StatusCategory): WorkflowCategory =>
  category === 'in_progress' ? 'progress' : category;

export const CATEGORY_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
] as const satisfies ReadonlyArray<{ value: StatusCategory; label: string }>;
