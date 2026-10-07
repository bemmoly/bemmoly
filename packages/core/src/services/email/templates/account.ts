import { createElement as h, Fragment } from 'react';
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

export function passwordResetEmail(frame: EmailFrame, data: PasswordResetEmailData): EmailContent {
  const { theme, brand } = frame;
  return {
    subject: `Reset your ${brand.workspaceName} password`,
    preview: 'Choose a new password',
    body: h(
      Fragment,
      null,
      h(Title, { theme }, 'Reset your password'),
      h(
        Paragraph,
        { theme },
        `${data.name ? `Hi ${data.name}, s` : 'S'}omeone asked to reset the password for your ${brand.workspaceName} account. Choose a new one with the button below.`,
      ),
      h(ActionButton, { theme, href: data.resetUrl }, 'Choose a new password'),
      h(
        Muted,
        { theme },
        `The link works once and expires ${formatDateTime(data.expiresAt)}. If you did not ask for this, ignore this email; your password stays the same.`,
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
