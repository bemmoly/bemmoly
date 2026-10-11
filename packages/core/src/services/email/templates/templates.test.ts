import { buildCustomTheme } from '@bemmoly/ui/custom-theme';
import { themeSource } from '@bemmoly/ui/tokens';
import { describe, expect, it } from 'vitest';
import {
  backupFailedEmail,
  digestEmail,
  emailTheme,
  invitationEmail,
  notificationEmail,
  passwordResetEmail,
  renderEmail,
  testEmail,
  updateAvailableEmail,
  type EmailContent,
  type EmailFrame,
} from './index.ts';

const brand = {
  workspaceName: 'Acme Labs',
  colors: buildCustomTheme({ brand: '#f97316', surface: 'neutral' }).light,
  logoUrl: null,
  fontStack: "'IBM Plex Sans', system-ui, sans-serif",
};
const at = new Date('2026-10-07T09:30:00Z');
const UNSUBSCRIBE = 'https://bemmoly.example.com/unsubscribe?token=abc.def';

function frame(reason: string, unsubscribe: boolean): EmailFrame {
  return {
    brand,
    theme: emailTheme(brand),
    reason,
    unsubscribeUrl: unsubscribe ? UNSUBSCRIBE : null,
    preferencesUrl: unsubscribe ? 'https://bemmoly.example.com/settings/notifications' : null,
  };
}

/** Every character React escapes in a text node, the way it escapes them. */
const TEXT_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};
const asHtmlText = (value: string) =>
  value.replace(/[&<>"']/g, (char) => TEXT_ENTITIES[char] ?? char);

const notificationFrame = frame("You're receiving this because you watch PLT-204.", true);
const accountFrame = frame("You're receiving this because Aisha K. invited this address.", false);

const cases: ReadonlyArray<[string, EmailFrame, EmailContent]> = [
  [
    'invitation',
    accountFrame,
    invitationEmail(accountFrame, {
      inviterName: 'Aisha K.',
      acceptUrl: 'https://bemmoly.example.com/invitations/tok',
      expiresAt: at,
      message: 'Welcome aboard!',
    }),
  ],
  [
    'password reset',
    accountFrame,
    passwordResetEmail(accountFrame, {
      name: 'Rohan',
      resetUrl: 'https://bemmoly.example.com/reset/tok',
      expiresAt: at,
    }),
  ],
  ['test', accountFrame, testEmail(accountFrame, { provider: 'smtp', requestedBy: 'Rohan' })],
  [
    'notification',
    notificationFrame,
    notificationEmail(notificationFrame, {
      lead: 'Jonas M. commented on',
      targetLabel: 'PLT-204',
      targetUrl: 'https://bemmoly.example.com/issues/PLT-204',
      body: 'Rollback section says 15 min but the flag TTL is 30. Which is it?',
      createdAt: at,
      hasActor: true,
    }),
  ],
  [
    'digest',
    notificationFrame,
    digestEmail(notificationFrame, {
      lines: [
        {
          lead: 'Aisha K. and 2 others commented on',
          targetLabel: 'PLT-204',
          targetUrl: 'https://bemmoly.example.com/issues/PLT-204',
          body: 'Backfill finished on staging.',
          createdAt: at,
        },
        {
          lead: 'Lena T. moved',
          targetLabel: 'PLT-226',
          targetUrl: null,
          body: 'In progress → In review',
          createdAt: at,
        },
      ],
      moreCount: 3,
      inboxUrl: 'https://bemmoly.example.com/inbox',
      period: 'since the last email',
    }),
  ],
  [
    'backup failed',
    notificationFrame,
    backupFailedEmail(notificationFrame, {
      error: 'The backup destination refused the upload: disk full.',
      backupKind: 'scheduled',
      startedAt: at,
      backupsUrl: 'https://bemmoly.example.com/settings/backups',
    }),
  ],
  [
    'update available',
    notificationFrame,
    updateAvailableEmail(notificationFrame, {
      version: '0.2.0',
      currentVersion: '0.1.0',
      notesUrl: 'https://bemmoly.example.com/notes',
      updatesUrl: 'https://bemmoly.example.com/settings/updates',
    }),
  ],
];

describe('email templates', () => {
  it.each(cases)('renders the %s email to HTML and text', async (name, used, content) => {
    const email = await renderEmail(used, content);
    expect(email.subject).toMatchSnapshot(`${name} subject`);
    expect(email.html).toMatchSnapshot(`${name} html`);
    expect(email.text).toMatchSnapshot(`${name} text`);
  });

  it.each(cases)(
    'the %s email states why it was sent, in both parts',
    async (_name, used, content) => {
      const email = await renderEmail(used, content);
      expect(email.text.length).toBeGreaterThan(40);
      expect(email.html).toContain(asHtmlText(used.reason));
      expect(email.text).toContain(used.reason);
      expect(email.html).toContain('Acme Labs');
    },
  );

  it.each(cases.filter(([, used]) => used.unsubscribeUrl))(
    'the %s email links to its unsubscribe page',
    async (_name, used, content) => {
      const email = await renderEmail(used, content);
      expect(email.html).toContain(`href="${UNSUBSCRIBE}"`);
      expect(email.text).toContain(UNSUBSCRIBE);
    },
  );

  it('escapes every markup character in the reason line', async () => {
    const [, used, content] = cases[0]!;
    const reason = `You're in <b>"R&D"</b>`;
    const email = await renderEmail({ ...used, reason }, content);
    expect(email.html).toContain(asHtmlText(reason));
    expect(email.html).not.toContain('<b>');
  });

  it('themes buttons from the brand colour', async () => {
    const [, used, content] = cases[3]!;
    const email = await renderEmail(used, content);
    expect(email.html).toContain(used.theme.button);
  });
});

describe('emailTheme', () => {
  it('takes every colour from the theme light set', () => {
    expect(emailTheme({ ...brand, colors: themeSource('pine').light })).toMatchObject({
      button: '#17675a',
      onButton: '#ffffff',
      link: '#17675a',
      page: themeSource('pine').light.sunken,
    });
  });

  it('uses the checked custom ramp, never the raw brand, for a light brand colour', () => {
    const theme = emailTheme(brand);
    expect(theme.button).not.toBe('#f97316');
    expect(theme.link).not.toBe('#f97316');
    expect(theme.onButton).toBe('#ffffff');
  });
});
