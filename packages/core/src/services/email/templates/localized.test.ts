import { describe, expect, it } from 'vitest';
import { passwordResetEmail } from './account.ts';
import { renderEmail } from './render.ts';
import { DEFAULT_BRAND, emailTheme } from './theme.ts';

describe('the password reset email, written through the catalog', () => {
  const at = new Date('2026-10-11T14:32:00Z');
  const frame = {
    brand: DEFAULT_BRAND,
    theme: emailTheme(DEFAULT_BRAND),
    reason: 'Because.',
    unsubscribeUrl: null,
    preferencesUrl: null,
  };

  it('reads as it always has in English, dates included', async () => {
    const content = passwordResetEmail(
      { ...frame, locale: 'en' },
      { resetUrl: 'https://x.test/reset', expiresAt: at },
    );
    const email = await renderEmail({ ...frame, locale: 'en' }, content);
    expect(email.subject).toBe(`Reset your ${DEFAULT_BRAND.workspaceName} password`);
    expect(email.text).toContain('Someone asked to reset the password');
    expect(email.text).toContain('expires 11 Oct 2026, 14:32 UTC');
    expect(email.html).toContain('lang="en"');
  });
});
