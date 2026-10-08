/**
 * A scripted stand-in for the postgres.js client, for unit tests of the
 * services beside it. Each tagged call becomes one statement; the test
 * answers statements by regex over their text. Fragments passed as values
 * are inlined so `where ... ${sql\`and x\`}` reads as one statement, and
 * `begin` runs the callback against the same fake. Test-only; not exported.
 */
import type { SqlClient } from '@bemmoly/core';

export interface Statement {
  text: string;
  values: unknown[];
}

type Responder = (statement: Statement) => unknown[] | Promise<unknown[]>;

export interface FakeSql {
  client: SqlClient;
  statements: Statement[];
  /** Answers every later statement whose text matches `pattern`; last registration wins. */
  on(pattern: RegExp, rows: unknown[] | Responder): void;
}

const FRAGMENT = Symbol('fragment');

interface Fragment {
  [FRAGMENT]: true;
  text: string;
  values: unknown[];
}

function isFragment(value: unknown): value is Fragment {
  return typeof value === 'object' && value !== null && FRAGMENT in value;
}

function compose(strings: TemplateStringsArray, values: unknown[]): Statement {
  let text = '';
  const bound: unknown[] = [];
  strings.forEach((part, index) => {
    text += part;
    if (index >= values.length) return;
    const value = values[index];
    if (isFragment(value)) {
      text += value.text;
      bound.push(...value.values);
    } else {
      text += `$${bound.length + 1}`;
      bound.push(value);
    }
  });
  return { text: text.replace(/\s+/g, ' ').trim(), values: bound };
}

export function fakeSql(): FakeSql {
  const statements: Statement[] = [];
  const responders: { pattern: RegExp; respond: Responder }[] = [];

  const answer = async (statement: Statement): Promise<unknown[]> => {
    statements.push(statement);
    for (let i = responders.length - 1; i >= 0; i--) {
      const entry = responders[i];
      if (entry?.pattern.test(statement.text)) return entry.respond(statement);
    }
    throw new Error(`No fake response for: ${statement.text}`);
  };

  const fragment = (text: string, values: unknown[] = []): Fragment => ({
    [FRAGMENT]: true,
    text,
    values,
  });

  const tagged = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === 'string') return fragment(`"${strings}"`);
    const statement = compose(strings, values);
    const pending: Promise<unknown[]> & Partial<Fragment> = Object.assign(
      new Promise<unknown[]>((resolve, reject) => {
        queueMicrotask(() => {
          if (!awaited) return resolve([]);
          answer(statement).then(resolve, reject);
        });
      }),
      { [FRAGMENT]: true as const, text: statement.text, values: statement.values },
    );
    let awaited = false;
    const originalThen = pending.then.bind(pending);
    pending.then = ((onFulfilled, onRejected) => {
      awaited = true;
      return originalThen(onFulfilled, onRejected);
    }) as typeof pending.then;
    return pending;
  };

  const client = Object.assign(tagged, {
    begin: async (first: unknown, second?: unknown) => {
      const work = (typeof first === 'function' ? first : second) as (tx: unknown) => unknown;
      return work(client);
    },
    end: async () => undefined,
    unsafe: (text: string) => fragment(text.replace(/\s+/g, ' ').trim()),
  }) as unknown as SqlClient;

  return {
    client,
    statements,
    on(pattern, rows) {
      responders.push({ pattern, respond: Array.isArray(rows) ? () => rows : rows });
    },
  };
}
