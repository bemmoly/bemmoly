import type { StatusCategory as WorkflowCategory } from '@bemmoly/module-work/shared';
import type { IssueTypeLike, IssueTypeRef, StatusCategory } from '@bemmoly/ui';

/*
 * The design system paints five status tones and six type glyphs; the server knows three
 * status categories and any number of named types. These map one onto the other.
 */

/**
 * A workflow status as a badge tone. In-progress statuses whose name says review or QA take
 * those tones, as the mocks colour "In review" and "QA"; every other status follows its category.
 */
export function statusTone(category: WorkflowCategory, name = ''): StatusCategory {
  if (category === 'todo') return 'todo';
  if (category === 'done') return 'done';
  if (/review/i.test(name)) return 'review';
  if (/\b(qa|test)/i.test(name)) return 'qa';
  return 'progress';
}

/**
 * A type as the glyph draws it: the stored type itself, so a custom type shows its own icon
 * and colour (falling back on its level's look), or a task when the type is unknown.
 */
export function typeGlyph(type: IssueTypeLike | undefined): IssueTypeRef {
  return type ?? 'task';
}

/** "4h", "1h 30m", "45m": minutes as the work log prints them. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** "2h", "1h 30m", "45m", "1.5" (hours) → minutes; null when it does not read as a duration. */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase().replace(/\s+/g, '');
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value) * 60) || null;
  const match = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m)?$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  return Math.round(Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) || null;
}

/** "Oct 7, 2026" for a date field. */
export function formatDay(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
