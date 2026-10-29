import type { Variable } from '@bemmoly/module-pipelines/shared';

/*
 * What one view of the Variables tab lists. For every environment: the shared values. For one
 * environment: what a deploy there runs with, its own value over the shared one, with the
 * shared ones marked as coming from every environment.
 */

export interface VariableRow {
  name: string;
  variable: Variable;
  /** Shown in one environment's view, but set for every environment. */
  inherited: boolean;
  /** The shared value an environment's own one replaces there. */
  overrides: Variable | null;
}

export function rowsFor(items: readonly Variable[], environment: string | null): VariableRow[] {
  const shared = items.filter((item) => item.environment === null);
  if (!environment) {
    return shared.map((variable) => ({
      name: variable.name,
      variable,
      inherited: false,
      overrides: null,
    }));
  }
  const own = items.filter((item) => item.environment?.key === environment);
  const names = [...new Set([...own, ...shared].map((item) => item.name))].sort();
  return names.flatMap((name) => {
    const mine = own.find((item) => item.name === name);
    const theirs = shared.find((item) => item.name === name) ?? null;
    const variable = mine ?? theirs;
    if (!variable) return [];
    return [{ name, variable, inherited: !mine, overrides: mine ? theirs : null }];
  });
}

/** Names as the server takes them: capitals, digits and underscores, not starting with a digit. */
export const nameValid = (name: string) => /^[A-Z_][A-Z0-9_]{0,127}$/.test(name);

/** What a person types, made into a name: "database url" becomes "DATABASE_URL". */
export const nameOf = (typed: string) => typed.toUpperCase().replace(/[\s-]+/g, '_');
