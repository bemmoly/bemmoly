import { ValidationError } from '@bemmoly/shared';
import type { BoardConfig } from '../../../../shared/boards.ts';

/*
 * The rules a board config must keep beyond its schema: every column maps
 * statuses of the board's workflow, no status sits in two columns, column ids
 * are unique, and every lane query, quick filter and colour rule is valid LQL.
 */

export interface ConfigProblem {
  path: string;
  message: string;
}

export function configProblems(
  config: BoardConfig,
  statusIds: ReadonlySet<string>,
): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const columnIds = new Set<string>();
  const placed = new Map<string, string>();
  config.columns.forEach((column, index) => {
    if (columnIds.has(column.id)) {
      problems.push({ path: `columns.${index}.id`, message: `Two columns use "${column.id}"` });
    }
    columnIds.add(column.id);
    for (const statusId of column.statusIds) {
      if (!statusIds.has(statusId)) {
        problems.push({
          path: `columns.${index}.statusIds`,
          message: `${column.name} maps a status that is not in this board's workflow`,
        });
      } else if (placed.has(statusId)) {
        problems.push({
          path: `columns.${index}.statusIds`,
          message: `${column.name} maps a status that ${placed.get(statusId)} already shows`,
        });
      }
      placed.set(statusId, column.name);
    }
  });
  return problems;
}

/** Every LQL text a config carries, with where it sits, for the validator. */
export function configQueries(config: BoardConfig): { path: string; query: string }[] {
  return [
    ...config.lanes.queries.map((lane, index) => ({
      path: `lanes.queries.${index}.query`,
      query: lane.query,
    })),
    ...config.quickFilters.map((filter, index) => ({
      path: `quickFilters.${index}.query`,
      query: filter.query,
    })),
    ...config.colorRules.map((rule, index) => ({
      path: `colorRules.${index}.query`,
      query: rule.query,
    })),
  ];
}

export function rejectProblems(problems: readonly ConfigProblem[]): void {
  if (problems.length === 0) return;
  throw new ValidationError(problems[0]?.message ?? 'The board configuration is not valid', {
    details: { problems },
  });
}

/**
 * True when the only difference between two configs is column WIP limits,
 * which the "Edit WIP limits" capability allows without board configuration.
 */
export function onlyWipChanged(before: BoardConfig, after: BoardConfig): boolean {
  if (before.columns.length !== after.columns.length) return false;
  const strip = (config: BoardConfig) =>
    JSON.stringify({
      ...config,
      columns: config.columns.map((column) => ({ ...column, wipLimit: null })),
    });
  return strip(before) === strip(after);
}
