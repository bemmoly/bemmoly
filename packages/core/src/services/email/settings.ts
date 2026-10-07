import {
  emailProviderSchema,
  smtpSecuritySchema,
  type EmailProviderId,
  type SmtpSecurity,
} from '@bemmoly/shared';
import { z } from 'zod';
import type { SettingDefinition, SettingsService } from '../../contracts/settings.ts';

declare module '../../contracts/settings.ts' {
  interface SettingsKeys {
    'email.provider': EmailProviderId;
    'email.smtp.host': string;
    'email.smtp.port': number;
    'email.smtp.security': SmtpSecurity;
    'email.smtp.username': string;
    'email.smtp.password': string;
    'email.from': string;
    'email.replyTo': string;
    'email.digestMinutes': number;
  }
}

const optionalEmail = z.union([z.literal(''), z.email()]);

/** Registered by the settings service; the password is encrypted and write-only. */
export const EMAIL_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  { key: 'email.provider', schema: emailProviderSchema, default: 'log' },
  { key: 'email.smtp.host', schema: z.string().max(253), default: '' },
  { key: 'email.smtp.port', schema: z.number().int().min(1).max(65_535), default: 587 },
  { key: 'email.smtp.security', schema: smtpSecuritySchema, default: 'starttls' },
  { key: 'email.smtp.username', schema: z.string().max(320), default: '' },
  { key: 'email.smtp.password', schema: z.string().max(1024), default: '', secret: true },
  { key: 'email.from', schema: optionalEmail, default: '' },
  { key: 'email.replyTo', schema: optionalEmail, default: '' },
  { key: 'email.digestMinutes', schema: z.number().int().min(1).max(1440), default: 10 },
];

export interface SmtpConfig {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
}

export interface EmailConfig {
  provider: EmailProviderId;
  smtp: SmtpConfig;
  /** Never empty: falls back to an address at the public URL's host. */
  from: string;
  replyTo: string | null;
  digestMinutes: number;
}

export async function readEmailConfig(
  settings: SettingsService,
  publicUrl: string,
): Promise<EmailConfig> {
  const [provider, host, port, security, username, password, from, replyTo, digestMinutes] =
    await Promise.all([
      settings.get('email.provider'),
      settings.get('email.smtp.host'),
      settings.get('email.smtp.port'),
      settings.get('email.smtp.security'),
      settings.get('email.smtp.username'),
      settings.get('email.smtp.password'),
      settings.get('email.from'),
      settings.get('email.replyTo'),
      settings.get('email.digestMinutes'),
    ]);
  return {
    provider,
    smtp: { host, port, security, username, password },
    from: from || `bemmoly@${new URL(publicUrl).hostname}`,
    replyTo: replyTo || null,
    digestMinutes,
  };
}

/**
 * For the system service's SMTP health check: email counts as configured once
 * the provider is SMTP with a host. The log provider delivers only to the dev
 * mailbox, so it is reported as not configured.
 */
export function createEmailConfigurationProbe(settings: SettingsService): {
  describe(): Promise<{ configured: boolean; value: string }>;
} {
  return {
    async describe() {
      const [provider, host, port] = await Promise.all([
        settings.get('email.provider'),
        settings.get('email.smtp.host'),
        settings.get('email.smtp.port'),
      ]);
      if (provider === 'smtp' && host) return { configured: true, value: `${host}:${port}` };
      return { configured: false, value: provider === 'log' ? 'log (dev mailbox)' : provider };
    },
  };
}
