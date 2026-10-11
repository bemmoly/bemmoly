import type { ModelServerClient } from '../../../clients/model-server.ts';
import type { Actor, Authorize } from '../../../contracts/authz.ts';
import type { ClusterEventBus, EventBus } from '../../../contracts/event-bus.ts';
import type { RealtimePublisher } from '../../../contracts/realtime.ts';
import type { SettingsService } from '../../../contracts/settings.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { AiExclusionSourceDefinition } from '../../../modules/registries.ts';
import type { SecretBox } from '../../settings/index.ts';
import type { CatalogResolver } from '../catalog/resolver.ts';
import type { DbPolicySource } from '../policy.ts';
import type { PromptService } from '../prompts/service.ts';
import type { AiModelSource } from '../runtime/registry.ts';

/** Published on the kernel bus whenever AI configuration changes; retrieval re-checks. */
export const AI_SETTINGS_CHANGED = 'ai.settings.changed';

export type AiChangeReason = 'enabled' | 'privacy' | 'opt_out' | 'roles' | 'embedding_role';

export interface AiServiceContext {
  sql: SqlExecutor;
  secrets: SecretBox;
  settings: SettingsService;
  authorize: Authorize;
  catalog: CatalogResolver;
  models: AiModelSource;
  policy: DbPolicySource;
  prompts: PromptService;
  modelServer: ModelServerClient;
  events?: EventBus | ClusterEventBus;
  realtime?: RealtimePublisher;
  exclusionSources: () => readonly { moduleId: string; source: AiExclusionSourceDefinition }[];
  /** BEMMOLY_ALLOW_PRIVATE_URLS: a catalog provider's base URL may be on a private network. */
  allowPrivateUrls: boolean;
  /** True with the recorded provider: tests never reach a network. */
  recorded: boolean;
  /** Connection tests and discovery: one cheap request each. */
  testTimeoutMs: number;
}

export const CONFIGURE = 'ai.models.configure';
export const WORKSPACE = { kind: 'workspace' } as const;

export async function authorizeAdmin(ctx: AiServiceContext, actor: Actor): Promise<void> {
  await ctx.authorize(actor, CONFIGURE, WORKSPACE);
}

/** Drops every cache and tells other replicas, retrieval and the web shell. */
export async function announceChange(
  ctx: AiServiceContext,
  actor: Actor | null,
  reasons: readonly AiChangeReason[],
): Promise<void> {
  ctx.policy.invalidate();
  if (reasons.some((reason) => reason === 'roles' || reason === 'embedding_role')) {
    ctx.models.invalidate();
  }
  await ctx.events?.publish({
    kind: AI_SETTINGS_CHANGED,
    occurredAt: new Date(),
    ...(actor ? { actor } : {}),
    payload: { reasons: [...reasons] },
  });
  await ctx.realtime?.publish({ kind: AI_SETTINGS_CHANGED, ids: [...reasons] });
}

export function userIdOf(actor: Actor): string | null {
  return actor.kind === 'user' ? actor.id : (actor.userId ?? null);
}
