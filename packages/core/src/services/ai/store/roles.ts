import type { AiModelCapabilities, AiReasoningEffort, AiRole } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';

export interface RoleRow {
  role: AiRole;
  providerId: string;
  providerName: string;
  catalogId: string;
  model: string;
  reasoningEffort: AiReasoningEffort | null;
  maxOutputTokens: number | null;
  temperature: number | null;
  capabilities: AiModelCapabilities;
  deprecatedSuccessor: string | null;
  deprecatedAt: string | null;
  updatedAt: string;
}

interface RawRole {
  role: AiRole;
  provider_id: string;
  provider_name: string;
  catalog_id: string;
  model: string;
  reasoning_effort: AiReasoningEffort | null;
  max_output_tokens: number | null;
  temperature: string | number | null;
  capabilities: AiModelCapabilities;
  deprecated_successor: string | null;
  deprecated_at: string | Date | null;
  updated_at: string | Date;
}

function toRow(raw: RawRole): RoleRow {
  return {
    role: raw.role,
    providerId: raw.provider_id,
    providerName: raw.provider_name,
    catalogId: raw.catalog_id,
    model: raw.model,
    reasoningEffort: raw.reasoning_effort,
    maxOutputTokens: raw.max_output_tokens,
    temperature: raw.temperature === null ? null : Number(raw.temperature),
    capabilities: raw.capabilities,
    deprecatedSuccessor: raw.deprecated_successor,
    deprecatedAt: raw.deprecated_at ? new Date(raw.deprecated_at).toISOString() : null,
    updatedAt: new Date(raw.updated_at).toISOString(),
  };
}

export async function listRoles(sql: SqlExecutor): Promise<RoleRow[]> {
  const rows = await sql<RawRole[]>`
    select r.*, p.name as provider_name, p.catalog_id
    from ai_model_roles r join ai_providers p on p.id = r.provider_id
    order by r.role`;
  return rows.map(toRow);
}

export interface RoleWrite {
  role: AiRole;
  providerId: string;
  model: string;
  reasoningEffort: AiReasoningEffort | null;
  maxOutputTokens: number | null;
  temperature: number | null;
  capabilities: AiModelCapabilities;
  updatedBy: string | null;
}

export async function upsertRole(sql: SqlExecutor, write: RoleWrite): Promise<void> {
  await sql`
    insert into ai_model_roles (role, provider_id, model, reasoning_effort, max_output_tokens,
      temperature, capabilities, updated_by)
    values (${write.role}, ${write.providerId}, ${write.model}, ${write.reasoningEffort},
      ${write.maxOutputTokens}, ${write.temperature}, ${JSON.stringify(write.capabilities)}::jsonb,
      ${write.updatedBy})
    on conflict (role) do update set provider_id = excluded.provider_id, model = excluded.model,
      reasoning_effort = excluded.reasoning_effort,
      max_output_tokens = excluded.max_output_tokens, temperature = excluded.temperature,
      capabilities = excluded.capabilities, updated_by = excluded.updated_by,
      deprecated_at = null, deprecated_successor = null, updated_at = now()`;
}

export async function deleteRole(sql: SqlExecutor, role: AiRole): Promise<boolean> {
  const rows = await sql`delete from ai_model_roles where role = ${role} returning id`;
  return rows.length > 0;
}

/** The refresh job marks a configured model the catalog now calls deprecated. */
export async function markDeprecated(
  sql: SqlExecutor,
  role: AiRole,
  successor: string | null,
): Promise<void> {
  await sql`
    update ai_model_roles set deprecated_at = coalesce(deprecated_at, now()),
      deprecated_successor = ${successor}
    where role = ${role}`;
}
