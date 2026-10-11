import {
  NotFoundError,
  type CodeDeliveryOutcome,
  type CodeHost,
  type CodeHostDelivery,
  type CodeHostKind,
} from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { appLink } from '../identity/index.ts';
import type { SecretBox } from '../settings/index.ts';
import type { HostConnection, HostSecrets } from './types.ts';

export interface IntegrationRow {
  id: string;
  kind: CodeHostKind;
  name: string;
  base_url: string | null;
  auth_mode: 'app' | 'token';
  app_id: string | null;
  installation_id: string | null;
  repositories: string[];
  secrets_encrypted: string;
  enabled: boolean;
  last_error: string | null;
  last_error_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryRow {
  id: string;
  integration_id: string;
  event: string;
  action: string | null;
  outcome: CodeDeliveryOutcome;
  summary: string;
  error: string | null;
  received_at: Date;
}

/** Deliveries older than this leave the log; it explains recent behaviour, nothing more. */
const DELIVERY_RETENTION = '30 days';
export const WEBHOOK_PATH = (id: string) => `/api/v1/code-hosts/${id}/webhooks`;

/** Bound as associated data, so a sealed value cannot be moved to another row. */
const secretsContext = (id: string) => `integrations.secrets:${id}`;

export const sealHostSecrets = (box: SecretBox, id: string, secrets: HostSecrets): string =>
  box.seal(JSON.stringify(secrets), secretsContext(id));

export const openHostSecrets = (box: SecretBox, row: IntegrationRow): HostSecrets =>
  JSON.parse(box.open(row.secrets_encrypted, secretsContext(row.id))) as HostSecrets;

export const connectionOf = (box: SecretBox, row: IntegrationRow): HostConnection => ({
  baseUrl: row.base_url,
  authMode: row.auth_mode,
  appId: row.app_id,
  installationId: row.installation_id,
  secrets: openHostSecrets(box, row),
});

export async function newIntegrationId(sql: SqlExecutor): Promise<string> {
  const [row] = await sql<{ id: string }[]>`select uuidv7() as id`;
  if (!row) throw new Error('uuidv7() returned nothing');
  return row.id;
}

export async function integrationById(sql: SqlExecutor, id: string): Promise<IntegrationRow> {
  const [row] = await sql<IntegrationRow[]>`select * from integrations where id = ${id}`;
  if (!row) throw new NotFoundError('The code host is not connected');
  return row;
}

export async function lastDeliveries(
  sql: SqlExecutor,
  ids: readonly string[],
): Promise<Map<string, DeliveryRow>> {
  if (ids.length === 0) return new Map();
  const rows = await sql<DeliveryRow[]>`
    select distinct on (integration_id) * from integration_deliveries
    where integration_id = any(${ids as string[]}::uuid[])
    order by integration_id, received_at desc, id desc`;
  return new Map(rows.map((row) => [row.integration_id, row]));
}

export async function recentDeliveries(
  sql: SqlExecutor,
  id: string,
  limit: number,
): Promise<DeliveryRow[]> {
  return sql<DeliveryRow[]>`
    select * from integration_deliveries where integration_id = ${id}
    order by received_at desc, id desc limit ${limit}`;
}

/**
 * Records a delivery once; null when this delivery id was already recorded (a redelivery).
 * A delivery that failed is claimed again, so the host's retry can repair it.
 */
export async function claimDelivery(
  sql: SqlExecutor,
  input: { integrationId: string; deliveryId: string; event: string; action: string | null },
): Promise<string | null> {
  const [row] = await sql<{ id: string }[]>`
    insert into integration_deliveries (integration_id, delivery_id, event, action, outcome)
    values (${input.integrationId}, ${input.deliveryId}, ${input.event}, ${input.action}, 'processed')
    on conflict (integration_id, delivery_id) do update
      set outcome = 'processed', event = excluded.event, action = excluded.action, error = null,
        received_at = now(), updated_at = now()
      where integration_deliveries.outcome = 'failed'
    returning id`;
  if (row) {
    await sql`delete from integration_deliveries where integration_id = ${input.integrationId}
      and received_at < now() - ${DELIVERY_RETENTION}::interval`;
  }
  return row?.id ?? null;
}

export async function finishDelivery(
  sql: SqlExecutor,
  id: string,
  result: { outcome: CodeDeliveryOutcome; summary: string; error?: string | null },
): Promise<void> {
  await sql`update integration_deliveries set outcome = ${result.outcome},
      summary = ${result.summary.slice(0, 500)}, error = ${result.error?.slice(0, 500) ?? null},
      updated_at = now()
    where id = ${id}`;
}

/** A refused or failed delivery shows on the host's card until a good one clears it. */
export async function noteHostError(
  sql: SqlExecutor,
  id: string,
  error: string | null,
): Promise<void> {
  await sql`update integrations set last_error = ${error},
      last_error_at = case when ${error}::text is null then null else now() end
    where id = ${id} and (last_error is distinct from ${error})`;
}

export const toDelivery = (row: DeliveryRow): CodeHostDelivery => ({
  id: row.id,
  event: row.event,
  action: row.action,
  outcome: row.outcome,
  summary: row.summary,
  error: row.error,
  receivedAt: new Date(row.received_at).toISOString(),
});

export function toCodeHost(
  row: IntegrationRow,
  secrets: HostSecrets,
  publicUrl: string,
  last: DeliveryRow | undefined,
): CodeHost {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    baseUrl: row.base_url,
    webhookUrl: appLink(publicUrl, WEBHOOK_PATH(row.id)),
    authMode: row.auth_mode,
    appId: row.app_id,
    installationId: row.installation_id,
    hasCredentials: Boolean(row.auth_mode === 'app' ? secrets.privateKey : secrets.token),
    hasWebhookSecret: secrets.webhookSecret.length > 0,
    repositories: row.repositories,
    enabled: row.enabled,
    lastDelivery: last ? toDelivery(last) : null,
    lastError: row.last_error,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
