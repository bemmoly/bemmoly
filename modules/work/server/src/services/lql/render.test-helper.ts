import { createSqlClient, type SqlClient, type SqlFragment } from '@bemmoly/core';

/*
 * Test-only. Walks a postgres.js fragment the way the driver does at execution
 * time, so unit tests can assert the statement text and the parameter list
 * without a database: nested fragments inline, every value becomes $n.
 */

interface Rendered {
  text: string;
  params: unknown[];
}

interface QueryShape {
  strings: readonly string[];
  args: readonly unknown[];
}

const isFragment = (value: unknown): value is QueryShape =>
  typeof value === 'object' && value !== null && 'strings' in value && 'args' in value;

function walk(fragment: QueryShape, params: unknown[]): string {
  let text = fragment.strings[0] ?? '';
  for (let index = 1; index < fragment.strings.length; index++) {
    const arg = fragment.args[index - 1];
    if (isFragment(arg)) {
      text += walk(arg, params);
    } else {
      params.push(arg);
      text += `$${params.length}`;
    }
    text += fragment.strings[index] ?? '';
  }
  return text;
}

export function render(fragment: SqlFragment): Rendered {
  const params: unknown[] = [];
  const text = walk(fragment as unknown as QueryShape, params)
    .replace(/\s+/g, ' ')
    .trim();
  return { text, params };
}

/** A client that builds fragments and never connects. */
export function unitSql(): SqlClient {
  return createSqlClient('postgres://unit@localhost:1/unit', { maxConnections: 1 });
}
