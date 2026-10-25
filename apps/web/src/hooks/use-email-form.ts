import { SETTING_SCHEMAS, smtpSecuritySchema, type SmtpSecurity } from '@bemmoly/shared';
import { z } from 'zod';
import type { SettingReads, SettingValues } from './use-setting.ts';

/** Keys confirmed by the email stream. The password is a secret: write-only. */
export const EMAIL_KEYS = [
  'email.provider',
  'email.smtp.host',
  'email.smtp.port',
  'email.smtp.security',
  'email.smtp.username',
  'email.smtp.password',
  'email.from',
  'email.replyTo',
  'email.digestMinutes',
] as const;

export type EmailKey = (typeof EMAIL_KEYS)[number];
export type EmailProvider = 'smtp' | 'log';

export const PROVIDER_OPTIONS = [
  { value: 'smtp', label: 'SMTP relay' },
  { value: 'log', label: 'Dev mailbox only' },
] as const;

export const SECURITY_OPTIONS: Array<{ value: SmtpSecurity; label: string }> = [
  { value: 'starttls', label: 'STARTTLS (usually port 587)' },
  { value: 'tls', label: 'TLS (usually port 465)' },
  { value: 'none', label: 'None (only on a trusted network)' },
];

/** Text fields hold what was typed; numbers are parsed on save. */
export interface EmailForm {
  provider: EmailProvider;
  host: string;
  port: string;
  security: SmtpSecurity;
  username: string;
  /** A replacement password; blank keeps the stored one. */
  password: string;
  from: string;
  replyTo: string;
  digestMinutes: string;
}

export function emailFormFrom(reads: SettingReads<EmailKey>): EmailForm {
  return {
    provider: reads['email.provider'].value ?? 'log',
    host: reads['email.smtp.host'].value ?? '',
    port: String(reads['email.smtp.port'].value ?? 587),
    security: reads['email.smtp.security'].value ?? 'starttls',
    username: reads['email.smtp.username'].value ?? '',
    password: '',
    from: reads['email.from'].value ?? '',
    replyTo: reads['email.replyTo'].value ?? '',
    digestMinutes: String(reads['email.digestMinutes'].value ?? 10),
  };
}

const ADDRESS = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/;

const emailFields = z.object({
  provider: SETTING_SCHEMAS['email.provider'],
  host: z.string().trim(),
  port: z.coerce
    .number({ error: 'Enter a port number, like 587' })
    .int('Enter a whole port number, like 587')
    .min(1, 'Ports run from 1 to 65535')
    .max(65535, 'Ports run from 1 to 65535'),
  security: smtpSecuritySchema,
  username: z.string().trim(),
  password: z.string(),
  from: z
    .string()
    .trim()
    .regex(ADDRESS, 'Enter the address mail comes from, like bemmoly@acmelabs.dev'),
  replyTo: z.union([z.literal(''), z.email('Enter a valid email address, or leave it blank')]),
  digestMinutes: z.coerce
    .number({ error: 'Enter a number of minutes' })
    .int('Enter whole minutes')
    .min(1, 'Digests go out every 1 to 1440 minutes')
    .max(1440, 'Digests go out every 1 to 1440 minutes'),
});

const requireHost = (form: { provider: EmailProvider; host: string }, context: z.RefinementCtx) => {
  if (form.provider === 'smtp' && !form.host) {
    context.addIssue({
      code: 'custom',
      path: ['host'],
      message: 'Enter the SMTP server, like smtp.acmelabs.dev',
    });
  }
};

export const emailFormSchema = emailFields.superRefine(requireHost);

/** Each section is saved on its own, so each is checked on its own. */
export const deliverySchema = emailFields
  .pick({ provider: true, host: true, port: true, security: true, username: true, password: true })
  .superRefine(requireHost);
export const senderSchema = emailFields.pick({ from: true, replyTo: true, digestMinutes: true });

export type ValidEmailForm = z.output<typeof emailFormSchema>;

/**
 * The Delivery settings to write. The password goes only when a new one was typed,
 * so saving the page never clears or resends the stored secret.
 */
export function deliveryWrites(form: z.output<typeof deliverySchema>): SettingValues<EmailKey> {
  return {
    'email.provider': form.provider,
    'email.smtp.host': form.host,
    'email.smtp.port': form.port,
    'email.smtp.security': form.security,
    'email.smtp.username': form.username,
    ...(form.password ? { 'email.smtp.password': form.password } : {}),
  };
}

export function senderWrites(form: z.output<typeof senderSchema>): SettingValues<EmailKey> {
  return {
    'email.from': form.from,
    'email.replyTo': form.replyTo === '' ? null : form.replyTo,
    'email.digestMinutes': form.digestMinutes,
  };
}

export function emailWrites(form: ValidEmailForm): SettingValues<EmailKey> {
  return { ...deliveryWrites(form), ...senderWrites(form) };
}

/** The usual port for each security mode, and the mode each usual port implies. */
const PORT_OF: Partial<Record<SmtpSecurity, string>> = { tls: '465', starttls: '587' };
const SECURITY_OF: Record<string, SmtpSecurity> = {
  '465': 'tls',
  '587': 'starttls',
  '25': 'starttls',
};

/**
 * Port and security move together: a usual port picks its security, and picking a
 * security moves a usual (or blank) port to its own. A custom port, like 2525, is left alone.
 */
export function linkPortAndSecurity(
  current: Pick<EmailForm, 'port' | 'security'>,
  patch: Partial<EmailForm>,
): Partial<EmailForm> {
  if (patch.port !== undefined) {
    const security = SECURITY_OF[patch.port.trim()];
    return security ? { ...patch, security } : patch;
  }
  if (patch.security !== undefined) {
    const port = PORT_OF[patch.security];
    const usual = current.port.trim() === '' || current.port.trim() in SECURITY_OF;
    return port && usual ? { ...patch, port } : patch;
  }
  return patch;
}
