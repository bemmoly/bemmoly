import { z } from 'zod';
import type { GcpHttp, GcpTokenSource } from './http.ts';

/*
 * IAM Credentials v1: short-lived tokens for another service account. Pipelines acts as
 * each environment's deployer this way, so that project's audit log names the deployer and
 * the control identity never holds deploy roles itself.
 */

const BASE = 'https://iamcredentials.googleapis.com/v1';
const CLOUD_PLATFORM = 'https://www.googleapis.com/auth/cloud-platform';

/** Tokens are asked for 15 minutes and renewed a minute before they run out. */
const LIFETIME_SECONDS = 900;
const RENEW_BEFORE_MS = 60_000;

const tokenSchema = z.object({ accessToken: z.string().min(1), expireTime: z.string() });

export function createIamCredentialsClient(http: GcpHttp) {
  return {
    async generateAccessToken(email: string): Promise<{ token: string; expiresAt: Date }> {
      const answer = await http.send({
        method: 'POST',
        url: `${BASE}/projects/-/serviceAccounts/${email}:generateAccessToken`,
        body: { scope: [CLOUD_PLATFORM], lifetime: `${LIFETIME_SECONDS}s` },
        schema: tokenSchema,
      });
      return { token: answer.accessToken, expiresAt: new Date(answer.expireTime) };
    },
  };
}

export type IamCredentialsClient = ReturnType<typeof createIamCredentialsClient>;

/** A token source acting as `email`, cached until shortly before each token expires. */
export function impersonatedTokens(
  credentials: IamCredentialsClient,
  email: string,
  now: () => number = Date.now,
): GcpTokenSource {
  let cached: { token: string; expiresAt: Date } | null = null;
  return {
    async token() {
      if (!cached || cached.expiresAt.getTime() - RENEW_BEFORE_MS <= now()) {
        cached = await credentials.generateAccessToken(email);
      }
      return cached.token;
    },
  };
}
