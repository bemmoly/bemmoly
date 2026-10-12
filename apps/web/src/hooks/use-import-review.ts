import { queryKeys } from '@bemmoly/api-client';
import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import {
  count,
  finePrintOf,
  kindLabel,
  nounsOf,
  plural,
} from '../components/import/import-words.ts';
import { importsApi } from '../lib/imports-api.ts';

/** No serial comma, as the design writes lists: "comments, attachments and links". */
const LIST = new Intl.ListFormat('en-GB', { type: 'conjunction' });

const kindPlural = (kind: string, n: number) =>
  n === 1 ? kind : kind.endsWith('s') ? `${kind}es` : `${kind}s`;

export interface ReviewLine {
  term: string;
  value: string;
  /** Set in monospace before the value: the site address. */
  mono?: string;
}

/**
 * Review: everything Start will do, as lines of a definition list, from the plan and the
 * rows that want a look (updates, existing targets, new keys). Nothing is decided here.
 */
export function useImportReview(job: ImportJob, source: ImportSource | null) {
  const attention = useQuery({
    queryKey: queryKeys.imports.containers(job.id, '', 'attention'),
    queryFn: () => importsApi.containers(job.id, { filter: 'attention', limit: 100 }),
  });
  const plan = job.plan;
  const nouns = nounsOf(source);
  const rows = attention.data?.items ?? [];
  const lines: ReviewLine[] = [];
  if (!plan) return { lines, loading: attention.isPending };

  const site = job.discovery?.site ?? job.sourceLabel;
  const email = job.connection['email'];
  lines.push({
    term: 'From',
    mono: site,
    value: typeof email === 'string' && email ? ` as ${email}` : '',
  });

  const t = plan.targets;
  const total = plan.containers.length;
  const updated = rows.filter((row) => row.target?.mode === 'update').map((row) => row.name);
  const parts = [`${count(total)}`];
  if (t) {
    const fresh = t.create ? `${count(t.create)} new` : null;
    const into = t.existing ? `${count(t.existing)} into existing ${nouns.containers}` : null;
    const again = t.update
      ? `${count(t.update)} imported before${updated.length ? ` (${LIST.format(updated)})` : ''} are updated, not copied`
      : null;
    const detail = [fresh, into, again].filter(Boolean).join(', ');
    if (detail) parts.push(detail);
  }
  lines.push({ term: kindLabel(nouns.containers), value: parts.join(': ') });

  const options = source?.options ?? [];
  const on = options.filter((option) => plan.include?.[option.name] ?? option.default);
  const off = options.filter((option) => !(plan.include?.[option.name] ?? option.default));
  const records = Object.values(plan.counts).reduce((sum, n) => sum + n, 0);
  const extras = on.map((option) => option.label.toLowerCase());
  lines.push({
    term: kindLabel(nouns.records),
    value: `~${count(records)}${extras.length ? ` with ${LIST.format(extras)}` : ''}`,
  });
  if (off.length) lines.push({ term: 'Not brought', value: LIST.format(off.map((o) => o.label)) });

  const people = plan.people;
  if (people && people.total > 0) {
    lines.push({
      term: 'People',
      value: `${count(people.matched)} matched by email · ${count(people.placeholders + people.hidden)} placeholders`,
    });
  }

  const keys = rows.flatMap((row) => {
    const target = row.target;
    if (!target || target.error) return [];
    if (target.mode === 'existing')
      return [`${row.key ?? row.name} goes into ${target.name} (${target.key})`];
    if (target.mode === 'create' && target.key !== row.key) {
      return [`${row.key ?? row.name} becomes ${target.key}`];
    }
    return [];
  });
  if (keys.length) lines.push({ term: 'Keys', value: keys.join('; ') });

  const reported = new Map<string, number>();
  for (const mapping of finePrintOf(plan.mappings)) {
    if (mapping.action === 'report')
      reported.set(mapping.kind, (reported.get(mapping.kind) ?? 0) + 1);
  }
  if (reported.size) {
    lines.push({
      term: 'Reported only',
      value: [...reported].map(([kind, n]) => `${count(n)} ${kindPlural(kind, n)}`).join(', '),
    });
  }
  return { lines, loading: attention.isPending, total: plural(total, nouns) };
}
