import { hash, verify, type Algorithm, type Options } from '@node-rs/argon2';

/** The library declares Algorithm as an ambient const enum; 2 is Argon2id. */
const ARGON2ID = 2 as Algorithm;

/** OWASP's argon2id baseline: 19 MiB, two passes, one lane. */
export const ARGON2_OPTIONS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Compares in constant time inside argon2. A malformed stored hash counts as a
 * mismatch rather than an error, so it cannot be told apart from a wrong password.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same work as a real check when the account does not exist, so the
 * response time does not reveal which emails have accounts.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('bemmoly-timing-equaliser');
  await verifyPassword(await dummyHash, password);
}
