import { DOMParser } from '@xmldom/xmldom';
import { SsoFailure } from '../protocol.ts';

const PROTOCOL_NS = 'urn:oasis:names:tc:SAML:2.0:protocol';
const ASSERTION_NS = 'urn:oasis:names:tc:SAML:2.0:assertion';
const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

function parseStrict(xml: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new SsoFailure('invalid_response', 'The SAML response declares a DTD or entity');
  }
  let failed: string | null = null;
  const parser = new DOMParser({
    errorHandler: (level: string, message: unknown) => {
      if (level !== 'warning') failed = String(message);
    },
  });
  const document = parser.parseFromString(xml, 'text/xml');
  if (failed || !document.documentElement) {
    throw new SsoFailure('invalid_response', `The SAML response is not well-formed XML`);
  }
  return document;
}

const elementsOf = (root: Document | Element, ns: string, name: string): Element[] =>
  Array.from(root.getElementsByTagNameNS(ns, name));

/**
 * The structural check samlify runs on every inbound message before it verifies anything.
 * A full XSD validator would need a native or decades-old WASM build, so this checks what
 * signature wrapping and entity attacks rely on instead: no DTD, a protocol Response at the
 * root, and exactly one assertion, plain (never encrypted, never more than one), so the
 * assertion samlify verified is the one every later check reads.
 */
export async function guardSamlXml(xml: string): Promise<true> {
  const document = parseStrict(xml);
  const root = document.documentElement!;
  if (root.namespaceURI !== PROTOCOL_NS || root.localName !== 'Response') {
    // Requests and logout messages are never accepted by this service provider.
    throw new SsoFailure('invalid_response', 'Only a SAML Response is accepted here');
  }
  if (elementsOf(document, ASSERTION_NS, 'EncryptedAssertion').length > 0) {
    throw new SsoFailure('invalid_response', 'Encrypted assertions are not supported');
  }
  if (elementsOf(document, ASSERTION_NS, 'Assertion').length !== 1) {
    throw new SsoFailure('invalid_response', 'The SAML response must carry exactly one assertion');
  }
  return true;
}

export interface AssertionFacts {
  assertionId: string;
  /** The assertion carries its own enveloped signature over its own id. */
  assertionSigned: boolean;
  recipient: string | null;
  inResponseTo: string | null;
  confirmationNotOnOrAfter: Date | null;
  notBefore: Date | null;
  notOnOrAfter: Date | null;
}

const dateOf = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Reads, from the one assertion the guard allowed, what samlify does not check itself. */
export function readAssertionFacts(xml: string): AssertionFacts {
  const document = parseStrict(xml);
  const [assertion] = elementsOf(document, ASSERTION_NS, 'Assertion');
  if (!assertion) throw new SsoFailure('invalid_response', 'The SAML response has no assertion');
  const assertionId = assertion.getAttribute('ID') ?? '';
  const signature = Array.from(assertion.childNodes as ArrayLike<Node>).find(
    (node): node is Element =>
      node.nodeType === 1 &&
      (node as Element).namespaceURI === DSIG_NS &&
      (node as Element).localName === 'Signature',
  );
  const references = signature ? elementsOf(signature, DSIG_NS, 'Reference') : [];
  const confirmation = elementsOf(assertion, ASSERTION_NS, 'SubjectConfirmationData')[0];
  const conditions = elementsOf(assertion, ASSERTION_NS, 'Conditions')[0];
  return {
    assertionId,
    assertionSigned:
      assertionId.length > 0 &&
      references.length === 1 &&
      references[0]!.getAttribute('URI') === `#${assertionId}`,
    recipient: confirmation?.getAttribute('Recipient') || null,
    inResponseTo: confirmation?.getAttribute('InResponseTo') || null,
    confirmationNotOnOrAfter: dateOf(confirmation?.getAttribute('NotOnOrAfter')),
    notBefore: dateOf(conditions?.getAttribute('NotBefore')),
    notOnOrAfter: dateOf(conditions?.getAttribute('NotOnOrAfter')),
  };
}
