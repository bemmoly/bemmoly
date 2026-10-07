import nodemailer from 'nodemailer';
import { isIP } from 'node:net';
import { resolvePublicAddress } from './network.ts';

export type SmtpSecurityMode = 'starttls' | 'tls' | 'none';

export interface SmtpClientOptions {
  host: string;
  port: number;
  security: SmtpSecurityMode;
  username?: string;
  password?: string;
  /** Applies to the lookup, connect, greeting and every socket read. */
  timeoutMs: number;
  allowPrivate: boolean;
}

export interface SmtpOutgoingMessage {
  from: string;
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers: Readonly<Record<string, string>>;
  messageId?: string;
}

export interface SmtpSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}

export interface SmtpClient {
  verify(signal?: AbortSignal): Promise<void>;
  send(message: SmtpOutgoingMessage, signal?: AbortSignal): Promise<SmtpSendResult>;
}

/** The transport's failure with the SMTP conversation details it carried. */
export interface SmtpFailureDetails {
  code?: string;
  command?: string;
  responseCode?: number;
  response?: string;
}

function abortable<T>(work: Promise<T>, signal: AbortSignal | undefined, onAbort: () => void) {
  if (!signal) return work;
  if (signal.aborted) {
    onAbort();
    return Promise.reject(signal.reason as Error);
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      onAbort();
      reject(signal.reason as Error);
    };
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** One connection per call; the outbox sends in small batches, so pooling buys little. */
export function createSmtpClient(options: SmtpClientOptions): SmtpClient {
  const transport = async () => {
    const address = await resolvePublicAddress(options.host, {
      allowPrivate: options.allowPrivate,
      timeoutMs: options.timeoutMs,
    });
    return nodemailer.createTransport({
      host: address,
      port: options.port,
      secure: options.security === 'tls',
      requireTLS: options.security === 'starttls',
      ignoreTLS: options.security === 'none',
      // The certificate is checked against the configured name, not the address.
      ...(isIP(options.host) ? {} : { tls: { servername: options.host } }),
      ...(options.username
        ? { auth: { user: options.username, pass: options.password ?? '' } }
        : {}),
      connectionTimeout: options.timeoutMs,
      greetingTimeout: options.timeoutMs,
      socketTimeout: options.timeoutMs,
      dnsTimeout: options.timeoutMs,
    });
  };

  return {
    async verify(signal) {
      const mailer = await transport();
      try {
        await abortable(mailer.verify(), signal, () => mailer.close());
      } finally {
        mailer.close();
      }
    },
    async send(message, signal) {
      const mailer = await transport();
      try {
        const info = await abortable(
          mailer.sendMail({
            from: message.from,
            to: [...message.to],
            ...(message.cc ? { cc: [...message.cc] } : {}),
            ...(message.bcc ? { bcc: [...message.bcc] } : {}),
            ...(message.replyTo ? { replyTo: message.replyTo } : {}),
            subject: message.subject,
            html: message.html,
            text: message.text,
            headers: { ...message.headers },
            ...(message.messageId ? { messageId: message.messageId } : {}),
          }),
          signal,
          () => mailer.close(),
        );
        return {
          messageId: info.messageId,
          accepted: info.accepted.map(String),
          rejected: info.rejected.map(String),
          response: info.response,
        };
      } finally {
        mailer.close();
      }
    },
  };
}

export function smtpFailureDetails(error: unknown): SmtpFailureDetails {
  if (typeof error !== 'object' || error === null) return {};
  const source = error as Record<string, unknown>;
  const details: SmtpFailureDetails = {};
  if (typeof source['code'] === 'string') details.code = source['code'];
  if (typeof source['command'] === 'string') details.command = source['command'];
  if (typeof source['responseCode'] === 'number') details.responseCode = source['responseCode'];
  if (typeof source['response'] === 'string') details.response = source['response'];
  return details;
}
