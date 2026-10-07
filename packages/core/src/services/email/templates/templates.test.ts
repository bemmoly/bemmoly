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
  accent: '#f97316',
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
      const reason = used.reason.replace("'", '&#x27;');
      expect(email.html).toContain(reason);
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

  it('themes buttons from the brand colour', async () => {
    const [, used, content] = cases[3]!;
    const email = await renderEmail(used, content);
    expect(email.html).toContain(used.theme.button);
  });
});

describe('emailTheme', () => {
  it('keeps a dark brand colour for buttons with white text', () => {
    expect(emailTheme({ ...brand, accent: '#2456c9' })).toMatchObject({
      button: '#2456c9',
      onButton: '#ffffff',
      link: '#2456c9',
    });
  });

  it('darkens a mid-tone brand colour so white text stays readable', () => {
    const theme = emailTheme({ ...brand, accent: '#16a34a' });
    expect(theme.button).not.toBe('#16a34a');
    expect(theme.onButton).toBe('#ffffff');
  });

  it('uses dark text on a brand colour too light for white, and a darker link', () => {
    for (const accent of ['#f97316', '#fde68a']) {
      const theme = emailTheme({ ...brand, accent });
      expect(theme.onButton).not.toBe('#ffffff');
      expect(theme.link).not.toBe(accent);
    }
  });

  it('falls back to the Classic accent for a malformed colour', () => {
    expect(emailTheme({ ...brand, accent: 'orange' }).accent).toBe('#2456c9');
  });
});
