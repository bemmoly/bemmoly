import { parse } from 'yaml';

/*
 * Reading the manifests discovery looks at, forgivingly: a file that does not parse adds
 * nothing rather than failing the scan, since one broken file must not hide a repository.
 */

export function yamlOf(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const value: unknown = parse(text, { maxAliasCount: 20 });
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Every document of a multi-document YAML file (catalog-info.yaml often holds several). */
export function yamlDocumentsOf(text: string | null): Record<string, unknown>[] {
  if (text === null) return [];
  return text
    .split(/^---\s*$/m)
    .map((part) => yamlOf(part))
    .filter((doc): doc is Record<string, unknown> => doc !== null);
}

export function jsonOf(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export const stringOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** `[workspace] members = ["crates/*", "services/api"]` from a Cargo.toml, without a TOML parser. */
export function cargoMembers(text: string | null): string[] | null {
  if (text === null || !/^\s*\[workspace\]/m.test(text)) return null;
  const match = /members\s*=\s*\[([\s\S]*?)\]/.exec(text);
  return [...(match?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? '').filter(Boolean);
}

/** `include ':api', 'services:billing'` (Groovy or Kotlin) → ["api", "services/billing"]. */
export function gradleIncludes(text: string | null): string[] {
  if (text === null) return [];
  const projects: string[] = [];
  for (const line of text.split('\n')) {
    if (!/^\s*include\b/.test(line)) continue;
    for (const match of line.matchAll(/["']:?([A-Za-z0-9_.:-]+)["']/g)) {
      projects.push((match[1] ?? '').replace(/:/g, '/'));
    }
  }
  return projects;
}

/** `use ./api` and `use ( ./a ./b )` from a go.work file. */
export function goWorkUses(text: string | null): string[] {
  if (text === null) return [];
  const uses: string[] = [];
  const block = /use\s*\(([\s\S]*?)\)/.exec(text);
  const lines = block ? (block[1] ?? '').split('\n') : [];
  for (const line of lines) if (line.trim()) uses.push(line.trim());
  for (const match of text.matchAll(/^use\s+([^\s(]+)\s*$/gm)) uses.push(match[1] ?? '');
  return uses.map((use) => use.replace(/^\.\//, '').replace(/\/+$/, '')).filter(Boolean);
}
