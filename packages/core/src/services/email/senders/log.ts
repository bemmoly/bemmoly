import type { Logger } from 'pino';
import type { EmailAddress, EmailSender } from '../../../contracts/email-sender.ts';
import type { MailboxStore } from '../mailbox.ts';
import { createSender, DEFAULT_SENDER_POLICY } from './base.ts';
import { formatAddress } from './smtp.ts';

export interface LogSenderConfig {
  from: EmailAddress;
  logger: Logger;
  mailbox: MailboxStore;
}

/**
 * Development transport: nothing leaves the machine. The message is logged
 * (addresses and subject; the body only at debug, since it may carry a reset
 * link) and captured for the dev mailbox page.
 */
export function createLogSender(config: LogSenderConfig): EmailSender {
  return createSender(
    {
      id: 'log',
      async check() {},
      async deliver(message) {
        const to = message.to.map(formatAddress);
        const entry = config.mailbox.add({
          to,
          from: formatAddress(message.from ?? config.from),
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: { ...message.headers },
        });
        config.logger.info(
          { email: { to, subject: message.subject, mailboxId: entry.id } },
          'email captured by the log provider; open the dev mailbox to read it',
        );
        config.logger.debug({ email: { mailboxId: entry.id, text: message.text } }, 'email body');
        return { messageId: entry.id, accepted: to, rejected: [] };
      },
      describe(error) {
        return {
          stage: 'send',
          message: error instanceof Error ? error.message : 'The log provider failed',
          serverResponse: null,
          transient: false,
        };
      },
    },
    DEFAULT_SENDER_POLICY,
  );
}
