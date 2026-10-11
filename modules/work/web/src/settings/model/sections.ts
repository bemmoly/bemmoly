import type { BoardConfig, WorkMethod } from '@bemmoly/module-work/shared';

/*
 * Board settings save one tab at a time, as the read-then-edit pattern does
 * per section. Each tab owns some keys of the board config; a save writes the
 * stored config with only that tab's keys taken from the draft, so an
 * unsaved draft in another tab is never saved by accident.
 */

export const BOARD_SECTIONS = ['columns', 'lanes', 'filters', 'cards', 'method'] as const;
export type BoardSection = (typeof BOARD_SECTIONS)[number];

export const SECTION_TITLES: Record<BoardSection, string> = {
  columns: 'Columns',
  lanes: 'Swimlanes',
  filters: 'Quick filters',
  cards: 'Cards',
  method: 'Method and estimation',
};

export const SECTION_KEYS: Record<BoardSection, readonly (keyof BoardConfig)[]> = {
  columns: ['columns', 'collapseEmptyColumns', 'showColumnCounts', 'showUnassigned'],
  lanes: ['lanes'],
  filters: ['quickFilters'],
  cards: ['cardFields', 'colorRule', 'colorRules'],
  method: ['estimationUnit', 'cadenceDays', 'workingDays'],
};

/** The board settings draft: the board config plus the project's method. */
export interface BoardDraft {
  config: BoardConfig;
  method: WorkMethod;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function sectionDirty(section: BoardSection, stored: BoardDraft, draft: BoardDraft) {
  if (section === 'method' && stored.method !== draft.method) return true;
  return SECTION_KEYS[section].some((key) => !same(stored.config[key], draft.config[key]));
}

/** The stored config with one section's keys from the draft: what a section's save writes. */
export function mergeSection(
  section: BoardSection,
  stored: BoardConfig,
  draft: BoardConfig,
): BoardConfig {
  const merged = { ...stored };
  for (const key of SECTION_KEYS[section]) Object.assign(merged, { [key]: draft[key] });
  return merged;
}

/** The draft with one section put back to what is stored: Cancel for that section. */
export function discardSection(section: BoardSection, stored: BoardDraft, draft: BoardDraft) {
  return {
    config: mergeSection(section, draft.config, stored.config),
    method: section === 'method' ? stored.method : draft.method,
  };
}

/**
 * Only column WIP limits differ: "Edit WIP limits" is enough for that save.
 * Mirrors the server's rule so the page can offer it to people without
 * "Configure board".
 */
export function onlyWip(before: BoardConfig, after: BoardConfig): boolean {
  if (before.columns.length !== after.columns.length) return false;
  const strip = (config: BoardConfig) => ({
    ...config,
    columns: config.columns.map((column) => ({ ...column, wipLimit: null })),
  });
  return same(strip(before), strip(after));
}
