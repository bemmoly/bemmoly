import * as samlify from 'samlify';
import {
  SsoFailure,
  type CompleteInput,
  type ExternalIdentity,
  type ProtocolFactory,
  type ServiceProviderUrls,
  type StoredSamlConfig,
} from '../protocol.ts';
import { claimGroups, claimString } from './claims.ts';
import { guardSamlXml, readAssertionFacts, type AssertionFacts } from './saml-guard.ts';

/** Clocks of the two sides may disagree a little; more than this is a stale or forged message. */
export const SAML_CLOCK_SKEW_MS = 2 * 60 * 1000;

samlify.setSchemaValidator({ validate: guardSamlXml });

const BINDING = samlify.Constants.namespace.binding;

export function serviceProviderOf(urls: ServiceProviderUrls) {
  return samlify.ServiceProvider({
    entityID: urls.entityId,
    authnRequestsSigned: false,
    wantAssertionsSigned: true,
    wantMessageSigned: false,
    assertionConsumerService: [{ Binding: BINDING.post, Location: urls.callbackUrl }],
    nameIDFormat: [samlify.Constants.namespace.format.emailAddress],
    clockDrifts: [-SAML_CLOCK_SKEW_MS, SAML_CLOCK_SKEW_MS],
  });
}

function identityProviderOf(config: StoredSamlConfig) {
  return samlify.IdentityProvider({
    entityID: config.idpEntityId,
    signingCert: config.idpCertificate,
    wantAuthnRequestsSigned: false,
    singleSignOnService: [{ Binding: BINDING.redirect, Location: config.idpSsoUrl }],
  });
}

/** The SP metadata document an admin uploads to the identity provider. */
export function serviceProviderMetadata(urls: ServiceProviderUrls): string {
  return serviceProviderOf(urls).getMetadata();
}

const fail = (reason: 'invalid_response' | 'replayed' | 'expired', message: string) => {
  throw new SsoFailure(reason, message);
};

const audiencesOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (entry): entry is string => typeof entry === 'string',
  );

/** What samlify leaves to the caller: audience, recipient, InResponseTo, time and signature. */
function checkAssertion(
  facts: AssertionFacts,
  extract: Record<string, unknown>,
  input: CompleteInput,
): void {
  const { urls, requestId, now } = input;
  if (!facts.assertionSigned) fail('invalid_response', 'The assertion itself must be signed');
  const response = (extract['response'] ?? {}) as Record<string, string | undefined>;
  if (!requestId || response['inResponseTo'] !== requestId) {
    fail('replayed', 'The response does not answer the sign-in this browser started');
  }
  if (facts.inResponseTo && facts.inResponseTo !== requestId) {
    fail('replayed', 'The subject confirmation answers another request');
  }
  if (response['destination'] && response['destination'] !== urls.callbackUrl) {
    fail('invalid_response', `The response was sent to ${response['destination']}`);
  }
  if (facts.recipient !== urls.callbackUrl) {
    fail('invalid_response', 'The assertion names another recipient');
  }
  if (!audiencesOf(extract['audience']).includes(urls.entityId)) {
    fail('invalid_response', `The assertion's audience is not ${urls.entityId}`);
  }
  const late = now.getTime() - SAML_CLOCK_SKEW_MS;
  const early = now.getTime() + SAML_CLOCK_SKEW_MS;
  if (!facts.notOnOrAfter || facts.notOnOrAfter.getTime() <= late) {
    fail('expired', 'The assertion has expired or has no expiry');
  }
  if (facts.notBefore && facts.notBefore.getTime() > early) {
    fail('invalid_response', 'The assertion is not valid yet');
  }
  if (facts.confirmationNotOnOrAfter && facts.confirmationNotOnOrAfter.getTime() <= late) {
    fail('expired', 'The subject confirmation has expired');
  }
}

function failureOf(error: unknown): SsoFailure {
  if (error instanceof SsoFailure) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/SIGNATURE/i.test(message)) {
    return new SsoFailure('invalid_response', 'The assertion signature did not verify', {
      cause: error,
    });
  }
  if (/ERR_FAILED_STATUS/.test(message)) {
    return new SsoFailure('provider_error', 'The identity provider refused the sign-in', {
      cause: error,
    });
  }
  if (/EXPIRED|UNCONFIRMED/.test(message)) {
    return new SsoFailure('expired', 'The assertion is outside its validity window', {
      cause: error,
    });
  }
  return new SsoFailure('invalid_response', `The SAML response did not verify: ${message}`, {
    cause: error,
  });
}

/**
 * SAML 2.0 Web SSO: an unsigned AuthnRequest over the redirect binding, and a response over
 * the POST binding whose assertion must be signed by the configured certificate and must
 * answer this request, name this service provider as audience and recipient, and be current.
 */
export const createSamlProtocol: ProtocolFactory<StoredSamlConfig> = (config) => ({
  async begin({ state, urls }) {
    const sp = serviceProviderOf(urls);
    const request = sp.createLoginRequest(identityProviderOf(config), 'redirect', {
      relayState: state,
    });
    return { redirectUrl: request.context, secrets: {}, requestId: request.id };
  },

  async complete(input): Promise<ExternalIdentity> {
    const { params, urls } = input;
    const sp = serviceProviderOf(urls);
    try {
      const result = await sp.parseLoginResponse(identityProviderOf(config), 'post', {
        body: { SAMLResponse: params['SAMLResponse'], RelayState: params['RelayState'] },
      });
      const extract = result.extract as Record<string, unknown>;
      const facts = readAssertionFacts(result.samlContent);
      checkAssertion(facts, extract, input);
      const attributes = (extract['attributes'] ?? {}) as Record<string, unknown>;
      const nameId = claimString(extract['nameID']);
      if (!nameId) throw new SsoFailure('invalid_response', 'The assertion has no NameID');
      const email =
        claimString(attributes[config.emailAttribute]) ?? (nameId.includes('@') ? nameId : null);
      return {
        subject: nameId,
        email: email?.toLowerCase() ?? null,
        // A signed assertion is the identity provider vouching for the address.
        emailVerified: email !== null,
        name: claimString(attributes[config.nameAttribute]),
        groups: claimGroups(attributes[config.groupsAttribute]),
        // Remembered until no clock skew could make it acceptable again.
        assertion: {
          id: facts.assertionId,
          expiresAt: new Date(facts.notOnOrAfter!.getTime() + SAML_CLOCK_SKEW_MS),
        },
      };
    } catch (error) {
      throw failureOf(error);
    }
  },
});
