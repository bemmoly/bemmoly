import {
  NotFoundError,
  ValidationError,
  type EmailTestBody,
  type EmailTestResponse,
  type MailboxResponse,
  type OutboxOverviewResponse,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import { frameEmail, type EmailContext } from './context.ts';
import { checkDeliverability } from './deliverability.ts';
import { deliverClaimed } from './outbox/drain.ts';
import { claimDueEmails, insertOutboxEmail, readOutboxOverview } from './outbox/repository.ts';
import { renderEmail, testEmail } from './templates/index.ts';

const EMAIL_CAPABILITY = 'workspace.email.manage';
const WORKSPACE = { kind: 'workspace' } as const;

export async function outboxOverview(
  ctx: EmailContext,
  actor: Actor,
  query: { limit: number },
): Promise<OutboxOverviewResponse> {
  await ctx.authorize(actor, EMAIL_CAPABILITY, WORKSPACE);
  const overview = await readOutboxOverview(ctx.db, { limit: query.limit, failureWindowDays: 7 });
  return {
    counts: overview.counts,
    failures: overview.failures
      ? { ...overview.failures, since: overview.failures.since.toISOString() }
      : null,
    recentFailures: overview.recentFailures,
  };
}

async function recipientFor(ctx: EmailContext, actor: Actor, body: EmailTestBody) {
  if (body.to) return { address: body.to, name: null };
  const userId = actor.userId ?? (actor.kind === 'user' ? actor.id : undefined);
  const [user] = userId ? await ctx.users.findByIds([userId]) : [];
  if (!user) {
    throw new ValidationError('Say where to send the test email', {
      details: { issues: [{ path: 'to', code: 'required', message: 'Enter an address' }] },
    });
  }
  return { address: user.email, name: user.name };
}

/**
 * Sends one email now, through the outbox so it shows in the admin view, and
 * reports how the conversation went instead of throwing: a failed test is an
 * answer, not an error. SPF and DMARC are checked alongside for SMTP.
 */
export async function sendTestEmail(
  ctx: EmailContext,
  actor: Actor,
  body: EmailTestBody,
): Promise<EmailTestResponse> {
  await ctx.authorize(actor, EMAIL_CAPABILITY, WORKSPACE);
  const config = await ctx.config();
  const to = await recipientFor(ctx, actor, body);
  const deliverability =
    config.provider === 'smtp' && ctx.txtLookup
      ? checkDeliverability(ctx.txtLookup, config.from, config.smtp.host)
      : Promise.resolve(null);

  const { frame, headers } = await frameEmail(
    ctx,
    "You're receiving this because an admin sent a test email from Settings › Email.",
    null,
  );
  const requestedBy = to.name ?? 'An admin';
  const email = await renderEmail(
    frame,
    testEmail(frame, { provider: config.provider, requestedBy }),
  );
  const { id } = await insertOutboxEmail(ctx.db, {
    kind: 'test',
    toAddress: to.address,
    toName: to.name,
    ...email,
    headers,
    dedupeKey: null,
  });
  const [row] = await claimDueEmails(ctx.db, { id, limit: 1, leaseSeconds: 120 });
  if (!row) throw new NotFoundError('The test email was claimed by another worker');
  const outcome = await deliverClaimed(ctx.drain, await ctx.sender(config), row, { retry: false });
  return {
    sent: outcome.status === 'sent',
    provider: config.provider,
    to: to.address,
    messageId: outcome.status === 'sent' ? outcome.messageId : null,
    failure:
      outcome.status === 'sent'
        ? null
        : {
            stage: outcome.failure.stage,
            message: outcome.failure.message,
            serverResponse: outcome.failure.serverResponse,
          },
    deliverability: await deliverability,
  };
}

/** Development aid; answers 404 unless the provider is `log`. */
export async function readMailbox(ctx: EmailContext, actor: Actor): Promise<MailboxResponse> {
  await requireLogProvider(ctx);
  await ctx.authorize(actor, EMAIL_CAPABILITY, WORKSPACE);
  return { items: ctx.mailbox.list() };
}

export async function clearMailbox(ctx: EmailContext, actor: Actor): Promise<void> {
  await requireLogProvider(ctx);
  await ctx.authorize(actor, EMAIL_CAPABILITY, WORKSPACE);
  ctx.mailbox.clear();
}

export async function devToolsEnabled(ctx: EmailContext): Promise<boolean> {
  return (await ctx.config()).provider === 'log';
}

export async function requireLogProvider(ctx: EmailContext): Promise<void> {
  if (!(await devToolsEnabled(ctx))) {
    throw new NotFoundError('Development tools are on only while the email provider is "log"');
  }
}
