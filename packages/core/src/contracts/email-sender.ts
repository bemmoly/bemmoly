export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailMessage {
  to: readonly EmailAddress[];
  cc?: readonly EmailAddress[];
  bcc?: readonly EmailAddress[];
  from?: EmailAddress;
  replyTo?: EmailAddress;
  subject: string;
  html: string;
  text: string;
  headers?: Readonly<Record<string, string>>;
  /** Stable per logical message so an outbox retry never sends twice. */
  idempotencyKey: string;
}

export interface EmailSendResult {
  messageId: string;
  accepted: readonly string[];
  rejected: readonly string[];
}

export interface EmailCallOptions {
  signal?: AbortSignal;
}

/**
 * One implementation per transport (smtp, log, ...). Vendor shapes stay inside
 * the implementation; failures surface as ProviderError.
 */
export interface EmailSender {
  readonly id: string;
  send(message: EmailMessage, options?: EmailCallOptions): Promise<EmailSendResult>;
  /** Checks the connection and credentials, used by the SMTP test in Settings. */
  verify(options?: EmailCallOptions): Promise<void>;
}

export type EmailSenderFactory<Config> = (config: Config) => EmailSender;
