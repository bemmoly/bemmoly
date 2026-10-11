#!/usr/bin/env node
/**
 * Mints the load-test people: one org admin (seeding, imports, teardown) and N members (the
 * virtual users), each with a personal API token and a session cookie. Writes the secrets to
 * --out (mode 0600, keep it outside the repository) and prints SQL for psql on the install:
 *
 *   node perf/src/provision.ts --users 200 --out /secure/load-credentials.json \
 *     | ssh host sudo bemmoly shell db
 *
 * Tokens are created server side because the API mints them only from a signed-in session,
 * and sessions because /collab accepts only a cookie. Undo with perf/sql/teardown.sql.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  digestToken,
  makeCredentials,
  writeCredentials,
  type Credentials,
  type Person,
} from './lib/credentials.ts';

const VISIBLE_TOKEN_CHARS = 12;

interface ProvisionRow {
  email: string;
  name: string;
  role: string;
  token_hash: string;
  token_prefix: string;
  session_hash: string;
}

const rowOf = (person: Person, role: string): ProvisionRow => ({
  email: person.email,
  name: person.name,
  role,
  token_hash: digestToken(person.token),
  token_prefix: person.token.slice(0, VISIBLE_TOKEN_CHARS),
  session_hash: digestToken(person.session),
});

/** The psql script: the people as one JSON variable, then the static provision.sql. */
export function provisionScript(credentials: Credentials, body: string): string {
  const rows = [
    rowOf(credentials.admin, 'org_admin'),
    ...credentials.users.map((person) => rowOf(person, 'member')),
  ];
  const json = JSON.stringify(rows);
  // psql's quoted \set value: refuse anything that could end the literal early.
  if (/['\\\n]/.test(json)) throw new Error('A name or email holds a quote or backslash');
  return `\\set people '${json}'\n${body}`;
}

function main() {
  const { values } = parseArgs({
    options: {
      users: { type: 'string', default: '200' },
      out: { type: 'string' },
    },
  });
  if (!values.out) throw new Error('--out <credentials.json> is required');
  const users = Number(values.users);
  if (!Number.isInteger(users) || users < 1 || users > 1000) {
    throw new Error('--users must be between 1 and 1000');
  }
  const credentials = makeCredentials(users);
  writeCredentials(values.out, credentials);
  const body = readFileSync(new URL('../sql/provision.sql', import.meta.url), 'utf8');
  process.stdout.write(provisionScript(credentials, body));
}

if (import.meta.main) main();
