import { z } from 'zod';
import { GcpApiError, GCP_TIMEOUT_MS, type GcpTokenSource, type GcpTransport } from './http.ts';

/*
 * Security Token Service v1 and the token-info endpoint. Workload identity federation trades
 * a token Bemmoly signed (its own OIDC issuer, whose keys the pool's provider holds) for a
 * Google federated token, so nothing long-lived is stored. The exchange is unauthenticated by
 * design: the subject token is the credential.
 */

const STS_URL = 'https://sts.googleapis.com/v1/token';
const TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const CLOUD_PLATFORM = 'https://www.googleapis.com/auth/cloud-platform';

const exchangeSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().optional(),
});

export interface StsOptions {
  transport?: GcpTransport;
  timeoutMs?: number;
}

const send = (options: StsOptions) => options.transport ?? ((url, init) => fetch(url, init));

async function readJson(url: string, response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new GcpApiError(url, response.status, text.slice(0, 300), null);
  return JSON.parse(text) as unknown;
}

export function createStsClient(options: StsOptions = {}) {
  const timeoutMs = options.timeoutMs ?? GCP_TIMEOUT_MS;
  return {
    /**
     * `audience` is the pool provider's full name:
     * "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/bemmoly/providers/bemmoly".
     */
    async exchange(input: { audience: string; subjectToken: string }) {
      const response = await send(options)(STS_URL, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
          audience: input.audience,
          scope: CLOUD_PLATFORM,
          requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
          subjectToken: input.subjectToken,
          subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const answer = exchangeSchema.parse(await readJson(STS_URL, response));
      return { token: answer.access_token, expiresInSeconds: answer.expires_in };
    },

    /** Who a token belongs to: the service account's email, or null for a pool principal. */
    async whoAmI(tokens: GcpTokenSource): Promise<string | null> {
      const response = await send(options)(TOKEN_INFO_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ access_token: await tokens.token() }).toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const answer = z
        .object({ email: z.string().optional() })
        .parse(await readJson(TOKEN_INFO_URL, response));
      return answer.email ?? null;
    },
  };
}

export type StsClient = ReturnType<typeof createStsClient>;
