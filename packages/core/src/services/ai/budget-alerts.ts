import {
  AI_BUDGET_PAUSED_ROLES,
  ForbiddenError,
  NOTIFICATION_EVENT_KINDS,
  type NotificationRequestedPayload,
} from '@bemmoly/shared';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { EventBus, Unsubscribe } from '../../contracts/event-bus.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { CONFIGURE, WORKSPACE } from './admin/context.ts';
import { AI_BUDGET_THRESHOLD } from './budget-watch.ts';

/** The inbox kind admins receive when AI spend crosses 80% or 100% of the monthly budget. */
export const AI_BUDGET_NOTIFICATION_KIND = 'ai_budget';
/** Settings › AI › Usage, where the alert leads. */
export const AI_USAGE_PATH = '/settings/ai/usage';

const SYSTEM: Actor = { kind: 'system', id: 'ai-budget' };

const payloadSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  state: z.enum(['warning', 'paused']),
  spentUsd: z.number().nonnegative(),
  budgetUsd: z.number().nonnegative(),
});
type ThresholdPayload = z.infer<typeof payloadSchema>;

export interface AiBudgetAlertCopy {
  /** The inbox target label, read after "Bemmoly says AI has used". */
  label: string;
  headline: string;
  detail: string;
}

const money = (usd: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(usd) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(usd);

const day = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);

/** "Standard and strong": the roles a spent budget pauses. */
const pausedRoles = () => {
  const roles: readonly string[] = AI_BUDGET_PAUSED_ROLES;
  const phrase =
    roles.length < 2 ? roles.join('') : `${roles.slice(0, -1).join(', ')} and ${roles.at(-1)}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

/** The alert in plain words, the same in the inbox and the email. */
export function budgetAlertCopy(payload: ThresholdPayload): AiBudgetAlertCopy {
  const [year, month] = payload.month.split('-').map(Number) as [number, number];
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  const resumes = day(new Date(Date.UTC(year, month, 1)));
  const budget = money(payload.budgetUsd);
  if (payload.state === 'warning') {
    return {
      label: `80% of ${monthName}'s budget`,
      headline: `AI has used 80% of this month's ${budget} budget.`,
      detail: `${money(payload.spentUsd)} is spent so far. At 100%, ${pausedRoles().toLowerCase()} AI pause until ${resumes}.`,
    };
  }
  return {
    label: `all of ${monthName}'s budget`,
    headline: `AI has used all of this month's ${budget} budget.`,
    detail: `${pausedRoles()} AI are paused until ${resumes} or until the budget is raised. Fast AI keeps working.`,
  };
}

/**
 * Active people who hold ai.models.configure. A workspace capability comes from the person's
 * org role, so one check per role covers everyone holding it.
 */
export async function budgetAdmins(sql: SqlExecutor, authorize: Authorize): Promise<string[]> {
  const rows = await sql<{ id: string; role_id: string }[]>`
    select id, role_id from users where status = 'active' order by id`;
  const byRole = new Map<string, string[]>();
  for (const row of rows) byRole.set(row.role_id, [...(byRole.get(row.role_id) ?? []), row.id]);
  const admins: string[] = [];
  for (const ids of byRole.values()) {
    const sample = ids[0]!;
    try {
      await authorize({ kind: 'user', id: sample, userId: sample }, CONFIGURE, WORKSPACE);
      admins.push(...ids);
    } catch (error) {
      if (!(error instanceof ForbiddenError)) throw error;
    }
  }
  return admins;
}

/** The notification.requested payload for one threshold; its dedupe key makes it once. */
export function budgetAlertRequest(
  payload: ThresholdPayload,
  recipientIds: string[],
): NotificationRequestedPayload {
  const copy = budgetAlertCopy(payload);
  return {
    kind: AI_BUDGET_NOTIFICATION_KIND,
    recipientIds,
    target: { kind: 'ai_usage', id: payload.month, label: copy.label, url: AI_USAGE_PATH },
    body: `${copy.headline} ${copy.detail}`,
    reason: 'you can configure AI for this workspace',
    dedupeKey: `ai-budget:${payload.month}:${payload.state}`,
    data: { ...payload, headline: copy.headline, detail: copy.detail },
  };
}

export interface AiBudgetAlertsWiring {
  sql: SqlExecutor;
  authorize: Authorize;
  events: EventBus;
  logger?: Pick<Logger, 'warn'>;
}

/**
 * Turns `ai.budget.threshold` into an inbox notification and, by the admins' preference for
 * the kind (email at once by default), an email through the outbox. The budget watch tells
 * once per month and state; the dedupe key keeps a repeated event from adding a second row.
 */
export function subscribeAiBudgetAlerts(wiring: AiBudgetAlertsWiring): Unsubscribe {
  return wiring.events.subscribe(AI_BUDGET_THRESHOLD, async (event) => {
    const parsed = payloadSchema.safeParse(event.payload);
    if (!parsed.success) {
      wiring.logger?.warn({ payload: event.payload }, 'ignored a malformed AI budget event');
      return;
    }
    const recipients = await budgetAdmins(wiring.sql, wiring.authorize);
    if (recipients.length === 0) {
      wiring.logger?.warn({ month: parsed.data.month }, 'nobody can be told about the AI budget');
      return;
    }
    await wiring.events.publish({
      kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
      occurredAt: event.occurredAt,
      actor: SYSTEM,
      payload: budgetAlertRequest(parsed.data, recipients),
    });
  });
}
