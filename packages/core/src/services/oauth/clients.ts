import { ValidationError } from '@bemmoly/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { oauthClients, type OAuthClientRow } from '../../models/identity/index.ts';
import { nowOf, type OAuthDependencies } from './deps.ts';
import { isAcceptableRedirect } from './redirects.ts';

/** How long a document is reused when it does not say, and the bounds on what it may say. */
const DEFAULT_CACHE_S = 60 * 60;
const MIN_CACHE_S = 5 * 60;
const MAX_CACHE_S = 24 * 60 * 60;

/** The parts of the document this server reads (draft-ietf-oauth-client-id-metadata-document). */
const documentSchema = z
  .object({
    client_id: z.string(),
    client_name: z.string().trim().min(1).max(200),
    redirect_uris: z.array(z.string().max(2048)).min(1).max(20),
    token_endpoint_auth_method: z.string().optional(),
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
  })
  .loose();

function refuse(message: string): never {
  throw new ValidationError(message, { details: { reason: 'invalid_client' } });
}

/** A client id must be an https URL with a path: the address of its metadata document. */
export function parseClientId(clientId: string): URL {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return refuse('This app did not identify itself with a web address Bemmoly can check');
  }
  const segments = url.pathname.split('/');
  if (
    url.protocol !== 'https:' ||
    url.pathname === '/' ||
    url.hash ||
    url.username ||
    url.password ||
    segments.includes('.') ||
    segments.includes('..') ||
    url.toString() !== clientId
  ) {
    return refuse('This app did not identify itself with a web address Bemmoly can check');
  }
  return url;
}

/** Control characters and runs of spaces cannot dress one app up as another on the consent screen. */
const displayName = (name: string) =>
  name
    .replace(/\p{Cc}|\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

function validate(clientId: string, body: unknown) {
  const parsed = documentSchema.safeParse(body);
  if (!parsed.success)
    refuse(`${new URL(clientId).host} published client details Bemmoly can't read`);
  const document = parsed.data;
  if (document.client_id !== clientId) {
    refuse(`${new URL(clientId).host} published client details for a different app`);
  }
  const method = document.token_endpoint_auth_method ?? 'none';
  if (method !== 'none') refuse('This app signs in with a method Bemmoly does not support');
  if (document.grant_types && !document.grant_types.includes('authorization_code')) {
    refuse('This app does not use the sign-in flow Bemmoly offers');
  }
  const redirects = document.redirect_uris.filter(isAcceptableRedirect);
  if (redirects.length === 0) refuse('This app has no return address Bemmoly can send you back to');
  const name = displayName(document.client_name);
  return { name: name || new URL(clientId).host, redirectUris: redirects };
}

/**
 * The client behind a client id, from the cache or freshly fetched. Only a signed-in person
 * can make the server fetch a document, and only through the address-checked client.
 */
export async function resolveClient(
  deps: OAuthDependencies,
  clientId: string,
): Promise<OAuthClientRow> {
  parseClientId(clientId);
  const now = nowOf(deps);
  const [cached] = await deps.db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  if (cached && cached.expiresAt > now) return cached;
  let fetched: Awaited<ReturnType<OAuthDependencies['fetchClientMetadata']>>;
  try {
    fetched = await deps.fetchClientMetadata(clientId);
  } catch {
    return refuse(
      `Couldn't read this app's details from ${new URL(clientId).host}. Try connecting again in a moment.`,
    );
  }
  const document = validate(clientId, fetched.body);
  const seconds = Math.min(
    MAX_CACHE_S,
    Math.max(MIN_CACHE_S, fetched.maxAgeSeconds ?? DEFAULT_CACHE_S),
  );
  const values = {
    clientId,
    name: document.name,
    redirectUris: document.redirectUris,
    fetchedAt: now,
    expiresAt: new Date(now.getTime() + seconds * 1000),
    updatedAt: now,
  };
  const [row] = await deps.db
    .insert(oauthClients)
    .values(values)
    .onConflictDoUpdate({ target: oauthClients.clientId, set: values })
    .returning();
  if (!row) throw new Error('OAuth client upsert returned no row');
  return row;
}

/** A client already known from a consent: the token endpoint never fetches. */
export async function knownClient(
  deps: OAuthDependencies,
  clientId: string,
): Promise<OAuthClientRow | null> {
  const [row] = await deps.db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  return row ?? null;
}
