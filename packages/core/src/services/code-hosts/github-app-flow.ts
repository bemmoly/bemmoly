import { randomBytes } from 'node:crypto';
import {
  ValidationError,
  type CodeHost,
  type CompleteGithubApp,
  type GithubAppCreated,
  type GithubAppStart,
  type InstallGithubApp,
  type StartGithubApp,
} from '@bemmoly/shared';
import { z } from 'zod';
import type { Actor } from '../../contracts/authz.ts';
import { appLink } from '../identity/index.ts';
import { CODE_HOST_BACKFILL_JOB } from './backfill.ts';
import {
  githubAppApi,
  githubCanReach,
  githubInstallUrl,
  githubManifest,
  githubManifestUrl,
} from './hosts/github-app.ts';
import { renderGithubAppPage, type GithubAppPage } from './github-app-page.ts';
import { addressPolicyFor } from './runtime.ts';
import type { CodeHostServiceDeps } from './service.ts';
import {
  connectionOf,
  integrationById,
  newIntegrationId,
  sealHostSecrets,
  WEBHOOK_PATH,
  type IntegrationRow,
} from './store.ts';
import { insertIntegration } from './write.ts';

/*
 * Connecting GitHub in one click. `start` describes the app and seals what the return trip
 * needs into the state GitHub carries back; `complete` trades GitHub's one-time code for
 * the app's credentials and stores the integration; `install` records where the admin
 * installed it and which repositories it reads, then starts the backfill.
 */

/** The settings page GitHub sends the admin back to; the web app finishes from there. */
const SETTINGS_PATH = '/settings/code-hosts';
const FORM_PATH = '/api/v1/admin/code-hosts/github-app-manifests';
/** GitHub's code is good for an hour; the state lives no longer. */
const STATE_TTL_MS = 60 * 60 * 1000;
const STATE_CONTEXT = 'code-hosts.github-app-state';

const stateSchema = z.object({
  integrationId: z.uuid(),
  userId: z.string(),
  baseUrl: z.string().nullable(),
  organization: z.string().nullable(),
  name: z.string(),
  expiresAt: z.number(),
});
type FlowState = z.infer<typeof stateSchema>;

const expired = () =>
  new ValidationError('More than an hour passed on GitHub; connect GitHub again');
const notStartedHere = () =>
  new ValidationError('This GitHub App was not started from here; connect GitHub again');

interface FlowHelpers {
  presentOne(id: string): Promise<CodeHost>;
  audit(
    actor: Actor,
    action: string,
    row: Pick<IntegrationRow, 'id'>,
    after?: unknown,
  ): Promise<void>;
}

/** The person the flow belongs to: the round trip runs in their browser, under their session. */
function personOf(actor: Actor): string {
  const id = actor.userId ?? (actor.kind === 'user' ? actor.id : null);
  if (!id) throw new ValidationError('Connect GitHub from a browser, signed in');
  return id;
}

