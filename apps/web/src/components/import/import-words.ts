import type { ImportJobStatus } from '@bemmoly/shared';
import type { PillTone } from '../settings/state-pill.tsx';

const NUMBER = new Intl.NumberFormat('en');

export const count = (n: number) => NUMBER.format(n);

/** "issues" → "Issues"; the server's kinds are plain lower-case words. */
export const kindLabel = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);

/** "2,769 issues · 24 users". */
export function countLine(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts)
    .map(([kind, n]) => `${count(n)} ${kind}`)
    .join(' · ');
}

export const STATUS_WORDS: Record<ImportJobStatus, { label: string; tone: PillTone }> = {
  ready: { label: 'Not started', tone: 'neutral' },
  queued: { label: 'Waiting to start', tone: 'acc' },
  running: { label: 'Importing', tone: 'acc' },
  completed: { label: 'Finished', tone: 'ok' },
  failed: { label: 'Failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'warn' },
};
