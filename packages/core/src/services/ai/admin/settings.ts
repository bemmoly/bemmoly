import type {
  AiExclusionTargetsResponse,
  AiSettingsResponse,
  AiSettingsUpdateBody,
  AiUsageResponse,
} from '@bemmoly/shared';
import type { Actor } from '../../../contracts/authz.ts';
import type { SettingKey, SettingsKeys } from '../../../contracts/settings.ts';
import { usageInMonth } from '../store/runs.ts';
import {
  announceChange,
  authorizeAdmin,
  type AiChangeReason,
  type AiServiceContext,
} from './context.ts';

/** The settings keys behind each privacy field. */
const PRIVACY_KEYS = {
  enabled: 'ai.enabled',
  shareContent: 'ai.shareContent',
  redactEmails: 'ai.redactEmails',
  redactNames: 'ai.redactNames',
  excludedSpaceIds: 'ai.excludedSpaceIds',
  excludedProjectIds: 'ai.excludedProjectIds',
  allowActions: 'ai.allowActions',
  perUserOptOutAllowed: 'ai.perUserOptOutAllowed',
} as const satisfies Record<string, SettingKey>;

type PrivacyField = keyof typeof PRIVACY_KEYS;

export async function readAiSettings(ctx: AiServiceContext): Promise<AiSettingsResponse> {
  const get = <K extends SettingKey>(key: K) => ctx.settings.get(key);
  const fields = Object.keys(PRIVACY_KEYS) as PrivacyField[];
  const values = await Promise.all(fields.map((field) => get(PRIVACY_KEYS[field])));
  const privacy = Object.fromEntries(fields.map((field, i) => [field, values[i]]));
  const [providerChoice, monthlyBudgetUsd, liveCatalog] = await Promise.all([
    get('ai.providerId'),
    get('ai.monthlyBudgetUsd'),
    get('ai.liveCatalog'),
  ]);
  return {
    providerChoice,
    privacy: privacy as AiSettingsResponse['privacy'],
    budget: { monthlyBudgetUsd },
    liveCatalog,
  };
}

export async function getAiSettings(
  ctx: AiServiceContext,
  actor: Actor,
): Promise<AiSettingsResponse> {
  await authorizeAdmin(ctx, actor);
  return readAiSettings(ctx);
}

export async function updateAiSettings(
  ctx: AiServiceContext,
  actor: Actor,
  body: AiSettingsUpdateBody,
): Promise<AiSettingsResponse> {
  await authorizeAdmin(ctx, actor);
  const reasons = new Set<AiChangeReason>();
  const set = async <K extends SettingKey>(key: K, value: SettingsKeys[K]) => {
    await ctx.settings.set(key, value, actor);
  };
  for (const [field, value] of Object.entries(body.privacy ?? {}) as [PrivacyField, never][]) {
    if (value === undefined) continue;
    await set(PRIVACY_KEYS[field], value);
    reasons.add(field === 'enabled' ? 'enabled' : 'privacy');
  }
  if (body.budget) {
    await set('ai.monthlyBudgetUsd', body.budget.monthlyBudgetUsd);
    reasons.add('privacy');
  }
  if (body.liveCatalog !== undefined) await set('ai.liveCatalog', body.liveCatalog);
  if (reasons.size) await announceChange(ctx, actor, [...reasons]);
  return readAiSettings(ctx);
}

export async function getAiUsage(
  ctx: AiServiceContext,
  actor: Actor,
  query: { month?: string | undefined },
): Promise<AiUsageResponse> {
  await authorizeAdmin(ctx, actor);
  const [usage, budget] = await Promise.all([
    usageInMonth(ctx.sql, query.month),
    ctx.policy.budget(query.month),
  ]);
  return { budget, ...usage };
}

/** Spaces and projects Privacy can exclude, as the enabled modules list them. */
export async function listExclusionTargets(
  ctx: AiServiceContext,
  actor: Actor,
): Promise<AiExclusionTargetsResponse> {
  await authorizeAdmin(ctx, actor);
  const lists = await Promise.all(
    ctx.exclusionSources().map(async ({ moduleId, source }) =>
      (await source.list()).map((target) => ({
        kind: source.kind,
        id: target.id,
        name: target.name,
        key: target.key,
        moduleId,
      })),
    ),
  );
  return {
    items: lists
      .flat()
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
  };
}
