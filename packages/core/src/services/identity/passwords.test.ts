import { describe, expect, it } from 'vitest';
import { burnPasswordCheck, hashPassword, verifyPassword } from './passwords.ts';
import { digestsEqual, generateSecret, hashSecret } from './secrets.ts';

describe('passwords', () => {
  it('hashes with argon2id at the OWASP baseline and verifies', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse batterY')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('treats a malformed stored hash as a mismatch', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });

  it('spends work for unknown accounts without throwing', async () => {
    await expect(burnPasswordCheck('whatever')).resolves.toBeUndefined();
  });
});

describe('secrets', () => {
  it('generates 256-bit URL-safe tokens with an optional prefix', () => {
    const token = generateSecret('bmy_');
    expect(token).toMatch(/^bmy_[A-Za-z0-9_-]{43}$/);
    expect(generateSecret()).not.toBe(generateSecret());
  });

  it('stores only a sha256 digest and compares digests in constant time', () => {
    const digest = hashSecret('abc');
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(digestsEqual(digest, hashSecret('abc'))).toBe(true);
    expect(digestsEqual(digest, hashSecret('abd'))).toBe(false);
    expect(digestsEqual(digest, 'ab')).toBe(false);
  });
});
