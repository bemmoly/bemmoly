import type { BoardConfig, Field } from '@bemmoly/module-work/shared';
import {
  createIssueFieldCatalog,
  parseLql,
  validateLql,
  type CustomFieldSpec,
  type LqlError,
  type LqlFieldCatalog,
  type LqlFieldKind,
} from '@bemmoly/shared';

/*
 * The LQL the board settings write (lane queries, quick filters and colour
 * conditions) is checked in the page with the shared parser and validator,
 * against the issue fields plus the project's custom fields, so a typo is
 * underlined before the server would refuse the save.
 */

const KIND: Record<Field['kind'], LqlFieldKind> = {
  text: 'text',
  richtext: 'text',
  url: 'text',
  doc: 'text',
  number: 'number',
  select: 'option',
  multiselect: 'option',
  user: 'user',
  date: 'date',
  datetime: 'date',
};

/** The project's fields as LQL custom fields: `cf.<key>`, or their name in quotes. */
export function settingsCatalog(fields: readonly Field[] = []): LqlFieldCatalog {
  const custom = fields.map((field): CustomFieldSpec => ({
    key: field.key,
    label: field.name,
    kind: KIND[field.kind],
    ...(field.options.length > 0 ? { options: field.options.map((option) => option.label) } : {}),
  }));
  return createIssueFieldCatalog(custom);
}

/** The first problem in a query, or null when it parses and every field is known. */
export function checkLql(text: string, catalog: LqlFieldCatalog): LqlError | null {
  if (!text.trim()) return { message: 'Write a query', position: 0, length: 0 };
  const parsed = parseLql(text);
  if (!parsed.ok) return parsed.error;
  return validateLql(parsed.value, catalog)[0] ?? null;
}

export interface QueryProblem {
  /** Where the query sits in the config, as the server names it: "quickFilters.0.query". */
  path: string;
  message: string;
}

/** Every LQL text of a config that would not pass, with its path; the server checks the same. */
export function configLqlProblems(config: BoardConfig, catalog: LqlFieldCatalog): QueryProblem[] {
  const queries = [
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
  return queries.flatMap(({ path, query }) => {
    const error = checkLql(query, catalog);
    return error ? [{ path, message: error.message }] : [];
  });
}
