import {
  AI_ROLES,
  NotFoundError,
  ValidationError,
  type AiModelCapabilities,
  type AiModelRole,
  type AiModelRoleBody,
  type AiModelRolesResponse,
  type AiRole,
} from '@bemmoly/shared';
import type { Actor } from '../../../contracts/authz.ts';
import { capabilitiesOf, eligibleRoles, modelsOf } from '../catalog/overrides.ts';
import type { ProviderRow } from '../store/providers.ts';
import { deleteRole, listRoles, upsertRole, type RoleRow } from '../store/roles.ts';
import { announceChange, authorizeAdmin, userIdOf, type AiServiceContext } from './context.ts';
import { requireProvider } from './providers.ts';

function toApiRole(row: RoleRow, paused: readonly AiRole[]): AiModelRole {
  return {
    role: row.role,
    providerId: row.providerId,
    providerName: row.providerName,
    model: row.model,
    reasoningEffort: row.reasoningEffort,
    maxOutputTokens: row.maxOutputTokens,
    temperature: row.temperature,
    capabilities: row.capabilities,
    deprecation: row.deprecatedAt ? { successor: row.deprecatedSuccessor } : null,
    paused: paused.includes(row.role),
    updatedAt: row.updatedAt,
  };
}

export async function listAiRoles(
  ctx: AiServiceContext,
  actor: Actor,
): Promise<AiModelRolesResponse> {
  await authorizeAdmin(ctx, actor);
  const [rows, budget] = await Promise.all([listRoles(ctx.sql), ctx.policy.budget()]);
  const byRole = new Map(rows.map((row) => [row.role, row]));
  return {
    items: AI_ROLES.map((role) => {
      const row = byRole.get(role);
      return { role, assignment: row ? toApiRole(row, budget.pausedRoles) : null };
    }),
  };
}

/** A custom endpoint's model as the probe found it. */
function customCapabilities(
  provider: ProviderRow,
  modelId: string,
  role: AiRole,
): AiModelCapabilities {
  const model = provider.models.find((entry) => entry.id === modelId);
  return {
    toolCall: model?.toolCall ?? false,
    structuredOutput: model?.structuredOutput ?? false,
    reasoning: false,
    attachment: false,
    temperature: true,
    contextWindow: model?.contextWindow ?? null,
    maxOutput: null,
    inputModalities: ['text'],
    outputModalities: [role === 'embedding' ? 'embedding' : 'text'],
    cost: null,
    dimensions: null,
    status: null,
    releaseDate: null,
  };
}

/** The capabilities snapshot copied onto the role, after checking the model fits it. */
async function snapshotFor(
  ctx: AiServiceContext,
  provider: ProviderRow,
  role: AiRole,
  modelId: string,
): Promise<AiModelCapabilities> {
  if (provider.protocol) {
    const known = provider.models.find((entry) => entry.id === modelId);
    if (provider.models.length && !known) {
      throw new ValidationError(
        `${provider.name} did not list "${modelId}"; discover its models again`,
      );
    }
    if (known && (role === 'embedding') !== known.embedding) {
      throw new ValidationError(`"${modelId}" cannot fill the ${role} role`);
    }
    if (role === 'strong' && known?.toolCall === false) {
      throw new ValidationError(
        `"${modelId}" did not call tools when probed; the strong role plans with tools`,
      );
    }
    return customCapabilities(provider, modelId, role);
  }
  const entry = (await ctx.catalog.cached())[provider.catalogId];
  const model = entry && modelsOf(entry).find((candidate) => candidate.id === modelId);
  if (!entry || !model) {
    throw new ValidationError(`The catalog has no model "${modelId}" for ${provider.name}`);
  }
  if (!eligibleRoles(model).includes(role)) {
    throw new ValidationError(
      role === 'strong'
        ? `"${model.name}" cannot call tools, which the strong role needs for plans`
        : `"${model.name}" cannot fill the ${role} role`,
    );
  }
  return capabilitiesOf(entry.id, model);
}

export async function putAiRole(
  ctx: AiServiceContext,
  actor: Actor,
  role: AiRole,
  body: AiModelRoleBody,
): Promise<AiModelRole> {
  await authorizeAdmin(ctx, actor);
  const provider = await requireProvider(ctx, body.providerId);
  const capabilities = await snapshotFor(ctx, provider, role, body.model);
  if (body.reasoningEffort && !capabilities.reasoning && !provider.protocol) {
    throw new ValidationError('This model has no reasoning effort setting');
  }
  await upsertRole(ctx.sql, {
    role,
    providerId: provider.id,
    model: body.model,
    reasoningEffort: body.reasoningEffort,
    maxOutputTokens: body.maxOutputTokens,
    temperature: body.temperature,
    capabilities,
    updatedBy: userIdOf(actor),
  });
  await announceChange(ctx, actor, role === 'embedding' ? ['roles', 'embedding_role'] : ['roles']);
  const row = (await listRoles(ctx.sql)).find((entry) => entry.role === role)!;
  return toApiRole(row, (await ctx.policy.budget()).pausedRoles);
}

export async function deleteAiRole(
  ctx: AiServiceContext,
  actor: Actor,
  role: AiRole,
): Promise<void> {
  await authorizeAdmin(ctx, actor);
  if (!(await deleteRole(ctx.sql, role))) throw new NotFoundError(`No model is set for ${role}`);
  await announceChange(ctx, actor, role === 'embedding' ? ['roles', 'embedding_role'] : ['roles']);
}
