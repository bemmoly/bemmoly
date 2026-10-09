import { ValidationError } from '@bemmoly/shared';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { TEST_SECRET_KEY } from '../../testing/fakes.ts';
import { checkDeliverability, fromDomain } from './deliverability.ts';
import { absoluteUrl } from './context.ts';
import { createUnsubscribeSigner, unsubscribeLinks } from './unsubscribe.ts';

describe('unsubscribe tokens', () => {
  const signer = createUnsubscribeSigner(TEST_SECRET_KEY);
  const claim = { userId: '0199c3a2-0000-7000-8000-000000000001', scope: 'comment' };

  it('round-trips a claim', () => {
    expect(signer.verify(signer.sign(claim))).toEqual(claim);
  });

  it('rejects a tampered claim, a foreign key and junk', () => {
    const token = signer.sign(claim);
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ v: 1, u: claim.userId, s: 'mention' })).toString('base64url')}.${signature}`;
    const other = createUnsubscribeSigner(Buffer.alloc(32, 1).toString('base64'));
    for (const bad of [forged, other.sign(claim), 'junk', `${token}.x`]) {
      expect(() => signer.verify(bad)).toThrow(ValidationError);
    }
  });

  it('builds the page link and RFC 8058 one-click headers', () => {
    const links = unsubscribeLinks('https://bemmoly.example.com/', 'a.b');
    expect(links.pageUrl).toBe('https://bemmoly.example.com/unsubscribe?token=a.b');
    expect(links.headers).toEqual({
      'List-Unsubscribe': '<https://bemmoly.example.com/api/v1/email-unsubscriptions?token=a.b>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('joins links in linear time, whatever run of slashes the URL holds', () => {
    expect(absoluteUrl('https://b.test//', '//inbox')).toBe('https://b.test/inbox');
    const slashes = '/'.repeat(100_000);
    const start = performance.now();
    unsubscribeLinks(`https://b.test${slashes}x`, 'a.b');
    absoluteUrl(`https://b.test${slashes}x`, `${slashes}x`);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe('deliverability check', () => {
  const lookupOf = (records: Record<string, string[]>) => async (name: string) => {
    const found = records[name];
    if (found === undefined) throw new Error('SERVFAIL');
    return found;
  };

  it('skips addresses without a real domain', async () => {
    expect(fromDomain('bemmoly@localhost')).toBeNull();
    expect(
      await checkDeliverability(lookupOf({}), 'bemmoly@localhost', 'smtp.acme.test'),
    ).toBeNull();
  });

  it('suggests SPF and DMARC records when both are missing', async () => {
    const check = await checkDeliverability(
      lookupOf({ 'acme.test': ['google-site-verification=x'], '_dmarc.acme.test': [] }),
      'bemmoly@acme.test',
      'smtp.relay.test',
    );
    expect(check?.spf).toMatchObject({
      status: 'missing',
      suggested: { host: 'acme.test', type: 'TXT', value: 'v=spf1 a mx a:smtp.relay.test ~all' },
    });
    expect(check?.dmarc).toMatchObject({
      status: 'missing',
      suggested: {
        host: '_dmarc.acme.test',
        value: 'v=DMARC1; p=none; rua=mailto:dmarc@acme.test',
      },
    });
  });

  it('accepts published records and flags duplicates and +all', async () => {
    const ok = await checkDeliverability(
      lookupOf({
        'acme.test': ['v=spf1 include:relay.test ~all'],
        '_dmarc.acme.test': ['v=DMARC1; p=reject'],
      }),
      'bemmoly@acme.test',
      'relay.test',
    );
    expect(ok?.spf.status).toBe('ok');
    expect(ok?.dmarc.status).toBe('ok');
    const bad = await checkDeliverability(
      lookupOf({ 'acme.test': ['v=spf1 a ~all', 'v=spf1 mx ~all'], '_dmarc.acme.test': [] }),
      'bemmoly@acme.test',
      'relay.test',
    );
    expect(bad?.spf.status).toBe('invalid');
    const open = await checkDeliverability(
      lookupOf({ 'acme.test': ['v=spf1 +all'], '_dmarc.acme.test': [] }),
      'bemmoly@acme.test',
      'relay.test',
    );
    expect(open?.spf).toMatchObject({ status: 'invalid', suggested: { value: 'v=spf1 ~all' } });
  });

  it('reports unknown when the resolver fails', async () => {
    const check = await checkDeliverability(lookupOf({}), 'bemmoly@acme.test', 'relay.test');
    expect(check?.spf.status).toBe('unknown');
    expect(check?.dmarc.status).toBe('unknown');
  });
});
