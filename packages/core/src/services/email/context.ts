import type { Logger } from 'pino';
import type { TxtLookup } from '../../clients/dns.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { EmailSender } from '../../contracts/email-sender.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import type { UserDirectory } from '../../contracts/users.ts';
import { trimLeadingSlashes, trimTrailingSlashes } from '../../utils/slashes.ts';
import { loadEmailBrand, type LogoUrlResolver } from './brand.ts';
import type { MailboxStore } from './mailbox.ts';
import type { DrainDependencies, DrainPolicy } from './outbox/drain.ts';
import type { EmailConfig } from './settings.ts';
import { emailTheme, type EmailBrand, type EmailFrame } from './templates/index.ts';
import { unsubscribeLinks, type UnsubscribeClaim, type UnsubscribeSigner } from './unsubscribe.ts';

export interface EmailServiceDependencies {
  db: SqlExecutor;
  settings: SettingsService;
  jobs: JobQueue;
  authorize: Authorize;
  users: UserDirectory;
  logger: Logger;
  /** BEMMOLY_PUBLIC_URL: every link in an email is absolute. */
  publicUrl: string;
  /** BEMMOLY_SECRET_KEY: signs unsubscribe links. */
  secretKey: string;
  /** BEMMOLY_ALLOW_PRIVATE_URLS: lets the SMTP host live on the LAN. */
  allowPrivateHosts: boolean;
  mailbox?: MailboxStore;
  txtLookup?: TxtLookup;
  resolveLogoUrl?: LogoUrlResolver;
  /** Replaces the provider factory; tests pass a fake sender. */
  senderFor?: (config: EmailConfig) => EmailSender;
  drainPolicy?: DrainPolicy;
}

/** Internal wiring shared by the email service's parts. */
export interface EmailContext extends EmailServiceDependencies {
  mailbox: MailboxStore;
  signer: UnsubscribeSigner;
  drain: DrainDependencies;
  config(): Promise<EmailConfig>;
  sender(config?: EmailConfig): Promise<EmailSender>;
}

export interface FramedEmail {
  frame: EmailFrame;
  headers: Record<string, string>;
}

export function absoluteUrl(publicUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${trimTrailingSlashes(publicUrl)}/${trimLeadingSlashes(path)}`;
}

/**
 * The frame every email shares: brand and theme from settings, the reason line,
 * and, for anything a preference governs, the unsubscribe link and headers.
 */
export async function frameEmail(
  ctx: EmailContext,
  reason: string | ((brand: EmailBrand) => string),
  unsubscribe: UnsubscribeClaim | null,
): Promise<FramedEmail> {
  const brand = await loadEmailBrand(ctx.settings, ctx.resolveLogoUrl);
  const links = unsubscribe ? unsubscribeLinks(ctx.publicUrl, ctx.signer.sign(unsubscribe)) : null;
  return {
    frame: {
      brand,
      theme: emailTheme(brand),
      reason: typeof reason === 'string' ? reason : reason(brand),
      unsubscribeUrl: links?.pageUrl ?? null,
      preferencesUrl: unsubscribe ? absoluteUrl(ctx.publicUrl, '/settings/notifications') : null,
    },
    headers: links?.headers ?? {},
  };
}
