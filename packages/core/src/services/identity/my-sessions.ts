import { NotFoundError, UnauthenticatedError, type Session } from '@bemmoly/shared';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { sessions } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { presentSession } from './presenters.ts';
import { listUserSessions } from './sessions.ts';

type SessionContext = RequestContext & { sessionId?: string };

function sessionOwner(ctx: SessionContext): string {
  if (ctx.actor.kind !== 'user') {
    throw new UnauthenticatedError('Sessions are managed from a signed-in browser');
  }
  return ctx.actor.id;
}

/** The signed-in person's own sessions, marking the one making this request. */
export async function listMySessions(db: Database, ctx: SessionContext): Promise<Session[]> {
  const rows = await listUserSessions(db, sessionOwner(ctx), new Date());
  return rows.map((row) => presentSession(row, ctx.sessionId));
}

/** Signs out one of the person's own sessions, e.g. a lost laptop. */
export async function revokeMySession(db: Database, ctx: SessionContext, sessionId: string) {
  const userId = sessionOwner(ctx);
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .returning({ id: sessions.id });
    if (deleted.length === 0) throw new NotFoundError('Session not found');
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'session.revoked',
      target: { kind: 'session', id: sessionId },
      meta: ctx,
    });
  });
}
