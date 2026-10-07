import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';

export interface CosignOptions {
  binary: string;
  /** PEM public key; when absent, keyless verification against the release workflow identity. */
  publicKey?: string;
  identityRegexp: string;
  oidcIssuer: string;
  timeoutMs?: number;
}

export async function cosignAvailable(binary: string): Promise<boolean> {
  try {
    await access(binary);
    return true;
  } catch {
    return false;
  }
}

/** `cosign verify` for one image reference; rejects with cosign's own explanation. */
export function cosignVerify(reference: string, options: CosignOptions): Promise<void> {
  const args = ['verify', '--output', 'text'];
  if (options.publicKey) {
    args.push('--key', options.publicKey);
  } else {
    args.push(
      '--certificate-identity-regexp',
      options.identityRegexp,
      '--certificate-oidc-issuer',
      options.oidcIssuer,
    );
  }
  args.push(reference);
  return new Promise((resolve, reject) => {
    execFile(
      options.binary,
      args,
      { timeout: options.timeoutMs ?? 120_000 },
      (error, _stdout, stderr) => {
        if (error)
          reject(
            new Error(
              `Signature verification failed for ${reference}: ${stderr.trim().slice(-500)}`,
            ),
          );
        else resolve();
      },
    );
  });
}
