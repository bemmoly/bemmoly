import type { EmailProviderId } from '@bemmoly/shared';
import type { Logger } from 'pino';
import type { EmailAddress, EmailSender } from '../../../contracts/email-sender.ts';
import type { MailboxStore } from '../mailbox.ts';
import type { EmailConfig } from '../settings.ts';
import { createLogSender } from './log.ts';
import { createSmtpSender } from './smtp.ts';

export interface SenderDependencies {
  logger: Logger;
  mailbox: MailboxStore;
  allowPrivateHosts: boolean;
  /** Display name on the From line. */
  fromName: string;
}

type SenderBuilder = (config: EmailConfig, deps: SenderDependencies) => EmailSender;

const fromAddress = (config: EmailConfig, deps: SenderDependencies): EmailAddress => ({
  address: config.from,
  name: deps.fromName,
});

/** One line per transport. A new provider is one file in this folder plus one entry here. */
const SENDERS: Readonly<Record<EmailProviderId, SenderBuilder>> = {
  smtp: (config, deps) =>
    createSmtpSender({
      smtp: config.smtp,
      from: fromAddress(config, deps),
      replyTo: config.replyTo ? { address: config.replyTo } : null,
      allowPrivateHosts: deps.allowPrivateHosts,
    }),
  log: (config, deps) =>
    createLogSender({
      from: fromAddress(config, deps),
      logger: deps.logger,
      mailbox: deps.mailbox,
    }),
};

/** Chosen by the `email.provider` setting each time, so a settings change applies at once. */
export function createEmailSender(config: EmailConfig, deps: SenderDependencies): EmailSender {
  return SENDERS[config.provider](config, deps);
}
