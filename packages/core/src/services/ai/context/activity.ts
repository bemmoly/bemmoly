import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { RequestContext } from '../../authz/index.ts';
import type {
  AiActivitySource,
  AiBuiltContext,
  AiContextOptions,
  AiTargetContextBuilder,
} from './types.ts';
import { createContextWriter } from './writer.ts';

/** The kernel's own builder name; its target is a person. */
export const ACTIVITY_CONTEXT_BUILDER = 'ai.activity';

const DAY_MS = 86_400_000;
/** A brief always covers at least a day and never more than a week. */
const MIN_WINDOW_MS = DAY_MS;
const MAX_WINDOW_MS = 7 * DAY_MS;

/** "since their last visit", held between one day and one week back. */
export function activityWindowStart(lastSeenAt: Date | null, now: Date): Date {
  const floor = now.getTime() - MAX_WINDOW_MS;
  const ceiling = now.getTime() - MIN_WINDOW_MS;
  const seen = lastSeenAt?.getTime() ?? floor;
  return new Date(Math.max(floor, Math.min(seen, ceiling)));
}

const actorUserId = (ctx: RequestContext): string | null =>
  ctx.actor.userId ?? (ctx.actor.kind === 'user' ? ctx.actor.id : null);

export interface ActivityContextDeps {
  database: SqlExecutor;
  /** Every enabled module's activity source, read on each build. */
  sources(): readonly AiActivitySource[];
  /** Characters for the whole brief context; each source shares it in order. */
  maxChars?: number;
}

/**
 * activityContext: everything that changed in this person's projects and spaces since their
 * last visit, gathered from the modules through their activity sources and grouped by object.
 * Citations number on across modules because they write into one writer.
 */
export function createActivityContextBuilder(deps: ActivityContextDeps): AiTargetContextBuilder {
  return {
    type: 'target',
    targetKind: 'user',
    async canView(ctx, targetId) {
      return actorUserId(ctx) === targetId;
    },
    async build(userId: string, options: AiContextOptions): Promise<AiBuiltContext | null> {
      const [person] = await deps.database<
        { name: string; last_seen_at: Date | string | null }[]
      >`select name, last_seen_at from users where id = ${userId} and status = 'active'`;
      if (!person) return null;
      const since = activityWindowStart(
        person.last_seen_at === null ? null : new Date(person.last_seen_at),
        options.now,
      );
      const writer = createContextWriter({
        policy: options.policy,
        maxChars: deps.maxChars ?? 20_000,
        maxBodyChars: 400,
      });
      for (const source of deps.sources()) {
        await source.collect(writer, {
          userId,
          since,
          now: options.now,
          policy: options.policy,
        });
      }
      return writer.build(
        { userId },
        {
          person: person.name.split(' ')[0] ?? person.name,
          since: since.toISOString(),
          today: options.now.toISOString().slice(0, 10),
        },
      );
    },
  };
}
