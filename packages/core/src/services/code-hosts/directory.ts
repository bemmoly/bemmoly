import { ProviderError } from '@bemmoly/shared';
import type { CodeHostClient } from '../../contracts/code-hosts.ts';
import type { CodeHostDirectory } from '../../modules/code.ts';
import { codeHostDriver } from './registry.ts';
import { addressPolicyFor, type CodeHostRuntime } from './runtime.ts';
import { connectionOf, type IntegrationRow } from './store.ts';
import type { CodeHostApi } from './types.ts';

/*
 * Which connected host covers a repository, and a client for it. An integration that names
 * the repository wins; otherwise a GitHub App installation (which covers the repositories it
 * was installed on, listed or not). Credentials are opened per call and never cached.
 */

function unsupported(label: string, what: string): never {
  throw new ProviderError(`${label} cannot ${what} through Bemmoly yet`);
}

export function clientOf(rt: CodeHostRuntime, row: IntegrationRow): CodeHostClient {
  const driver = codeHostDriver(row.kind);
  // One API per client: a GitHub App's installation token is fetched once and reused.
  let instance: CodeHostApi | null = null;
  const api = (): CodeHostApi =>
    (instance ??= driver.api(connectionOf(rt.secrets, row), {
      policy: addressPolicyFor(rt, row),
      ...(rt.fetch ? { fetch: rt.fetch } : {}),
    }));
  return {
    integrationId: row.id,
    hostKind: row.kind,
    reportCheck: (report) =>
      (api().reportCheck ?? unsupported(driver.label, 'report checks'))(report),
    reportDeployment: (report) =>
      (api().reportDeployment ?? unsupported(driver.label, 'report deployments'))(report),
    readFile: (repository, path, ref) =>
      (api().readFile ?? unsupported(driver.label, 'read files'))(repository, path, ref),
    listFiles: (repository, ref) =>
      (api().listFiles ?? unsupported(driver.label, 'list files'))(repository, ref),
    openPullRequest: (input) =>
      (api().openPullRequest ?? unsupported(driver.label, 'open pull requests'))(input),
  };
}

/** Installation tokens live an hour; a client is reused for less than that. */
const CLIENT_TTL_MS = 30 * 60_000;

export function createCodeHostDirectory(rt: CodeHostRuntime): CodeHostDirectory {
  const clients = new Map<string, { client: CodeHostClient; until: number }>();
  const cached = (row: IntegrationRow): CodeHostClient => {
    const key = `${row.id}:${new Date(row.updated_at).getTime()}`;
    const hit = clients.get(key);
    if (hit && hit.until > Date.now()) return hit.client;
    const client = clientOf(rt, row);
    clients.set(key, { client, until: Date.now() + CLIENT_TTL_MS });
    return client;
  };
  return {
    async clientFor(repository) {
      const rows = await rt.sql<IntegrationRow[]>`
        select * from integrations where enabled order by created_at`;
      const wanted = repository.toLowerCase();
      const named = rows.find((row) =>
        row.repositories.some((name) => name.toLowerCase() === wanted),
      );
      const app = rows.find((row) => row.kind === 'github' && row.auth_mode === 'app');
      const row = named ?? app;
      return row ? cached(row) : null;
    },
  };
}
