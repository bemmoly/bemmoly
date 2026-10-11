import { createElement as h, Fragment } from 'react';
import { serverText } from '../../i18n/index.ts';
import type { EmailContent, EmailFrame } from './layout.ts';
import { ActionButton, formatDateTime, Muted, Paragraph, Quote, Title } from './parts.ts';

export interface InvitationEmailData {
  inviterName: string;
  acceptUrl: string;
  expiresAt: Date;
  message?: string | undefined;
}

export function invitationEmail(frame: EmailFrame, data: InvitationEmailData): EmailContent {
  const { theme, brand } = frame;
  return {
    subject: `${data.inviterName} invited you to ${brand.workspaceName}`,
    preview: `Join ${brand.workspaceName} on Bemmoly`,
    body: h(
      Fragment,
      null,
      h(Title, { theme }, `Join ${brand.workspaceName}`),
      h(
        Paragraph,
        { theme },
        `${data.inviterName} invited you to ${brand.workspaceName}, where the team keeps its issues and docs.`,
      ),
      data.message ? h(Quote, { theme }, data.message) : null,
      h(ActionButton, { theme, href: data.acceptUrl }, 'Accept invitation'),
      h(Muted, { theme }, `This invitation expires ${formatDateTime(data.expiresAt)}.`),
    ),
  };
}

export interface PasswordResetEmailData {
  name?: string | undefined;
  resetUrl: string;
  expiresAt: Date;
}

/** The worked example of an email written through the server catalog (ADR 0024). */
export function passwordResetEmail(frame: EmailFrame, data: PasswordResetEmailData): EmailContent {
  const { theme, brand, locale } = frame;
  const t = serverText(locale);
  const workspace = brand.workspaceName;
  return {
    subject: t('email.passwordReset.subject', { workspace }),
    preview: t('email.passwordReset.preview'),
    body: h(
      Fragment,
      null,
      h(Title, { theme }, t('email.passwordReset.title')),
      h(
        Paragraph,
        { theme },
        t('email.passwordReset.body', {
          named: data.name ? 'yes' : 'no',
          name: data.name ?? '',
          workspace,
        }),
      ),
      h(ActionButton, { theme, href: data.resetUrl }, t('email.passwordReset.action')),
      h(
        Muted,
        { theme },
        t('email.passwordReset.expiry', { expires: formatDateTime(data.expiresAt, locale) }),
      ),
    ),
  };
}

export interface TestEmailData {
  provider: string;
  requestedBy: string;
}

export function testEmail(frame: EmailFrame, data: TestEmailData): EmailContent {
  const { theme, brand } = frame;
  return {
    subject: `Test email from ${brand.workspaceName}`,
    preview: 'Email delivery works',
    body: h(
      Fragment,
      null,
      h(Title, { theme }, 'Email delivery works'),
      h(
        Paragraph,
        { theme },
        `${data.requestedBy} sent this test from Settings › Email. If you are reading it, ${brand.workspaceName} can send email through the ${data.provider} provider.`,
      ),
      h(
        Muted,
        { theme },
        'Invitations, password resets and notifications will arrive the same way.',
      ),
    ),
  };
}
