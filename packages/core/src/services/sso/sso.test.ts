import { describe, expect, it } from 'vitest';
import { claimGroups, claimString } from './protocols/claims.ts';
import { guardSamlXml, readAssertionFacts } from './protocols/saml-guard.ts';
import { safeReturnTo } from './return-to.ts';

const NS =
  'xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"';
const assertion = (id: string, extra = '') =>
  `<saml:Assertion ID="${id}"><saml:Issuer>idp</saml:Issuer>${extra}</saml:Assertion>`;

describe('safeReturnTo', () => {
  it.each([
    ['/work/issues?view=board#top', '/work/issues?view=board#top'],
    ['/', '/'],
    [undefined, '/'],
    ['', '/'],
    ['https://evil.test/', '/'],
    ['//evil.test/path', '/'],
    ['/\\evil.test', '/'],
    ['/%2F%2Fevil.test', '/%2F%2Fevil.test'],
    ['javascript:alert(1)', '/'],
    ['/ok\nSet-Cookie: x', '/'],
    [`/${'a'.repeat(3000)}`, '/'],
  ])('%s lands on %s', (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});

describe('claims', () => {
  it('reads one string or the first of a list', () => {
    expect(claimString(' ada@acme.dev ')).toBe('ada@acme.dev');
    expect(claimString(['first', 'second'])).toBe('first');
    expect(claimString(42)).toBeNull();
    expect(claimString('   ')).toBeNull();
  });

  it('bounds and de-duplicates groups', () => {
    expect(claimGroups(['a', 'a', ' b ', 3, ''])).toEqual(['a', 'b']);
    expect(claimGroups('solo')).toEqual(['solo']);
    expect(claimGroups(undefined)).toEqual([]);
    expect(claimGroups(Array.from({ length: 900 }, (_, i) => `g${i}`))).toHaveLength(500);
    expect(claimGroups(['x'.repeat(300)])).toEqual([]);
  });
});

describe('the SAML structural guard', () => {
  it('accepts a response with exactly one assertion', async () => {
    await expect(
      guardSamlXml(`<samlp:Response ${NS}>${assertion('_a')}</samlp:Response>`),
    ).resolves.toBe(true);
  });

  it.each([
    [
      'a DTD',
      `<!DOCTYPE x [<!ENTITY e "x">]><samlp:Response ${NS}>${assertion('_a')}</samlp:Response>`,
    ],
    [
      'two assertions',
      `<samlp:Response ${NS}>${assertion('_a')}${assertion('_b')}</samlp:Response>`,
    ],
    ['no assertion', `<samlp:Response ${NS}></samlp:Response>`],
    ['an encrypted assertion', `<samlp:Response ${NS}><saml:EncryptedAssertion/></samlp:Response>`],
    ['a request instead of a response', `<samlp:AuthnRequest ${NS}/>`],
    ['broken XML', `<samlp:Response ${NS}><saml:Assertion>`],
  ])('refuses %s', async (_name, xml) => {
    await expect(guardSamlXml(xml)).rejects.toMatchObject({ reason: 'invalid_response' });
  });

  it('sees whether the assertion signs itself', () => {
    const signature = (uri: string) =>
      `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:Reference URI="${uri}"/></ds:SignedInfo></ds:Signature>`;
    const signed = readAssertionFacts(
      `<samlp:Response ${NS}>${assertion('_a', signature('#_a'))}</samlp:Response>`,
    );
    expect(signed).toMatchObject({ assertionId: '_a', assertionSigned: true });
    const other = readAssertionFacts(
      `<samlp:Response ${NS}>${assertion('_a', signature('#_other'))}</samlp:Response>`,
    );
    expect(other.assertionSigned).toBe(false);
  });
});
