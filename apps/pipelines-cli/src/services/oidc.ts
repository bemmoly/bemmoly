import { z } from 'zod';
import { CliError } from '../cli/errors.ts';

/*
 * GitHub Actions' own OIDC token (permissions: id-token: write), requested for the
 * Pipelines server as its audience. Pipelines verifies it against GitHub's issuer and maps
 * repository, ref and workflow to applications through a trust rule, so no secret is stored.
 */

const answerSchema = z.object({ value: z.string().min(20) });

export interface OidcRequest {
  requestUrl: string;
  requestToken: string;
  audience: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export async function githubOidcToken(request: OidcRequest): Promise<string> {
  const url = new URL(request.requestUrl);
  url.searchParams.set('audience', request.audience);
  const doFetch = request.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, {
      headers: { authorization: `Bearer ${request.requestToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(request.timeoutMs ?? 15_000),
    });
  } catch (cause) {
    throw new CliError(
      `Could not ask GitHub for the workflow's OIDC token: ${(cause as Error).message}`,
    );
  }
  if (!response.ok) {
    throw new CliError(
      `GitHub refused the OIDC token request (${response.status}). Give the job "permissions: id-token: write".`,
    );
  }
  const parsed = answerSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new CliError('GitHub sent an OIDC answer without a token.');
  return parsed.data.value;
}
