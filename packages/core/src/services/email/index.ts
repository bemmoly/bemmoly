export { APPEARANCE_KEYS, defaultLogoUrl, type LogoUrlResolver } from './brand.ts';
export { absoluteUrl, type EmailServiceDependencies, type FramedEmail } from './context.ts';
export { checkDeliverability, fromDomain } from './deliverability.ts';
export { registerEmailJobs } from './jobs.ts';
export { createMemoryMailbox, type CapturedEmail, type MailboxStore } from './mailbox.ts';
export {
  DEFAULT_DRAIN_POLICY,
  RETRY_DELAYS_SECONDS,
  type DrainPolicy,
  type DrainResult,
} from './outbox/drain.ts';
export { EMAIL_SEND_JOB, type EmailSendJobPayload } from './outbox/queue.ts';
export type { NewOutboxEmail } from './outbox/repository.ts';
export { createSender, type SenderDriver, type SenderPolicy } from './senders/base.ts';
export { failureOf, type EmailFailure } from './senders/failure.ts';
export { createEmailService, type EmailService } from './service.ts';
export {
  createEmailConfigurationProbe,
  EMAIL_SETTING_DEFINITIONS,
  readEmailConfig,
  type EmailConfig,
} from './settings.ts';
export {
  backupFailedEmail,
  DIGEST_LINE_LIMIT,
  digestEmail,
  notificationEmail,
  renderEmail,
  updateAvailableEmail,
  type ActivityLine,
  type EmailBrand,
  type EmailFrame,
  type RenderedEmail,
} from './templates/index.ts';
export { DIGEST_SCOPE, type UnsubscribeClaim, type UnsubscribeSigner } from './unsubscribe.ts';
