import {
  ValidationError,
  type CodeHostCredentialsInput,
  type CodeHostKind,
  type CreateCodeHost,
  type UpdateCodeHost,
} from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';
import type { SecretBox } from '../settings/index.ts';
import { openHostSecrets, sealHostSecrets, type IntegrationRow } from './store.ts';
import type { HostSecrets } from './types.ts';

/** The columns a create or an update writes; secrets arrive already merged and sealed. */
interface IntegrationColumns {
  name: string;
  baseUrl: string | null;
  authMode: 'app' | 'token';
  appId: string | null;
  installationId: string | null;
  repositories: string[];
  enabled: boolean;
  sealed: string;
}

const missing = (what: string) =>
  new ValidationError(`Add the ${what}`, { details: { field: 'credentials' } });

/**
 * The secrets to store: what the form sent, and what is already stored for anything it left
 * out. Switching between an app and a token needs the new secret; it is never carried over.
 */
export function mergeSecrets(
  kind: CodeHostKind,
  credentials: CodeHostCredentialsInput,
  webhookSecret: string | undefined,
  previous: (HostSecrets & { mode: 'app' | 'token' }) | null,
): HostSecrets {
  if (kind === 'gitlab' && credentials.mode === 'app') {
    throw new ValidationError('GitLab connects with a project or group access token');
  }
  const sameMode = previous?.mode === credentials.mode;
  const secret = webhookSecret ?? previous?.webhookSecret;
  if (!secret) throw missing('webhook secret');
  if (credentials.mode === 'token') {
    const token = credentials.token ?? (sameMode ? previous?.token : undefined);
    if (!token) throw missing(kind === 'gitlab' ? 'access token' : 'token');
    return { webhookSecret: secret, token };
  }
  const privateKey = credentials.privateKey ?? (sameMode ? previous?.privateKey : undefined);
  if (!privateKey) throw missing("app's private key");
  return { webhookSecret: secret, privateKey };
}

const appIds = (credentials: CodeHostCredentialsInput) =>
  credentials.mode === 'app'
    ? { appId: credentials.appId, installationId: credentials.installationId }
    : { appId: null, installationId: null };

export function createColumns(
  box: SecretBox,
  id: string,
  body: CreateCodeHost,
): IntegrationColumns {
  const secrets = mergeSecrets(body.kind, body.credentials, body.webhookSecret, null);
  return {
    name: body.name,
    baseUrl: body.baseUrl,
    authMode: body.credentials.mode,
    ...appIds(body.credentials),
    repositories: body.repositories,
    enabled: body.enabled,
    sealed: sealHostSecrets(box, id, secrets),
  };
}

export function updateColumns(
  box: SecretBox,
  row: IntegrationRow,
  body: UpdateCodeHost,
): IntegrationColumns {
  const stored = { ...openHostSecrets(box, row), mode: row.auth_mode };
  const credentials: CodeHostCredentialsInput =
    body.credentials ??
    (row.auth_mode === 'app'
      ? { mode: 'app', appId: row.app_id ?? '', installationId: row.installation_id ?? '' }
      : { mode: 'token' });
  const secrets = mergeSecrets(row.kind, credentials, body.webhookSecret, stored);
  return {
    name: body.name ?? row.name,
    baseUrl: body.baseUrl === undefined ? row.base_url : body.baseUrl,
    authMode: credentials.mode,
    ...appIds(credentials),
    repositories: body.repositories ?? row.repositories,
    enabled: body.enabled ?? row.enabled,
    sealed: sealHostSecrets(box, row.id, secrets),
  };
}

export async function insertIntegration(
  sql: SqlExecutor,
  id: string,
  kind: CodeHostKind,
  columns: IntegrationColumns,
  createdBy: string | null,
): Promise<void> {
  await sql`
    insert into integrations (id, kind, name, base_url, auth_mode, app_id, installation_id,
      repositories, secrets_encrypted, enabled, created_by)
    values (${id}, ${kind}, ${columns.name}, ${columns.baseUrl}, ${columns.authMode},
      ${columns.appId}, ${columns.installationId}, ${columns.repositories}::text[],
      ${columns.sealed}, ${columns.enabled}, ${createdBy})`;
}

export async function updateIntegration(
  sql: SqlExecutor,
  id: string,
  columns: IntegrationColumns,
): Promise<void> {
  await sql`
    update integrations set name = ${columns.name}, base_url = ${columns.baseUrl},
      auth_mode = ${columns.authMode}, app_id = ${columns.appId},
      installation_id = ${columns.installationId},
      repositories = ${columns.repositories}::text[], secrets_encrypted = ${columns.sealed},
      enabled = ${columns.enabled}, updated_at = now()
    where id = ${id}`;
}
