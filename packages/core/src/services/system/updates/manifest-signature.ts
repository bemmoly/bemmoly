import { sign, verify } from 'node:crypto';

/** JSON with object keys sorted at every level, so signer and verifier hash the same bytes. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function unsignedBytes(manifest: Record<string, unknown>): Buffer {
  const rest = { ...manifest };
  delete rest['signature'];
  return Buffer.from(canonicalJson(rest));
}

/**
 * Verifies the ECDSA P-256 signature of a release manifest as fetched, before any
 * defaults are applied, against the release public key shipped in the image.
 */
export function verifyManifestSignature(raw: unknown, publicKeyPem: string): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const manifest = raw as Record<string, unknown>;
  const signature = manifest['signature'] as { algorithm?: unknown; value?: unknown } | undefined;
  if (
    !signature ||
    signature.algorithm !== 'ecdsa-p256-sha256' ||
    typeof signature.value !== 'string'
  ) {
    return false;
  }
  try {
    return verify(
      'sha256',
      unsignedBytes(manifest),
      { key: publicKeyPem, dsaEncoding: 'der' },
      Buffer.from(signature.value, 'base64'),
    );
  } catch {
    return false;
  }
}

/** Used by release tooling and tests; the private key never ships in an image. */
export function signManifest<T extends Record<string, unknown>>(
  manifest: T,
  privateKeyPem: string,
  keyId: string,
): T & { signature: { algorithm: 'ecdsa-p256-sha256'; keyId: string; value: string } } {
  const value = sign('sha256', unsignedBytes(manifest), { key: privateKeyPem, dsaEncoding: 'der' });
  return {
    ...manifest,
    signature: { algorithm: 'ecdsa-p256-sha256', keyId, value: value.toString('base64') },
  };
}