export function createGithubAppFlow(deps: CodeHostServiceDeps, helpers: FlowHelpers) {
  const { sql, secrets: box } = deps;
  const sealState = (state: FlowState) =>
    Buffer.from(box.seal(JSON.stringify(state), STATE_CONTEXT)).toString('base64url');
  function openState(sealed: string): FlowState {
    try {
      const plain = box.open(Buffer.from(sealed, 'base64url').toString('utf8'), STATE_CONTEXT);
      return stateSchema.parse(JSON.parse(plain));
    } catch {
      throw notStartedHere();
    }
  }
  const apiFor = (baseUrl: string | null) =>
    githubAppApi(baseUrl, {
      policy: addressPolicyFor(deps, { base_url: baseUrl }),
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
    });

  return {
    async start(actor: Actor, input: StartGithubApp): Promise<GithubAppStart> {
      const state = sealState({
        integrationId: await newIntegrationId(sql),
        userId: personOf(actor),
        baseUrl: input.baseUrl,
        organization: input.organization,
        name: input.name,
        expiresAt: Date.now() + STATE_TTL_MS,
      });
      return {
        formUrl: appLink(deps.publicUrl, `${FORM_PATH}?state=${state}`),
        webhooks: githubCanReach(deps.publicUrl, input.baseUrl),
      };
    },

    /** The handoff page that posts the manifest on to GitHub, rebuilt from the state alone. */
    async form(actor: Actor, sealed: string): Promise<GithubAppPage> {
      const state = openState(sealed);
      if (state.userId !== personOf(actor)) throw notStartedHere();
      if (state.expiresAt < Date.now()) throw expired();
      const { integrationId: id, baseUrl } = state;
      const webhooks = githubCanReach(deps.publicUrl, baseUrl);
      const manifest = githubManifest({
        publicUrl: deps.publicUrl,
        webhookUrl: webhooks ? appLink(deps.publicUrl, WEBHOOK_PATH(id)) : null,
        redirectUrl: appLink(deps.publicUrl, SETTINGS_PATH),
        setupUrl: appLink(deps.publicUrl, `${SETTINGS_PATH}?installed=${id}`),
      });
      return renderGithubAppPage(githubManifestUrl(baseUrl, state.organization, sealed), manifest);
    },

    async complete(actor: Actor, input: CompleteGithubApp): Promise<GithubAppCreated> {
      const state = openState(input.state);
      if (state.userId !== personOf(actor)) throw notStartedHere();
      const id = state.integrationId;
      const [existing] = await sql<IntegrationRow[]>`select * from integrations where id = ${id}`;
      // A reload of the return page: GitHub's code is spent, the app is already stored.
      if (existing?.app_slug) {
        return {
          host: await helpers.presentOne(id),
          installUrl: githubInstallUrl(existing.base_url, existing.app_slug),
        };
      }
      if (state.expiresAt < Date.now()) {
        throw expired();
      }
      const app = await apiFor(state.baseUrl).convert(input.code);
      // Without a reachable webhook GitHub makes no secret; one is kept so the test still runs.
      const webhookSecret = app.webhookSecret ?? randomBytes(24).toString('hex');
      await insertIntegration(
        sql,
        id,
        'github',
        {
          name: state.name,
          baseUrl: state.baseUrl,
          authMode: 'app',
          appId: app.appId,
          installationId: null,
          appSlug: app.slug,
          repositories: [],
          enabled: true,
          sealed: sealHostSecrets(box, id, { webhookSecret, privateKey: app.privateKey }),
        },
        state.userId,
      );
      await helpers.audit(
        actor,
        'integration.created',
        { id },
        {
          kind: 'github',
          name: state.name,
          appId: app.appId,
        },
      );
      return {
        host: await helpers.presentOne(id),
        installUrl: githubInstallUrl(state.baseUrl, app.slug),
      };
    },

    async install(actor: Actor, id: string, input: InstallGithubApp): Promise<CodeHost> {
      const row = await integrationById(sql, id);
      const { secrets } = connectionOf(box, row);
      if (row.kind !== 'github' || row.auth_mode !== 'app' || !row.app_id || !secrets.privateKey) {
        throw new ValidationError('Only a GitHub App with its private key can be installed');
      }
      const repositories = await apiFor(row.base_url).installedRepositories(
        row.app_id,
        secrets.privateKey,
        input.installationId,
      );
      await sql`update integrations set installation_id = ${input.installationId},
          repositories = ${repositories}::text[], last_error = null, last_error_at = null,
          updated_at = now()
        where id = ${id}`;
      await helpers.audit(actor, 'integration.installed', row, {
        installationId: input.installationId,
        repositories,
      });
      if (row.enabled && repositories.length > 0) {
        await deps.jobs.enqueue(
          CODE_HOST_BACKFILL_JOB,
          { integrationId: id },
          { key: `${CODE_HOST_BACKFILL_JOB}:${id}`, singleton: true },
        );
      }
      return helpers.presentOne(id);
    },
  };
}
