import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';
import { vi } from 'vitest';

export const actor = { kind: 'user' as const, id: '0199c0de-0000-7000-8000-000000000001' };

export function contextWhere(
  allowed: boolean,
): RequestContext & { authorize: ReturnType<typeof vi.fn> } {
  const authorize = vi.fn(async () => {
    if (!allowed) throw new ForbiddenError('No');
  });
  return { actor, authorize, authz: { authorize } as never };
}

export interface FakeSql {
  client: SqlClient;
  /** Every statement sent, with its tagged-template text joined by "?" placeholders. */
  statements: string[];
}

/**
 * A postgres.js look-alike: each call to the tag answers with the next
 * queued result, so a unit test scripts what the database says without a
 * database. `begin` runs its callback on the same fake, as a transaction would.
 */
export function fakeSql(results: unknown[][]): FakeSql {
  const statements: string[] = [];
  const queue = [...results];
  const isFragment = (value: unknown): value is { fragment: string } =>
    typeof value === 'object' && value !== null && 'fragment' in value;
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.raw
      .map((part, index) =>
        index < values.length
          ? part + (isFragment(values[index]) ? values[index].fragment : '?')
          : part,
      )
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    // A nested tag such as sql`and id > ${id}` is a fragment, not a statement.
    if (!/^(select|insert|update|delete|with)\b/i.test(text)) return { fragment: text };
    statements.push(text);
    return Promise.resolve(queue.shift() ?? []);
  };
  const client = Object.assign(tag, {
    unsafe: (text: string) => ({ fragment: text }),
    begin: async (work: (tx: unknown) => Promise<unknown>) => work(client),
  });
  return { client: client as unknown as SqlClient, statements };
}
