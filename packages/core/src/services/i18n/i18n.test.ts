import { describe, expect, it } from 'vitest';
import { serverLocale, serverText } from './index.ts';

describe('server text', () => {
  it('formats ICU messages, selects included', () => {
    const t = serverText('en');
    expect(t('email.passwordReset.subject', { workspace: 'Acme Labs' })).toBe(
      'Reset your Acme Labs password',
    );
    expect(
      t('email.passwordReset.body', { named: 'yes', name: 'Rohan', workspace: 'Acme' }),
    ).toMatch(/^Hi Rohan, someone asked to reset the password for your Acme account\./);
    expect(t('email.passwordReset.body', { named: 'no', name: '', workspace: 'Acme' })).toMatch(
      /^Someone asked/,
    );
    expect(t('email.passwordReset.reason')).toBe(
      "You're receiving this because someone asked to reset the password for this address.",
    );
  });

  it('picks the nearest shipped locale and falls back to English', () => {
    expect(serverLocale('fr-FR', 'de')).toBe('en');
    expect(serverLocale(null, 'en-GB')).toBe('en');
    expect(serverLocale()).toBe('en');
    expect(serverText('fr')('email.passwordReset.title')).toBe('Reset your password');
  });
});
