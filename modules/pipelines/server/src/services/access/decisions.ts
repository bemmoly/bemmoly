import { decodeCursor, toPage, type RequestContext, type SqlClient } from '@bemmoly/core';
import type {
  DecisionsPage,
  ListDecisionsQuery,
  StoredDecision,
} from '../../../../shared/access.ts';
import { traceStepSchema } from '../../../../shared/access.ts';
import { iso } from '../../utils/time.ts';
import { PIPELINES_RESOURCE, requirePerson } from '../deps.ts';
import type { AccessEngine } from './engine.ts';

/*
 * The access history: every protected decision with its trace, newest first. A person may
 * read their own; reading anyone's needs Audit, or Maintainer of the application asked about.
 */

interface DecisionRow {
  id: string;
  actor_kind: string;
  actor_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  application_id: string | null;
  application_key: string | null;
  application_name: string | null;
  environment_id: string | null;
  environment_key: string | null;
  environment_name: string | null;
  allowed: boolean;
  trace: { sentence?: string; trace?: unknown[] } | unknown[];
  created_at: Date;
}

function present(row: DecisionRow): StoredDecision {
  // Decisions store { sentence, trace }; older rows may hold the bare trace.
  const stored = Array.isArray(row.trace) ? { trace: row.trace } : row.trace;
  const trace = (stored.trace ?? []).flatMap((step) => {
    const parsed = traceStepSchema.safeParse(step);
    return parsed.success ? [parsed.data] : [];
  });
  return {
    id: row.id,
    actor: {
      kind: row.actor_kind,
      id: row.actor_id,
      person: row.user_id ? { id: row.user_id, name: row.user_name ?? '' } : null,
    },
    action: row.action,
    application:
      row.application_id && row.application_key
        ? { id: row.application_id, key: row.application_key, name: row.application_name ?? '' }
        : null,
    environment:
      row.environment_id && row.environment_key
        ? { id: row.environment_id, key: row.environment_key, name: row.environment_name ?? '' }
        : null,
    allowed: row.allowed,
    sentence:
      'sentence' in stored && stored.sentence
        ? stored.sentence
        : row.allowed
          ? 'Allowed'
          : 'Refused',
    trace,
    createdAt: iso(row.created_at),
  };
}

export function createDecisionsService(sql: () => SqlClient, engine: AccessEngine) {
  return {
    async list(ctx: RequestContext, query: ListDecisionsQuery): Promise<DecisionsPage> {
      const me = requirePerson(ctx.actor);
      const own = query.user === me;
      if (!own) {
        const auditor = await ctx.authz.can(ctx.actor, 'pipelines.audit', PIPELINES_RESOURCE);
        if (!auditor) {
          await engine.authorizeAction(
            ctx,
            query.application ? 'manage' : 'platform',
            query.application ? { application: query.application } : {},
          );
        }
      } else {
        await engine.authorizeAction(ctx, 'view', {});
      }
      const db = sql();
      const after = decodeCursor(query.cursor);
      const rows = await db<DecisionRow[]>`
        select d.id, d.actor_kind, d.actor_id, d.user_id, u.name as user_name, d.action,
          d.application_id, a.key as application_key, a.name as application_name,
          d.environment_id, e.key as environment_key, e.name as environment_name,
          d.allowed, d.trace, d.created_at
        from pipeline_decisions d
          left join users u on u.id = d.user_id
          left join pipeline_applications a on a.id = d.application_id
          left join pipeline_environments e on e.id = d.environment_id
        where true
          ${query.application ? db`and a.key = ${query.application}` : db``}
          ${query.user ? db`and d.user_id = ${query.user}::uuid` : db``}
          ${query.allowed === undefined ? db`` : db`and d.allowed = ${query.allowed}`}
          ${after ? db`and d.id < ${after}::uuid` : db``}
        order by d.id desc
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(present), nextCursor: page.nextCursor };
    },
  };
}
