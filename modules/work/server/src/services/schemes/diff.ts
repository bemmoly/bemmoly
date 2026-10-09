import type { SchemeDiffEntry } from '../../../../shared/schemes.ts';

/*
 * The rows of "View diff": what a project's copy of a scheme changes from
 * the org default. Pure, so every rule is unit tested; the loaders hand in
 * plain records already matched to their origin.
 */

export interface DiffItem {
  /** Stable within the kind: a type or field key, "status:<name>", "transition:<name>". */
  key: string;
  label: string;
  /** The project row's origin, or null for a row added on the project. */
  originKey: string | null;
  value: Record<string, unknown>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Org rows against the project's copies, matched by origin: a copy whose
 * origin is gone or absent is added, an org row nothing copies is removed,
 * and a pair is changed when any compared attribute differs.
 */
export function diffItems(
  org: readonly DiffItem[],
  project: readonly DiffItem[],
  attributes: readonly string[],
): SchemeDiffEntry[] {
  const orgByKey = new Map(org.map((item) => [item.key, item]));
  const copied = new Set<string>();
  const entries: SchemeDiffEntry[] = [];
  for (const item of project) {
    const origin = item.originKey ? orgByKey.get(item.originKey) : undefined;
    if (!origin) {
      entries.push({
        key: item.key,
        label: item.label,
        change: 'added',
        after: item.value,
        attributes: [],
      });
      continue;
    }
    copied.add(origin.key);
    const changed = attributes.filter((name) => !same(origin.value[name], item.value[name]));
    if (changed.length > 0) {
      entries.push({
        key: item.key,
        label: item.label,
        change: 'changed',
        before: origin.value,
        after: item.value,
        attributes: changed,
      });
    }
  }
  for (const item of org) {
    if (!copied.has(item.key)) {
      entries.push({
        key: item.key,
        label: item.label,
        change: 'removed',
        before: item.value,
        attributes: [],
      });
    }
  }
  return entries;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** "columns.0.wipLimit" → "columns › 1 › wipLimit": counted from one, as people count columns. */
const labelOf = (path: string) =>
  path
    .split('.')
    .map((part) => (/^\d+$/.test(part) ? String(Number(part) + 1) : part))
    .join(' › ');

/**
 * Settings that differ between two config objects, one row per leaf path.
 * Arrays of equal length are compared item by item; otherwise the whole
 * array is one changed row, as reordering columns is one change.
 */
export function diffConfig(base: unknown, next: unknown, path = ''): SchemeDiffEntry[] {
  if (same(base, next)) return [];
  if (isRecord(base) && isRecord(next)) {
    const keys = [...new Set([...Object.keys(base), ...Object.keys(next)])];
    return keys.flatMap((key) => diffConfig(base[key], next[key], path ? `${path}.${key}` : key));
  }
  if (Array.isArray(base) && Array.isArray(next) && base.length === next.length) {
    return base.flatMap((item, index) => diffConfig(item, next[index], `${path}.${index}`));
  }
  const entry: SchemeDiffEntry = {
    key: path,
    label: labelOf(path),
    change: base === undefined ? 'added' : next === undefined ? 'removed' : 'changed',
    attributes: [],
  };
  if (base !== undefined) entry.before = base;
  if (next !== undefined) entry.after = next;
  return [entry];
}
