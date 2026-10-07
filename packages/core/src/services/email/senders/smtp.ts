import { createSmtpClient, type SmtpClient } from '../../../clients/smtp.ts';
import type { EmailAddress, EmailSender } from '../../../contracts/email-sender.ts';
import type { SmtpConfig } from '../settings.ts';
import { createSender, DEFAULT_SENDER_POLICY, type SenderPolicy } from './base.ts';
import { describeSmtpFailure } from './smtp-failures.ts';

export interface SmtpSenderConfig {
  smtp: SmtpConfig;
  from: EmailAddress;
  replyTo: EmailAddress | null;
  allowPrivateHosts: boolean;
  policy?: SenderPolicy;
  /** Tests inject a client; production builds one from the settings. */
  client?: SmtpClient;
}

export function formatAddress(address: EmailAddress): string {
  if (!address.name) return address.address;
  return `"${address.name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}" <${address.address}>`;
}

export function createSmtpSender(config: SmtpSenderConfig): EmailSender {
  const policy = config.policy ?? DEFAULT_SENDER_POLICY;
  const { smtp } = config;
  const client =
    config.client ??
    createSmtpClient({
      host: smtp.host,
      port: smtp.port,
      security: smtp.security,
      username: smtp.username,
      password: smtp.password,
      timeoutMs: Math.min(policy.timeoutMs, 20_000),
      allowPrivate: config.allowPrivateHosts,
    });
  const ctx = { host: smtp.host, port: smtp.port, from: config.from.address };
  const missingHost = () => {
    throw Object.assign(new Error('No SMTP host is set'), { code: 'ECONFIG' });
  };

  return createSender(
    {
      id: 'smtp',
      async check(signal) {
        if (!smtp.host) missingHost();
        await client.verify(signal);
      },
      async deliver(message, signal) {
        if (!smtp.host) missingHost();
        const from = message.from ?? config.from;
        const replyTo = message.replyTo ?? config.replyTo;
        const result = await client.send(
          {
            from: formatAddress(from),
            to: message.to.map(formatAddress),
            ...(message.cc ? { cc: message.cc.map(formatAddress) } : {}),
            ...(message.bcc ? { bcc: message.bcc.map(formatAddress) } : {}),
            ...(replyTo ? { replyTo: formatAddress(replyTo) } : {}),
            subject: message.subject,
            html: message.html,
            text: message.text,
            headers: message.headers ?? {},
            // A stable Message-ID lets receivers drop the duplicate if a retry repeats a send.
            messageId: `<${message.idempotencyKey.replace(/[^\w.!#$%&'*+/=?^`{|}~-]/g, '.')}@${
              from.address.split('@')[1] ?? 'bemmoly'
            }>`,
          },
          signal,
        );
        return {
          messageId: result.messageId,
          accepted: result.accepted,
          rejected: result.rejected,
        };
      },
      describe(error) {
        if ((error as { code?: unknown }).code === 'ECONFIG') {
          return {
            stage: 'config',
            message: 'No SMTP host is set. Enter the host in Settings › Email.',
            serverResponse: null,
            transient: false,
          };
        }
        return describeSmtpFailure(error, ctx);
      },
    },
    policy,
  );
}
