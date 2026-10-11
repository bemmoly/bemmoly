import { randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import * as samlify from 'samlify';
import { generate } from 'selfsigned';

export interface FakeSamlUser {
  email: string;
  name?: string;
  groups?: string[];
}

/** Ways a response can be wrong, one per check the service provider must make. */
export interface FakeSamlTampering {
  audience?: string;
  recipient?: string;
  destination?: string;
  inResponseTo?: string;
  issuer?: string;
  /** Minutes from now; negative is already expired. */
  expiresInMinutes?: number;
  notBeforeInMinutes?: number;
  assertionId?: string;
  /** `foreign`: a key other than the configured certificate; `response`: only the envelope. */
  signing?: 'assertion' | 'response' | 'none' | 'foreign';
  /** Wraps a second, unsigned assertion for another person around the signed one. */
  wrapAnotherAssertion?: string;
}

export interface FakeSamlIdp {
  entityId: string;
  ssoUrl: string;
  /** PEM, what an admin pastes into Settings. */
  certificate: string;
  /** The AuthnRequest id and RelayState from the service provider's redirect. */
  readRequest(location: string): { id: string; relayState: string };
  /** A base64 SAMLResponse for the POST binding. */
  respond(input: {
    callbackUrl: string;
    entityId: string;
    requestId: string;
    user: FakeSamlUser;
    tamper?: FakeSamlTampering;
  }): Promise<string>;
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function attributeStatement(user: FakeSamlUser): string {
  const attribute = (name: string, values: string[]) =>
    `<saml:Attribute Name="${name}">${values
      .map(
        (value) =>
          `<saml:AttributeValue xsi:type="xs:string">${escape(value)}</saml:AttributeValue>`,
      )
      .join('')}</saml:Attribute>`;
  return `<saml:AttributeStatement>${attribute('email', [user.email])}${
    user.name ? attribute('name', [user.name]) : ''
  }${user.groups?.length ? attribute('groups', user.groups) : ''}</saml:AttributeStatement>`;
}

function responseXml(input: Parameters<FakeSamlIdp['respond']>[0], issuer: string): string {
  const t = input.tamper ?? {};
  const now = new Date();
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
  const assertionId = t.assertionId ?? `_${randomUUID()}`;
  const inResponseTo = t.inResponseTo ?? input.requestId;
  return (
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_${randomUUID()}" Version="2.0" IssueInstant="${now.toISOString()}" Destination="${escape(t.destination ?? input.callbackUrl)}" InResponseTo="${escape(inResponseTo)}">` +
    `<saml:Issuer>${escape(t.issuer ?? issuer)}</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" ID="${escape(assertionId)}" Version="2.0" IssueInstant="${now.toISOString()}">` +
    `<saml:Issuer>${escape(t.issuer ?? issuer)}</saml:Issuer>` +
    `<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${escape(input.user.email)}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="${at(t.expiresInMinutes ?? 5)}" Recipient="${escape(t.recipient ?? input.callbackUrl)}" InResponseTo="${escape(inResponseTo)}"/></saml:SubjectConfirmation></saml:Subject>` +
    `<saml:Conditions NotBefore="${at(t.notBeforeInMinutes ?? -1)}" NotOnOrAfter="${at(t.expiresInMinutes ?? 5)}"><saml:AudienceRestriction><saml:Audience>${escape(t.audience ?? input.entityId)}</saml:Audience></saml:AudienceRestriction></saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${now.toISOString()}" SessionIndex="${assertionId}"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>` +
    `${attributeStatement(input.user)}</saml:Assertion></samlp:Response>`
  );
}

async function keyPair() {
  const pair = await generate([{ name: 'commonName', value: 'fake-idp.test' }], {
    keySize: 2048,
    algorithm: 'sha256',
  });
  return { privateKey: pair.private, certificate: pair.cert };
}

/**
 * A SAML identity provider for tests: a throwaway signing certificate generated at start, and
 * responses built and signed with the SAML library itself, with every field open to tampering.
 */
export async function createFakeSamlIdp(
  entityId = 'https://idp.fake.test/saml',
): Promise<FakeSamlIdp> {
  const own = await keyPair();
  const foreign = await keyPair();
  const ssoUrl = 'https://idp.fake.test/sso';
  const idpWith = (keys: { privateKey: string; certificate: string }) =>
    samlify.IdentityProvider({
      entityID: entityId,
      privateKey: keys.privateKey,
      signingCert: keys.certificate,
      singleSignOnService: [
        { Binding: samlify.Constants.namespace.binding.redirect, Location: ssoUrl },
      ],
    });
  return {
    entityId,
    ssoUrl,
    certificate: own.certificate,
    readRequest(location) {
      const url = new URL(location);
      const xml = inflateRawSync(
        Buffer.from(url.searchParams.get('SAMLRequest') ?? '', 'base64'),
      ).toString('utf8');
      return {
        id: /\sID="([^"]+)"/.exec(xml)?.[1] ?? '',
        relayState: url.searchParams.get('RelayState') ?? '',
      };
    },
    async respond(input) {
      const signing = input.tamper?.signing ?? 'assertion';
      const xml = responseXml(input, entityId);
      if (signing === 'none') return Buffer.from(xml).toString('base64');
      const sp = samlify.ServiceProvider({
        entityID: input.entityId,
        wantAssertionsSigned: signing !== 'response',
        assertionConsumerService: [
          { Binding: samlify.Constants.namespace.binding.post, Location: input.callbackUrl },
        ],
      });
      const idp = idpWith(signing === 'foreign' ? foreign : own);
      const { context } = await idp.createLoginResponse(
        sp,
        { extract: { request: { id: input.requestId } } },
        'post',
        { email: input.user.email },
        { customTagReplacement: () => ({ id: input.requestId, context: xml }) },
      );
      if (!input.tamper?.wrapAnotherAssertion) return context;
      const signed = Buffer.from(context, 'base64').toString('utf8');
      const evil = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_evil" Version="2.0" IssueInstant="${new Date().toISOString()}"><saml:Issuer>${entityId}</saml:Issuer><saml:Subject><saml:NameID>${escape(input.tamper.wrapAnotherAssertion)}</saml:NameID></saml:Subject></saml:Assertion>`;
      return Buffer.from(signed.replace('<samlp:Status>', `${evil}<samlp:Status>`)).toString(
        'base64',
      );
    },
  };
}
