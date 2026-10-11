import type { WorkflowCategory } from '@bemmoly/ui';
import type { StatusCategory } from '../../../shared/index.ts';

/*
 * A status stores its colour as a hex value, which is data, not styling: the
 * editor offers these swatches and draws each with the theme token that
 * matches it, so a status reads right in every preset. A value outside the
 * list is drawn in its category's colour.
 */
export const STATUS_COLORS = [
  { value: '#6e56cf', label: 'Violet', className: 'bg-epic-2' },
  { value: '#d97706', label: 'Amber', className: 'bg-amber' },
  { value: '#2356c9', label: 'Blue', className: 'bg-acc' },
  { value: '#1f9d55', label: 'Green', className: 'bg-green' },
  { value: '#e5484d', label: 'Red', className: 'bg-red' },
] as const;

/** The swatches the first release stored, each drawn as the swatch that replaced it. */
const LEGACY: Record<string, string> = {
  '#8b5cf6': '#6e56cf',
  '#d49a1a': '#d97706',
  '#2456c9': '#2356c9',
  '#2b9b5a': '#1f9d55',
  '#d93838': '#e5484d',
};

export function colorClassOf(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  const value = LEGACY[color.toLowerCase()] ?? color.toLowerCase();
  return STATUS_COLORS.find((swatch) => swatch.value === value)?.className;
}

/** The server's category names to the canvas's: "in_progress" is drawn as "progress". */
export const canvasCategory = (category: StatusCategory): WorkflowCategory =>
  category === 'in_progress' ? 'progress' : category;

export const CATEGORY_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
] as const satisfies ReadonlyArray<{ value: StatusCategory; label: string }>;
