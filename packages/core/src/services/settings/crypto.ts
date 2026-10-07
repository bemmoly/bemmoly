import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

/** Encrypts setting secrets with the install's BEMMOLY_SECRET_KEY. */
export interface SecretBox {
  /** `context` (the setting key) is bound as associated data, so rows cannot be swapped. */
  seal(plaintext: string, context: string): string;
  open(sealed: string, context: string): string;
}

export class SecretDecryptionError extends Error {
  override readonly name = 'SecretDecryptionError';
}

export function createSecretBox(keyBase64: string): SecretBox {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new TypeError('BEMMOLY_SECRET_KEY must decode to 32 bytes');
  return {
    seal(plaintext, context) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
      cipher.setAAD(Buffer.from(context, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, iv, tag, ciphertext]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
        .join('.');
    },
    open(sealed, context) {
      const [version, iv, tag, ciphertext] = sealed.split('.');
      if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
        throw new SecretDecryptionError('Unrecognised secret format');
      }
      try {
        const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'), {
          authTagLength: TAG_BYTES,
        });
        decipher.setAAD(Buffer.from(context, 'utf8'));
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        return Buffer.concat([
          decipher.update(Buffer.from(ciphertext, 'base64')),
          decipher.final(),
        ]).toString('utf8');
      } catch (error) {
        throw new SecretDecryptionError(
          'A stored secret cannot be decrypted: BEMMOLY_SECRET_KEY differs from the one that wrote it',
          { cause: error },
        );
      }
    },
  };
}
