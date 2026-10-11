import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

/*
 * The load-test people and their secrets. The file lives outside the repository (the
 * scratchpad, a CI temp dir) with mode 0600, and k6 reads it with open(). Nothing in it is a
 * password: tokens and session cookies are minted here and only their sha256 reaches the
 * database, exactly as the server stores the ones it mints.
 */

/** Every person, project and space the harness creates carries this, so teardown finds them. */
export const LOAD_PREFIX = 'LOAD';
/** Email domain of the load-test people; `.test` is reserved and never routable. */
export const LOAD_EMAIL_DOMAIN = 'load.bemmoly.test';

const personSchema = z.object({
  email: z.string(),
  name: z.string(),
  /** A personal API token (bmy_…) with read and write scopes. */
  token: z.string(),
  /** A session cookie value, for the WebSocket routes that refuse API tokens. */
  session: z.string(),
});

export const credentialsSchema = z.object({
  createdAt: z.string(),
  admin: personSchema,
  users: z.array(personSchema).min(1),
});

export type Person = z.infer<typeof personSchema>;
export type Credentials = z.infer<typeof credentialsSchema>;

/** Same shape and entropy as the server's generateToken: 32 CSPRNG bytes, base64url. */
export const mintToken = (prefix = '') => `${prefix}${randomBytes(32).toString('base64url')}`;

/** What the server stores in place of a token: its sha256, hex encoded. */
export const digestToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export function makePerson(index: number | 'admin'): Person {
  const handle = index === 'admin' ? 'admin' : `user-${String(index).padStart(3, '0')}`;
  const name =
    index === 'admin'
      ? `${LOAD_PREFIX} Admin`
      : `${LOAD_PREFIX} User ${String(index).padStart(3, '0')}`;
  return {
    email: `load-${handle}@${LOAD_EMAIL_DOMAIN}`,
    name,
    token: mintToken('bmy_'),
    session: mintToken(),
  };
}

export function makeCredentials(users: number): Credentials {
  return {
    createdAt: new Date().toISOString(),
    admin: makePerson('admin'),
    users: Array.from({ length: users }, (_, i) => makePerson(i + 1)),
  };
}

export function readCredentials(path: string): Credentials {
  return credentialsSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

export function writeCredentials(path: string, credentials: Credentials): void {
  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}
