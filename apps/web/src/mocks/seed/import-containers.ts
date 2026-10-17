import type { ImportContainerRow } from '@bemmoly/shared';

/**
 * What a connection finds, per source: the everyday Jira site (14 projects, two imported
 * before, one whose key is taken, two the token cannot read), a Confluence site (9 spaces,
 * two personal), a big Jira site (1,240 projects, counted only when asked) and a token that
 * sees nothing. The site address picks the big ("big") and empty ("empty") sites.
 */
export interface MockContainer extends Omit<ImportContainerRow, 'count' | 'selected'> {
  /** What a count finds inside it. */
  records: number;
  /** Counted only on request, as a big site's would be. */
  lazy: boolean;
}

const JTYPES = ['Software', 'Business', 'Service'];
const LEADS = [
  'Ana Costa',
  'Rohan Shah',
  'Mei Lin',
  'Jonas Berg',
  'Priya Nair',
  'Tom Okafor',
  'Sara Ruiz',
  'Liam Chen',
];
const IMPORTED_AT = '2026-10-02T09:30:00.000Z';

type Status = 'imported' | 'conflict' | 'noaccess' | null;

/** A stable id per imported target, so an earlier import's project keeps its id. */
const targetId = (n: number) => `0199a000-0000-7000-8000-${String(n).padStart(12, '0')}`;

function row(
  id: string,
  key: string,
  name: string,
  kind: string,
  type: string,
  lead: string | null,
  records: number,
  st: Status,
  lazy = false,
): MockContainer {
  return {
    id,
    key,
    name,
    kind,
    type,
    lead,
    access: st === 'noaccess' ? 'none' : 'ok',
    records: st === 'noaccess' ? 0 : records,
    lazy,
    imported:
      st === 'imported'
        ? { id: targetId(Number(id) || key.length), key, name, at: IMPORTED_AT }
        : null,
    keyInUse: st === 'conflict',
  };
}

const JIRA_14: [string, string, number, string, number, Status][] = [
  ['PLT', 'Platform', 0, 'Rohan Shah', 1840, 'imported'],
  ['SUP', 'Support desk', 2, 'Sara Ruiz', 6220, 'conflict'],
  ['MOB', 'Mobile apps', 0, 'Mei Lin', 3071, null],
  ['WEB', 'Web storefront', 0, 'Ana Costa', 2310, null],
  ['DATA', 'Data pipeline', 0, 'Jonas Berg', 912, null],
  ['SEC', 'Security reviews', 1, 'Priya Nair', 204, null],
  ['HR', 'People operations', 1, 'Sara Ruiz', 0, 'noaccess'],
  ['FIN', 'Finance close', 1, 'Tom Okafor', 0, 'noaccess'],
  ['OPS', 'Infrastructure', 0, 'Liam Chen', 4410, 'imported'],
  ['DES', 'Design system', 0, 'Mei Lin', 640, null],
  ['MKT', 'Marketing launches', 1, 'Ana Costa', 388, null],
  ['API', 'Public API', 0, 'Rohan Shah', 1502, null],
  ['QA', 'Quality and release', 0, 'Jonas Berg', 0, null],
  ['LEG', 'Legal requests', 2, 'Priya Nair', 97, null],
];

const jira14 = (): MockContainer[] =>
  JIRA_14.map(([key, name, t, lead, count, st], i) =>
    row(String(10001 + i), key, name, 'project', JTYPES[t] ?? 'Software', lead, count, st),
  );

const WORDS = [
  'Atlas',
  'Beacon',
  'Cobalt',
  'Delta',
  'Ember',
  'Fjord',
  'Granite',
  'Harbor',
  'Indigo',
  'Juniper',
  'Kestrel',
  'Lumen',
  'Meridian',
  'Nimbus',
  'Orbit',
  'Pioneer',
  'Quartz',
  'Rivet',
  'Summit',
  'Tundra',
];
const AREAS = [
  'billing',
  'checkout',
  'onboarding',
  'search',
  'payments',
  'mobile',
  'reporting',
  'identity',
  'data',
  'support',
  'infra',
  'growth',
];

function seeded(i: number) {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** The design's 1,240-project site, generated the same way. */
const jiraMany = (): MockContainer[] =>
  Array.from({ length: 1240 }, (_, i) => {
    const word = WORDS[i % WORDS.length] ?? 'Atlas';
    const area = AREAS[Math.floor(i / WORDS.length) % AREAS.length] ?? 'billing';
    const key =
      (word.slice(0, 2) + area.slice(0, 2)).toUpperCase() + (i >= 240 ? Math.floor(i / 240) : '');
    const r = seeded(i);
    const st: Status = i % 97 === 5 ? 'noaccess' : i % 61 === 3 ? 'imported' : null;
    const type = JTYPES[Math.floor(r * 10) % 3 === 2 ? 1 : 0] ?? 'Software';
    const lead = LEADS[i % LEADS.length] ?? null;
    return row(
      String(20000 + i),
      key,
      `${word} ${area}`,
      'project',
      type,
      lead,
      Math.floor(r * r * 9000),
      st,
      true,
    );
  });

const CONF_9: [string, string, string, number, Status][] = [
  ['ENG', 'Engineering', 'Team', 4120, 'imported'],
  ['PROD', 'Product', 'Team', 1388, null],
  ['HR', 'People team', 'Team', 512, null],
  ['SUP', 'Support handbook', 'Team', 940, 'conflict'],
  ['DES', 'Design', 'Team', 266, null],
  ['SALES', 'Sales playbooks', 'Team', 301, null],
  ['LEGAL', 'Legal', 'Team', 0, 'noaccess'],
  ['~rohan', 'Rohan Shah', 'Personal', 42, null],
  ['~mei', 'Mei Lin', 'Personal', 18, null],
];

const conf9 = (): MockContainer[] =>
  CONF_9.map(([key, name, type, count, st]) => row(key, key, name, 'space', type, null, count, st));

const csvFile = (): MockContainer[] => [
  {
    ...row('file', 'issues.csv', 'issues.csv', 'file', '', null, 214, null),
    key: null,
    type: null,
  },
];

export function mockContainers(source: string, site: string): MockContainer[] {
  if (source === 'csv') return csvFile();
  if (site.includes('empty')) return [];
  if (source === 'confluence') return conf9();
  return site.includes('big') ? jiraMany() : jira14();
}

/** Under 50: new ones with something in them start ticked (not personal spaces); else none. */
export function defaultSelection(rows: readonly MockContainer[]): Set<string> {
  if (rows.length >= 50) return new Set();
  return new Set(
    rows
      .filter((r) => r.access === 'ok' && !r.imported && r.records > 0 && r.type !== 'Personal')
      .map((r) => r.id),
  );
}
