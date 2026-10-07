import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { describe, expect, it } from 'vitest';
import { createDecryptStream, createEncryptStream } from './encryption.ts';

const PASS = 'correct horse battery staple';

async function encrypt(plain: Buffer, chunk = 1024): Promise<Buffer> {
  return buffer(Readable.from([plain]).pipe(createEncryptStream(PASS, chunk)));
}

async function decrypt(sealed: Buffer, passphrase = PASS): Promise<Buffer> {
  return buffer(Readable.from([sealed]).pipe(createDecryptStream(passphrase)));
}

describe('backup encryption (AES-256-GCM, chunked)', () => {
  it('round-trips empty, small and multi-chunk inputs', async () => {
    for (const size of [0, 5, 1024, 4096 + 17]) {
      const plain = randomBytes(size);
      const sealed = await encrypt(plain);
      expect(sealed.subarray(0, 4).toString()).toBe('BMBK');
      expect(await decrypt(sealed)).toEqual(plain);
    }
  });

  it('uses a fresh salt and nonce every time', async () => {
    const plain = Buffer.from('same bytes');
    expect((await encrypt(plain)).equals(await encrypt(plain))).toBe(false);
  });

  it('rejects a wrong passphrase, a flipped bit, truncation and trailing data', async () => {
    const sealed = await encrypt(randomBytes(3000));
    await expect(decrypt(sealed, 'wrong passphrase')).rejects.toThrow(/passphrase/);

    const flipped = Buffer.from(sealed);
    flipped[100] = (flipped[100] ?? 0) ^ 1;
    await expect(decrypt(flipped)).rejects.toThrow(/modified/);

    await expect(decrypt(sealed.subarray(0, sealed.length - 1))).rejects.toThrow(/truncated/);
    // Dropping the whole final chunk must not pass as a shorter, valid file.
    const firstChunkEnd = 33 + 4 + 1024 + 16;
    await expect(decrypt(sealed.subarray(0, firstChunkEnd))).rejects.toThrow(/truncated/);
    await expect(decrypt(Buffer.concat([sealed, Buffer.alloc(4)]))).rejects.toThrow(
      /after the final chunk/,
    );
  });

  it('refuses something that is not an encrypted backup', async () => {
    await expect(
      decrypt(Buffer.from('PGDMP plain dump, not encrypted at all......')),
    ).rejects.toThrow(/Not an encrypted/);
  });
});
