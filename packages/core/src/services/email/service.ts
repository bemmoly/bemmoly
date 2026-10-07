import type {
  EmailTestBody,
  EmailTestResponse,
  MailboxResponse,
  OutboxOverviewResponse,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import {
  clearMailbox,
  devToolsEnabled,
  outboxOverview,
  readMailbox,
  requireLogProvider,
  sendTestEmail,
} from './admin.ts';
import { loadEmailBrand } from './brand.ts';
import {
  absoluteUrl,
  frameEmail,
  type EmailContext,
  type EmailServiceDependencies,
  type FramedEmail,
} from './context.ts';
import { createMemoryMailbox } from './mailbox.ts';
import { drainOutbox, type DrainResult } from './outbox/drain.ts';
import { queueEmail, type EmailSendJobPayload } from './outbox/queue.ts';
import type { NewOutboxEmail } from './outbox/repository.ts';
import { createEmailSender } from './senders/factory.ts';
import { readEmailConfig, type EmailConfig } from './settings.ts';
import type { EmailBrand } from './templates/index.ts';
import { queueInvitationEmail, queuePasswordResetEmail } from './transactional.ts';
import {
  createUnsubscribeSigner,
  type UnsubscribeClaim,
  type UnsubscribeSigner,
} from './unsubscribe.ts';

export interface EmailService {
  config(): Promise<EmailConfig>;
  brand(): Promise<EmailBrand>;
  /** Brand, theme, reason line and (for preference-governed mail) unsubscribe link and headers. */
  frame(reason: string, unsubscribe: UnsubscribeClaim | null): Promise<FramedEmail>;
  /** Inserts an outbox row in `db` (pass the caller's transaction) and enqueues its send. */
  queue(db: SqlExecutor, email: NewOutboxEmail): Promise<string>;
  queueInvitation(db: SqlExecutor, payload: unknown): Promise<string>;
  queuePasswordReset(db: SqlExecutor, payload: unknown): Promise<string>;
  drain(payload: EmailSendJobPayload): Promise<DrainResult>;
  outboxOverview(actor: Actor, query: { limit: number }): Promise<OutboxOverviewResponse>;
  sendTest(actor: Actor, body: EmailTestBody): Promise<EmailTestResponse>;
  readMailbox(actor: Actor): Promise<MailboxResponse>;
  clearMailbox(actor: Actor): Promise<void>;
  /** Dev endpoints exist only while the provider is `log`; this is the gate, not the environment. */
  devToolsEnabled(): Promise<boolean>;
  requireDevTools(): Promise<void>;
  unsubscribeSigner: UnsubscribeSigner;
  absoluteUrl(path: string): string;
}

export function createEmailService(deps: EmailServiceDependencies): EmailService {
  const mailbox = deps.mailbox ?? createMemoryMailbox();
  const config = () => readEmailConfig(deps.settings, deps.publicUrl);
  const sender = async (current?: EmailConfig) => {
    const resolved = current ?? (await config());
    if (deps.senderFor) return deps.senderFor(resolved);
    const brand = await loadEmailBrand(deps.settings, deps.resolveLogoUrl);
    return createEmailSender(resolved, {
      logger: deps.logger,
      mailbox,
      allowPrivateHosts: deps.allowPrivateHosts,
      fromName: brand.workspaceName,
    });
  };
  const ctx: EmailContext = {
    ...deps,
    mailbox,
    signer: createUnsubscribeSigner(deps.secretKey),
    config,
    sender,
    drain: {
      db: deps.db,
      jobs: deps.jobs,
      sender: () => sender(),
      logger: deps.logger,
      ...(deps.drainPolicy ? { policy: deps.drainPolicy } : {}),
    },
  };

  return {
    config,
    brand: () => loadEmailBrand(deps.settings, deps.resolveLogoUrl),
    frame: (reason, unsubscribe) => frameEmail(ctx, reason, unsubscribe),
    queue: (db, email) => queueEmail(deps.jobs, db, email),
    queueInvitation: (db, payload) => queueInvitationEmail(ctx, db, payload),
    queuePasswordReset: (db, payload) => queuePasswordResetEmail(ctx, db, payload),
    drain: (payload) => drainOutbox(ctx.drain, payload),
    outboxOverview: (actor, query) => outboxOverview(ctx, actor, query),
    sendTest: (actor, body) => sendTestEmail(ctx, actor, body),
    readMailbox: (actor) => readMailbox(ctx, actor),
    clearMailbox: (actor) => clearMailbox(ctx, actor),
    devToolsEnabled: () => devToolsEnabled(ctx),
    requireDevTools: () => requireLogProvider(ctx),
    unsubscribeSigner: ctx.signer,
    absoluteUrl: (path) => absoluteUrl(deps.publicUrl, path),
  };
}
