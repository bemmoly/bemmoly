import type { ServiceRow } from '@bemmoly/module-pipelines/shared';

/*
 * How the Services list narrows and groups what the server sent: health is read from what
 * runs in each environment, and the sections are domains or owning teams.
 */

export const HEALTH_FILTERS = ['any', 'failing', 'deploying', 'healthy'] as const;
export type HealthFilter = (typeof HEALTH_FILTERS)[number];

export const GROUPINGS = ['domain', 'team'] as const;
export type Grouping = (typeof GROUPINGS)[number];

export function healthOf(service: ServiceRow): Exclude<HealthFilter, 'any'> | null {
  const states = service.running.map((running) => running.state);
  if (states.includes('failed') || states.includes('rolled_back')) return 'failing';
  if (states.some((state) => state === 'deploying' || state === 'canary')) return 'deploying';
  return states.length > 0 ? 'healthy' : null;
}

export function byHealth(items: readonly ServiceRow[], health: HealthFilter): ServiceRow[] {
  return health === 'any' ? [...items] : items.filter((item) => healthOf(item) === health);
}

export interface Section {
  key: string;
  name: string;
  /** Domains draw their hue; teams their name's. */
  hue: string | null;
  items: ServiceRow[];
}

/** Sections in the server's order (domains by position); services without a team go last. */
export function sectionsOf(items: readonly ServiceRow[], grouping: Grouping, noTeam: string) {
  const sections = new Map<string, Section>();
  for (const item of items) {
    const key = grouping === 'domain' ? item.domain.key : (item.team?.id ?? '');
    const name = grouping === 'domain' ? item.domain.name : (item.team?.name ?? noTeam);
    const hue = grouping === 'domain' ? item.domain.color : null;
    const section = sections.get(key) ?? { key, name, hue, items: [] };
    section.items.push(item);
    sections.set(key, section);
  }
  const all = [...sections.values()];
  return grouping === 'team'
    ? all.sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.name.localeCompare(b.name)))
    : all;
}
