import type { Query } from '@bemmoly/api-client';

/** Filters as the query string sends them: lists joined with commas, as the server reads them. */
export function toQuery(filters: object): Query {
  const query: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    query[key] = Array.isArray(value) ? value.join(',') : (value as string | number | boolean);
  }
  return query;
}
