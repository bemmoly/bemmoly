import type { EmailTestResult, OutboxSummary } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { validateForm } from '../lib/errors.ts';
import { emailFormSchema, emailWrites, type EmailForm } from './use-email-form.ts';
import {
  dnsCheck,
  outboxCounts,
  outboxStatus,
  sinceLabel,
  testResultView,
} from './use-email-results.ts';

const FORM: EmailForm = {
  provider: 'smtp',
  host: 'smtp.acmelabs.dev',
  port: '587',
  security: 'starttls',
  username: 'bemmoly',
  password: '',
  from: 'Bemmoly <bemmoly@acmelabs.dev>',
  replyTo: '',
  digestMinutes: '10',
};

const valid = (form: EmailForm) => {
  const result = validateForm(emailFormSchema, form);
  if (!result.data) throw new Error(JSON.stringify(result.errors));
  return result.data;
};

describe('email form', () => {
  it('leaves the stored password alone when the field is blank', () => {
    const writes = emailWrites(valid(FORM));
    expect(writes).not.toHaveProperty('email.smtp.password');
    expect(writes).toMatchObject({
      'email.provider': 'smtp',
      'email.smtp.port': 587,
      'email.digestMinutes': 10,
      'email.replyTo': null,
    });
  });

  it('sends a password only when one was typed', () => {
    expect(emailWrites(valid({ ...FORM, password: 'hunter2' }))['email.smtp.password']).toBe(
      'hunter2',
    );
  });

  it('asks for a host only when SMTP is the provider', () => {
    expect(validateForm(emailFormSchema, { ...FORM, host: ' ' }).errors?.['host']).toMatch(
      /SMTP server/,
    );
    expect(validateForm(emailFormSchema, { ...FORM, provider: 'log', host: '' }).errors).toBeNull();
  });

  it('explains a bad port, from address, reply-to and digest interval', () => {
    const errors = validateForm(emailFormSchema, {
      ...FORM,
      port: '70000',
      from: 'bemmoly',
      replyTo: 'nope',
      digestMinutes: '0',
    }).errors;
    expect(errors?.['port']).toBe('Ports run from 1 to 65535');
    expect(errors?.['from']).toMatch(/address mail comes from/);
    expect(errors?.['replyTo']).toMatch(/valid email/);
    expect(errors?.['digestMinutes']).toMatch(/1 to 1440/);
  });
});

const SENT: EmailTestResult = {
  sent: true,
  provider: 'smtp',
  to: 'rohan@acmelabs.dev',
  messageId: '<1@acmelabs.dev>',
  failure: null,
  deliverability: {
    domain: 'acmelabs.dev',
    spf: 'pass',
    dmarc: { status: 'missing', record: '_dmarc.acmelabs.dev TXT "v=DMARC1; p=none"' },
  },
};

describe('test send result', () => {
  it('says where a sent test went and what DNS records to add', () => {
    const view = testResultView(SENT);
    expect(view.sent).toBe(true);
    expect(view.headline).toBe('Sent to rohan@acmelabs.dev through your SMTP relay.');
    expect(view.dns).toEqual([
      { name: 'SPF', status: 'pass', ok: true, toAdd: null, found: null },
      {
        name: 'DMARC',
        status: 'missing',
        ok: false,
        toAdd: '_dmarc.acmelabs.dev TXT "v=DMARC1; p=none"',
        found: null,
      },
    ]);
  });

  it('points the log provider at the dev mailbox', () => {
    expect(testResultView({ ...SENT, provider: 'log' }).headline).toMatch(/dev mailbox/);
  });

  it("reports a failure in the server's words with the stage", () => {
    const view = testResultView({
      ...SENT,
      sent: false,
      messageId: null,
      deliverability: null,
      failure: {
        stage: 'auth',
        message: 'smtp.fail.dev rejected the username and password.',
        serverResponse: '535 5.7.8 Authentication rejected',
      },
    });
    expect(view).toMatchObject({
      sent: false,
      headline: 'smtp.fail.dev rejected the username and password.',
      stage: 'auth',
      serverResponse: '535 5.7.8 Authentication rejected',
      dns: [],
    });
  });

  it('prefers the expected record and shows a found one when the check passed', () => {
    expect(
      dnsCheck('SPF', { status: 'fail', record: 'v=spf1 -all', expected: 'v=spf1 a ~all' }),
    ).toMatchObject({ ok: false, toAdd: 'v=spf1 a ~all' });
    expect(dnsCheck('SPF', { status: 'PASS', record: 'v=spf1 a ~all' })).toMatchObject({
      ok: true,
      status: 'pass',
      found: 'v=spf1 a ~all',
    });
  });
});

describe('outbox', () => {
  const now = new Date(2026, 9, 8, 12);
  const summary: OutboxSummary = {
    counts: { failed: 3, sent: 128, queued: 0 },
    failures: {
      count: 3,
      since: new Date(2026, 9, 6, 9).toISOString(),
      topReason: 'authentication rejected',
    },
    recentFailures: [],
  };

  it('names the day failures started and the top reason', () => {
    expect(outboxStatus(summary, now)).toBe(
      '3 emails failed since Tuesday: authentication rejected',
    );
    expect(
      outboxStatus({ ...summary, failures: { count: 1, since: null, topReason: null } }, now),
    ).toBe('1 email failed.');
    expect(outboxStatus({ ...summary, failures: null }, now)).toBe('No emails have failed.');
  });

  it('says today and yesterday in words', () => {
    expect(sinceLabel(new Date(2026, 9, 8, 1).toISOString(), now)).toBe('today');
    expect(sinceLabel(new Date(2026, 9, 7, 1).toISOString(), now)).toBe('yesterday');
  });

  it('orders counts queued, sent, failed', () => {
    expect(outboxCounts(summary).map((entry) => entry.label)).toEqual(['queued', 'sent', 'failed']);
  });
});
