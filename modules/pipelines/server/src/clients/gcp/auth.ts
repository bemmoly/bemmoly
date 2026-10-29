import {
  Compute,
  ExternalAccountClient,
  GoogleAuth,
  JWT,
  type ExternalAccountClientOptions,
} from 'google-auth-library';
import { z } from 'zod';
import { createGcpHttp, type GcpTokenSource, type GcpTransport } from './http.ts';
import { createIamCredentialsClient, impersonatedTokens } from './iam-credentials.ts';
import { createStsClient } from './sts.ts';

/*
 * Keyless credentials only (architecture §15). On Google Cloud the attached service account
 * answers through the metadata server; anywhere else workload identity federation trades a
 * token Bemmoly issued for a Google one. On a laptop install, the person's own gcloud sign-in
 * (application default credentials) works too. A service account key file is refused
 * outright: keys leak, and nothing here needs one.
 */

const CLOUD_PLATFORM = 'https://www.googleapis.com/auth/cloud-platform';
const RENEW_BEFORE_MS = 60_000;

/** The credential part of a connection's config; nothing in it is a secret. */
export const gcpCredentialsSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('metadata') }),
    /** `gcloud auth application-default login` on the machine Bemmoly runs on. */
    z.object({ kind: z.literal('application_default') }),
    /** An external_account file from `gcloud iam workload-identity-pools create-cred-config`. */
    z.object({
      kind: z.literal('external_account'),
      config: z.record(z.string(), z.unknown()),
    }),
    /** Federation with a token Bemmoly signs itself, exchanged here without the library. */
    z.object({
      kind: z.literal('federated'),
      audience: z.string().min(1),
      serviceAccount: z.string().min(1).nullable().default(null),
    }),
  ])
  .default({ kind: 'metadata' });

export type GcpCredentials = z.infer<typeof gcpCredentialsSchema>;

export class KeyFileRefusedError extends Error {
  override readonly name = 'KeyFileRefusedError';
}

/** Library clients both expose getAccessToken; a token source only needs that. */
function fromLibrary(client: { getAccessToken(): Promise<{ token?: string | null }> }) {
  return {
    async token() {
      const { token } = await client.getAccessToken();
      if (!token) throw new Error('Google Cloud gave no access token');
      return token;
    },
  } satisfies GcpTokenSource;
}

export interface CredentialOptions {
  /** Bemmoly's own signed token for federation; required for the "federated" kind. */
  subjectToken?: () => Promise<string>;
  transport?: GcpTransport;
  timeoutMs?: number;
  now?: () => number;
}

function federatedTokens(
  credentials: Extract<GcpCredentials, { kind: 'federated' }>,
  options: CredentialOptions,
): GcpTokenSource {
  const subjectToken = options.subjectToken;
  if (!subjectToken) throw new Error('Federation needs a token signed by Bemmoly');
  const sts = createStsClient(options);
  const now = options.now ?? Date.now;
  let cached: { token: string; expiresAt: number } | null = null;
  const federated: GcpTokenSource = {
    async token() {
      if (!cached || cached.expiresAt - RENEW_BEFORE_MS <= now()) {
        const exchanged = await sts.exchange({
          audience: credentials.audience,
          subjectToken: await subjectToken(),
        });
        cached = { token: exchanged.token, expiresAt: now() + exchanged.expiresInSeconds * 1000 };
      }
      return cached.token;
    },
  };
  if (!credentials.serviceAccount) return federated;
  // A pool principal granted Token Creator on the control account acts as that account.
  const http = createGcpHttp({ tokens: federated, ...options });
  return impersonatedTokens(createIamCredentialsClient(http), credentials.serviceAccount, now);
}

/**
 * The machine's application default credentials, refusing a service account key even when
 * GOOGLE_APPLICATION_CREDENTIALS points at one. The client is found once, on first use.
 */
function applicationDefaultTokens(): GcpTokenSource {
  let client: ReturnType<GoogleAuth['getClient']> | null = null;
  const found = () => {
    client ??= new GoogleAuth({ scopes: [CLOUD_PLATFORM] }).getClient().then((resolved) => {
      if (resolved instanceof JWT) {
        throw new KeyFileRefusedError(
          'Application default credentials point at a service account key; run gcloud auth application-default login instead',
        );
      }
      return resolved;
    });
    client.catch(() => {
      client = null;
    });
    return client;
  };
  return {
    async token() {
      const { token } = await (await found()).getAccessToken();
      if (!token) throw new Error('Google Cloud gave no access token');
      return token;
    },
    async quotaProject() {
      return (await found()).quotaProjectId ?? null;
    },
  };
}

export function createTokenSource(
  credentials: GcpCredentials,
  options: CredentialOptions = {},
): GcpTokenSource {
  switch (credentials.kind) {
    case 'metadata':
      return fromLibrary(new Compute({ scopes: [CLOUD_PLATFORM] }));
    case 'application_default':
      return applicationDefaultTokens();
    case 'external_account': {
      if (credentials.config['type'] !== 'external_account') {
        throw new KeyFileRefusedError(
          'Only workload identity federation files are accepted; remove the key and use a pool',
        );
      }
      const client = ExternalAccountClient.fromJSON({
        ...credentials.config,
        scopes: [CLOUD_PLATFORM],
      } as unknown as ExternalAccountClientOptions);
      if (!client) throw new KeyFileRefusedError('This credential file is not an external account');
      return fromLibrary(client);
    }
    case 'federated':
      return federatedTokens(credentials, options);
  }
}
