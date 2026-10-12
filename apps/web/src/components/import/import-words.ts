import type { ImportJobStatus, ImportMapping, ImportSource } from '@bemmoly/shared';
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

export type ImportNouns = NonNullable<ImportSource['nouns']>;

const PROJECTS: ImportNouns = {
  container: 'project',
  containers: 'projects',
  records: 'issues',
  target: 'Work project',
};
const NOUNS: Record<string, ImportNouns> = {
  confluence: { container: 'space', containers: 'spaces', records: 'pages', target: 'Docs space' },
  csv: { container: 'file', containers: 'files', records: 'issues', target: 'Work project' },
};

/** The words for what a source holds: the source's own, else by what it lists. */
export function nounsOf(source: Pick<ImportSource, 'id' | 'nouns'> | null): ImportNouns {
  return source?.nouns ?? NOUNS[source?.id ?? ''] ?? PROJECTS;
}

/** "1 project", "14 projects". */
export const plural = (n: number, nouns: ImportNouns) =>
  `${count(n)} ${n === 1 ? nouns.container : nouns.containers}`;

const DAY = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

/** "Oct 2". */
export const shortDate = (iso: string) => DAY.format(new Date(iso));

/** People have their own section; the fine print is statuses, types and fields. */
export const finePrintOf = (mappings: readonly ImportMapping[]) =>
  mappings.filter((mapping) => mapping.kind !== 'person');
