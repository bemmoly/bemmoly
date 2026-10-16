import { isIP } from 'node:net';
import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import { HttpStatusError } from '../../../clients/http-json.ts';
import { createCodeHostRest } from '../../../clients/code-host-rest.ts';
import { isPrivateAddress } from '../../../clients/network.ts';
import { withoutTrailingSlashes, type HostApiOptions } from '../types.ts';
import { githubApiUrl, githubAppJwt } from './github.ts';

/*
 * A GitHub App made from a manifest: GitHub shows the admin the app Bemmoly describes, creates
 * it under their account or organization, and hands back a one-time code that converts into
 * the app's id, private key and webhook secret. Installing it then names the repositories.
 * The shapes GitHub sends stay in this file.
 */

const API_VERSION = '2022-11-28';
/** GitHub refuses an app name longer than this. */
const APP_NAME_MAX = 34;

/** The read access the webhook events and backfill need, and nothing more. */
const PERMISSIONS = { pull_requests: 'read', contents: 'read', checks: 'read', metadata: 'read' };
/** The events the GitHub driver parses; each is covered by a permission above. */
const EVENTS: string[] = [
  'pull_request',
  'pull_request_review',
  'push',
  'create',
  'delete',
  'check_suite',
];

const webUrl = (baseUrl: string | null) =>
  baseUrl ? withoutTrailingSlashes(baseUrl) : 'https://github.com';

/** Where the browser posts the manifest: the admin's own apps, or the organization's. */
export function githubManifestUrl(
  baseUrl: string | null,
  organization: string | null,
  state: string,
): string {
  const owner = organization ? `organizations/${encodeURIComponent(organization)}/` : '';
  return `${webUrl(baseUrl)}/${owner}settings/apps/new?state=${encodeURIComponent(state)}`;
}

/** The app's install page, where the admin picks its repositories; Enterprise Server's path differs. */
export function githubInstallUrl(baseUrl: string | null, slug: string): string {
  const apps = baseUrl ? 'github-apps' : 'apps';
  return `${webUrl(baseUrl)}/${apps}/${encodeURIComponent(slug)}/installations/new`;
}

/**
 * Whether the host can deliver to this install. github.com reaches only public addresses;
 * Enterprise Server usually shares the company network, so only loopback is out of reach.
 */
export function githubCanReach(publicUrl: string, baseUrl: string | null): boolean {
  const host = new URL(publicUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const loopback =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host.startsWith('127.');
  if (loopback) return false;
  if (baseUrl) return true;
  if (isIP(host) !== 0) return !isPrivateAddress(host);
  return host.includes('.') && !/\.(local|internal|lan|home\.arpa|test)$/.test(host);
}

export interface ManifestInput {
  publicUrl: string;
  webhookUrl: string | null;
  redirectUrl: string;
  setupUrl: string;
  /** What enabled modules add: write wins over read, events are added once each. */
  extra?: ReadonlyArray<{
    permissions: Readonly<Record<string, 'read' | 'write'>>;
    events: readonly string[];
  }>;
}

function mergedAccess(extra: NonNullable<ManifestInput['extra']>) {
  const permissions: Record<string, string> = { ...PERMISSIONS };
  const events = new Set(EVENTS);
  for (const request of extra) {
    for (const [name, level] of Object.entries(request.permissions)) {
      if (permissions[name] !== 'write') permissions[name] = level;
    }
    for (const event of request.events) events.add(event);
  }
  return { permissions, events: [...events] };
}

/**
 * The app Bemmoly asks GitHub to create: private, read-only unless an enabled module asks
 * for more (reporting checks and deployments, opening pull requests), its
 * webhook when reachable.
 */
export function githubManifest(input: ManifestInput): string {
  const host = new URL(input.publicUrl).host;
  const access = mergedAccess(input.extra ?? []);
  return JSON.stringify({
    name: `Bemmoly ${host}`.slice(0, APP_NAME_MAX).trim(),
    url: input.publicUrl,
    description: 'Links pull requests, branches and commits to the Bemmoly issues they name.',
    ...(input.webhookUrl ? { hook_attributes: { url: input.webhookUrl, active: true } } : {}),
    redirect_url: input.redirectUrl,
    setup_url: input.setupUrl,
    setup_on_update: true,
    public: false,
    default_permissions: access.permissions,
    default_events: input.webhookUrl ? access.events : [],
  });
}

const conversionSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  pem: z.string(),
  webhook_secret: z.string().nullable().optional(),
});
const installationSchema = z.object({ id: z.number().int(), app_id: z.number().int() });
const tokenSchema = z.object({ token: z.string() });
const repositoriesSchema = z.object({
  repositories: z.array(z.object({ full_name: z.string() })),
});

export interface CreatedApp {
  appId: string;
  slug: string;
  privateKey: string;
  webhookSecret: string | null;
}

/** The repositories one call reads; more than this is beyond what backfill takes anyway. */
const REPOSITORY_LIMIT = 100;

export function githubAppApi(baseUrl: string | null, options: HostApiOptions) {
  const rest = (authorization?: string) =>
    createCodeHostRest({
      ...options,
      baseUrl: githubApiUrl(baseUrl),
      headers: {
        ...(authorization ? { authorization } : {}),
        'x-github-api-version': API_VERSION,
        'user-agent': 'Bemmoly',
      },
    });
  const appJwt = (appId: string, privateKey: string) =>
    `Bearer ${githubAppJwt(appId, privateKey, Math.floor(Date.now() / 1000))}`;

  return {
    /** Trades the one-time code for the app's credentials; the code works once, for an hour. */
    async convert(code: string): Promise<CreatedApp> {
      try {
        const app = conversionSchema.parse(
          await rest().postJson(`app-manifests/${encodeURIComponent(code)}/conversions`, {}),
        );
        return {
          appId: String(app.id),
          slug: app.slug,
          privateKey: app.pem,
          webhookSecret: app.webhook_secret ?? null,
        };
      } catch (error) {
        if (error instanceof HttpStatusError && error.status === 404) {
          throw new ValidationError('GitHub no longer accepts this code; create the app again');
        }
        throw error;
      }
    },

    /**
     * The installation's repositories, after checking with the app's own key that the
     * installation is of this app: the id arrives in the address, so it is never trusted.
     */
    async installedRepositories(
      appId: string,
      privateKey: string,
      installationId: string,
    ): Promise<string[]> {
      const asApp = rest(appJwt(appId, privateKey));
      let installation;
      try {
        installation = installationSchema.parse(
          await asApp.getJson(`app/installations/${encodeURIComponent(installationId)}`),
        );
      } catch (error) {
        if (error instanceof HttpStatusError && error.status === 404) {
          throw new ValidationError('That installation is not of this GitHub App');
        }
        throw error;
      }
      if (String(installation.app_id) !== appId) {
        throw new ValidationError('That installation is not of this GitHub App');
      }
      const { token } = tokenSchema.parse(
        await asApp.postJson(`app/installations/${installation.id}/access_tokens`, {}),
      );
      const answer = repositoriesSchema.parse(
        await rest(`Bearer ${token}`).getJson('installation/repositories', {
          per_page: REPOSITORY_LIMIT,
        }),
      );
      return answer.repositories.map((repository) => repository.full_name);
    },
  };
}
