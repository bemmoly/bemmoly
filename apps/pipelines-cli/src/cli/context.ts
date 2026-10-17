import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import type { CliEnv } from '../config/env.ts';
import { createHttp, type Http } from '../clients/http.ts';
import { createPipelinesClient, type PipelinesClient } from '../clients/pipelines.ts';
import { loadCredentials, type Credentials } from '../services/credentials.ts';
import { usageError } from './errors.ts';
import type { Output } from './output.ts';

/** Everything a command touches outside itself, so tests hand in fakes. */
export interface Context {
  env: CliEnv;
  output: Output;
  fetch?: typeof fetch;
  sleep(ms: number): Promise<void>;
  now(): number;
  hostname: string;
  readFile(path: string): Promise<string>;
}

export function defaultContext(env: CliEnv, output: Output): Context {
  return {
    env,
    output,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    hostname: hostname(),
    readFile: (path) => readFile(path, 'utf8'),
  };
}

/** Flags every command that talks to a server accepts. */
export const SERVER_FLAGS = {
  server: { type: 'string' },
  token: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

export function parse<const O extends NonNullable<ParseArgsConfig['options']>>(
  argv: readonly string[],
  options: O,
) {
  try {
    return parseArgs({ args: [...argv], options, allowPositionals: true, strict: true });
  } catch (error) {
    throw usageError((error as Error).message.replace(/^TypeError \[[A-Z_]+\]: /, ''));
  }
}

export interface Connection {
  http: Http;
  client: PipelinesClient;
  server: string;
  credentials: Credentials | null;
}

/**
 * The server and token, from flags, then the environment, then the stored sign-in. A stored
 * token is only sent to the server it was issued by.
 */
export async function connect(
  ctx: Context,
  flags: { server?: string | undefined; token?: string | undefined },
  options: { requireToken?: boolean } = {},
): Promise<Connection> {
  const credentials = await loadCredentials(ctx.env.configDir);
  const server = flags.server ?? ctx.env.BEMMOLY_PIPELINES_URL ?? credentials?.server;
  if (!server) {
    throw usageError(
      'Name the server with --server, set BEMMOLY_PIPELINES_URL, or run "bp login".',
    );
  }
  const stored =
    credentials && sameServer(credentials.server, server) ? credentials.token : undefined;
  const token = flags.token ?? ctx.env.BEMMOLY_PIPELINES_TOKEN ?? stored;
  if (!token && options.requireToken !== false) {
    throw usageError(`Sign in to ${server} with "bp login", or pass --token.`);
  }
  const http = createHttp({ baseUrl: server, token, ...(ctx.fetch ? { fetch: ctx.fetch } : {}) });
  return { http, client: createPipelinesClient(http), server, credentials };
}

export function sameServer(a: string, b: string): boolean {
  const normalise = (url: string) => url.replace(/\/+$/, '').toLowerCase();
  return normalise(a) === normalise(b);
}

/** `--input k=v` (repeatable) into a record; values stay strings and the server checks types. */
export function keyValues(
  pairs: readonly string[] | undefined,
  flag: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of pairs ?? []) {
    const at = pair.indexOf('=');
    if (at <= 0) throw usageError(`${flag} takes name=value, got "${pair}"`);
    result[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return result;
}
