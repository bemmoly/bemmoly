import { z } from 'zod';
import { CliError } from '../cli/errors.ts';
import type { Http } from '../clients/http.ts';

/*
 * Device sign-in (RFC 8628) through the kernel's OAuth server: bp asks for a code, the
 * person approves it in the browser where they are already signed in, and bp polls the token
 * endpoint until it is approved, refused or expired. The endpoints come from the server's
 * metadata, so bp never guesses a path.
 */

export const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
export const CLI_CLIENT_ID = 'bemmoly-pipelines-cli';
const METADATA_PATH = '/.well-known/oauth-authorization-server';

const metadataSchema = z.object({
  token_endpoint: z.url(),
  device_authorization_endpoint: z.url().optional(),
});

export const deviceAuthorizationSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.url(),
  verification_uri_complete: z.url().optional(),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive().default(5),
});

const tokenSchema = z.object({
  access_token: z.string().min(8),
  token_type: z.string(),
  expires_in: z.number().int().positive().optional(),
});

export type DeviceAuthorization = z.infer<typeof deviceAuthorizationSchema>;

export interface DeviceToken {
  token: string;
  expiresAt: string | null;
}

export interface DeviceFlowOptions {
  http: Http;
  /** Shown to the person: where to go and what to type. */
  prompt(authorization: DeviceAuthorization): void;
  sleep(ms: number): Promise<void>;
  now(): number;
  /** "bp on build-box": how the token is named in Settings › API tokens. */
  deviceName: string;
}

const pathOf = (http: Http, url: string) => {
  const target = new URL(url);
  if (target.origin !== new URL(http.baseUrl).origin) {
    throw new CliError(`The server sent a sign-in address on another origin (${target.origin}).`);
  }
  return `${target.pathname}${target.search}`;
};

export async function deviceSignIn(options: DeviceFlowOptions): Promise<DeviceToken> {
  const { http } = options;
  const metadata = await http.request(METADATA_PATH, metadataSchema);
  if (!metadata.device_authorization_endpoint) {
    throw new CliError(
      'This server does not offer device sign-in. Create an API token in Settings › API tokens and run "bp login --token <token>".',
    );
  }
  const authorization = await http.request(
    pathOf(http, metadata.device_authorization_endpoint),
    deviceAuthorizationSchema,
    {
      method: 'POST',
      form: { client_id: CLI_CLIENT_ID, scope: 'read write', device_name: options.deviceName },
    },
  );
  options.prompt(authorization);
  const tokenPath = pathOf(http, metadata.token_endpoint);
  const deadline = options.now() + authorization.expires_in * 1000;
  let interval = authorization.interval * 1000;
  while (options.now() < deadline) {
    await options.sleep(interval);
    try {
      const answer = await http.request(tokenPath, tokenSchema, {
        method: 'POST',
        form: {
          grant_type: DEVICE_GRANT,
          device_code: authorization.device_code,
          client_id: CLI_CLIENT_ID,
        },
      });
      return {
        token: answer.access_token,
        expiresAt: answer.expires_in
          ? new Date(options.now() + answer.expires_in * 1000).toISOString()
          : null,
      };
    } catch (error) {
      const code = error instanceof CliError ? oauthErrorOf(error) : null;
      if (code === 'authorization_pending') continue;
      if (code === 'slow_down') {
        interval += 5000;
        continue;
      }
      if (code === 'access_denied') throw new CliError('The sign-in was refused in the browser.');
      if (code === 'expired_token') break;
      throw error;
    }
  }
  throw new CliError('The code expired before it was approved. Run "bp login" again.');
}

/** OAuth errors come back as `{ error, error_description }`; the http client keeps the body. */
function oauthErrorOf(error: CliError): string | null {
  const body = error.options.oauth;
  return typeof body === 'string' ? body : null;
}
