import type { Changelog, Changeset, ChangesetContextName } from '../../contracts/changelog.ts';
import { ChangelogError } from './errors.ts';

/** The module name kernel changesets are recorded under in schema_changelog. */
export const KERNEL_MODULE = 'core';

export interface ChangelogSource {
  module: string;
  changelog: Changelog;
  dependsOn?: readonly string[];
}

/** Dependency order, stable with respect to the given order; fails on cycles. */
function orderByDependencies(sources: readonly ChangelogSource[]): ChangelogSource[] {
  const byModule = new Map(sources.map((source) => [source.module, source]));
  const ordered: ChangelogSource[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (source: ChangelogSource): void => {
    const seen = state.get(source.module);
    if (seen === 'done') return;
    if (seen === 'visiting') {
      throw new ChangelogError(
        'invalid_changelog',
        `Module dependency cycle at "${source.module}"`,
      );
    }
    state.set(source.module, 'visiting');
    for (const dependency of source.dependsOn ?? []) {
      const required = byModule.get(dependency);
      if (!required) {
        throw new ChangelogError(
          'unknown_target',
          `Module "${source.module}" depends on "${dependency}", whose changelog is not included`,
        );
      }
      visit(required);
    }
    state.set(source.module, 'done');
    ordered.push(source);
  };
  for (const source of sources) visit(source);
  return ordered;
}

/** Kernel first, then the requested modules (all when omitted) in dependency order. */
export function selectSources(
  kernel: Changelog,
  available: readonly ChangelogSource[],
  include?: readonly string[],
): ChangelogSource[] {
  const byModule = new Map(available.map((source) => [source.module, source]));
  const chosen = (include ?? available.map((source) => source.module))
    .filter((module) => module !== KERNEL_MODULE)
    .map((module) => {
      const source = byModule.get(module);
      if (!source) {
        throw new ChangelogError(
          'unknown_target',
          `No changelog is registered for module "${module}"`,
        );
      }
      return source;
    });
  return [{ module: KERNEL_MODULE, changelog: kernel }, ...orderByDependencies(chosen)];
}

export function findChangeset(
  sources: readonly ChangelogSource[],
  module: string,
  id: string,
): Changeset | undefined {
  return sources.find((source) => source.module === module)?.changelog.find((c) => c.id === id);
}

/** A changeset runs when it declares `*` or shares a context with the install. */
export function matchesContexts(
  changeset: Changeset,
  contexts: readonly ChangesetContextName[],
): boolean {
  const declared = changeset.contexts ?? ['*'];
  if (declared.length === 0 || declared.includes('*')) return true;
  return declared.some((context) => contexts.includes(context));
}
