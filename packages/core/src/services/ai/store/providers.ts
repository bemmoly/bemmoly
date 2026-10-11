import type { AiCustomProtocol, AiDiscoveredModel, AiProviderStatus } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { SecretBox } from '../../settings/index.ts';

/** A provider row with its secrets still sealed. */
export interface ProviderRow {
  id: string;
  catalogId: string;
  protocol: AiCustomProtocol | null;
  name: string;
  baseUrl: string | null;
  credentialNames: string[];
  headerNames: string[];
  models: AiDiscoveredModel[];
  isDefault: boolean;
  status: AiProviderStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  credentialsSealed: string | null;
  headersSealed: string | null;
}

interface RawProvider {
  id: string;
  catalog_id: string;
  protocol: AiCustomProtocol | null;
  name: string;
  base_url: string | null;
  credential_names: string[];
  header_names: string[];
  models: AiDiscoveredModel[];
  is_default: boolean;
  status: AiProviderStatus;
  last_checked_at: string | Date | null;
  last_error: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  credentials_encrypted: string | null;
  headers_encrypted: string | null;
}

const iso = (value: string | Date) => new Date(value).toISOString();

function toRow(raw: RawProvider): ProviderRow {
  return {
    id: raw.id,
    catalogId: raw.catalog_id,
    protocol: raw.protocol,
    name: raw.name,
    baseUrl: raw.base_url,
    credentialNames: raw.credential_names,
    headerNames: raw.header_names,
    models: raw.models,
    isDefault: raw.is_default,
    status: raw.status,
    lastCheckedAt: raw.last_checked_at ? iso(raw.last_checked_at) : null,
    lastError: raw.last_error,
    createdAt: iso(raw.created_at),
    updatedAt: iso(raw.updated_at),
    credentialsSealed: raw.credentials_encrypted,
    headersSealed: raw.headers_encrypted,
  };
}

/** The associated data a provider's secrets are sealed with: rows cannot be swapped. */
const contextOf = (id: string, part: 'credentials' | 'headers') => `ai_providers:${id}:${part}`;

export function sealSecrets(
  box: SecretBox,
  id: string,
  part: 'credentials' | 'headers',
  values: Readonly<Record<string, string>>,
): string | null {
  return Object.keys(values).length === 0
    ? null
    : box.seal(JSON.stringify(values), contextOf(id, part));
}

export function openSecrets(
  box: SecretBox,
  id: string,
  part: 'credentials' | 'headers',
  sealed: string | null,
): Record<string, string> {
  return sealed
    ? (JSON.parse(box.open(sealed, contextOf(id, part))) as Record<string, string>)
    : {};
}

export async function listProviders(sql: SqlExecutor): Promise<ProviderRow[]> {
  const rows = await sql<RawProvider[]>`select * from ai_providers order by created_at, id`;
  return rows.map(toRow);
}

export async function findProvider(sql: SqlExecutor, id: string): Promise<ProviderRow | null> {
  const [row] = await sql<RawProvider[]>`select * from ai_providers where id = ${id}`;
  return row ? toRow(row) : null;
}

export interface ProviderWrite {
  id: string;
  catalogId: string;
  protocol: AiCustomProtocol | null;
  name: string;
  baseUrl: string | null;
  credentialNames: string[];
  credentialsSealed: string | null;
  headerNames: string[];
  headersSealed: string | null;
  models: AiDiscoveredModel[];
  isDefault: boolean;
  createdBy: string | null;
}

export async function insertProvider(sql: SqlExecutor, write: ProviderWrite): Promise<void> {
  if (write.isDefault) await sql`update ai_providers set is_default = false where is_default`;
  await sql`
    insert into ai_providers (id, catalog_id, protocol, name, base_url, credentials_encrypted,
      credential_names, headers_encrypted, header_names, models, is_default, created_by)
    values (${write.id}, ${write.catalogId}, ${write.protocol}, ${write.name}, ${write.baseUrl},
      ${write.credentialsSealed}, ${write.credentialNames}, ${write.headersSealed},
      ${write.headerNames}, ${JSON.stringify(write.models)}::jsonb, ${write.isDefault},
      ${write.createdBy})`;
}

export async function updateProvider(
  sql: SqlExecutor,
  id: string,
  write: Omit<ProviderWrite, 'id' | 'catalogId' | 'protocol' | 'createdBy'>,
): Promise<void> {
  if (write.isDefault) {
    await sql`update ai_providers set is_default = false where is_default and id <> ${id}`;
  }
  await sql`
    update ai_providers set name = ${write.name}, base_url = ${write.baseUrl},
      credentials_encrypted = ${write.credentialsSealed},
      credential_names = ${write.credentialNames}, headers_encrypted = ${write.headersSealed},
      header_names = ${write.headerNames}, models = ${JSON.stringify(write.models)}::jsonb,
      is_default = ${write.isDefault}, status = 'unchecked', updated_at = now()
    where id = ${id}`;
}

export async function recordCheck(
  sql: SqlExecutor,
  id: string,
  check: { ok: boolean; error: string | null; models?: AiDiscoveredModel[] },
): Promise<void> {
  const models = check.models ? JSON.stringify(check.models) : null;
  await sql`
    update ai_providers set status = ${check.ok ? 'ok' : 'failed'}, last_error = ${check.error},
      last_checked_at = now(), models = coalesce(${models}::jsonb, models), updated_at = now()
    where id = ${id}`;
}

export async function deleteProvider(sql: SqlExecutor, id: string): Promise<boolean> {
  const rows = await sql`delete from ai_providers where id = ${id} returning id`;
  return rows.length > 0;
}

export async function countProviders(sql: SqlExecutor): Promise<number> {
  const [row] = await sql<{ count: number }[]>`select count(*)::int as count from ai_providers`;
  return row?.count ?? 0;
}
