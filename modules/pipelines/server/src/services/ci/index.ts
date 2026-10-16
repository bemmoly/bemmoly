import type { RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { ExternalCheck, ListExternalChecksQuery } from '../../../../shared/ci.ts';
import type { Release } from '../../../../shared/releases.ts';
import { createKeySource, type KeySource } from '../../clients/oidc/discovery.ts';
import { requireAccess, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import type { InboxHandlers } from '../inbox/handlers.ts';
import { createCiAdmin } from './admin.ts';
import { externalChecksFor, registerExternalChecks } from './checks.ts';
import { authenticateCi, isCiCredential, type CiPrincipal } from './principal.ts';
import { registerRelease, type RegisterInput } from './register.ts';
import { createReleaseWriter, type ReleaseWriter } from '../releases/write.ts';

/*
 * Bring your CI (architecture §7.1): release registration from any CI, the issuers and
 * trust rules that let CI sign in with its own OIDC token, scoped CI tokens, and other CI
 * systems' results per commit. Pipelines' own builds use the same release writer.
 */

export interface CiDeps extends PipelinesServiceDeps {
  /** The one release writer, shared with builds on the runners. */
  releaseWriter?: ReleaseWriter;
  /** Tests hand fixed keys; production fetches each issuer's JWKS. */
  keys?: KeySource;
  /**
   * The audiences a token must name when its issuer sets none: this server's configured
   * address. Never the request's Host, which the caller chooses and which would let a token
   * minted for any other service pass by naming that service as the host.
   */
  audiences?: readonly string[];
}

/** "https://bemmoly.acme.dev" and with a trailing slash, as CI systems write it either way. */
export function ciAudiences(publicUrl: string): string[] {
  const origin = new URL(publicUrl).origin;
  return [origin, `${origin}/`];
}

export { externalChecksFor, verdictOf } from './checks.ts';

export function createCiService(deps: CiDeps) {
  const sql = () => requireDatabase(deps);
  const keys = deps.keys ?? createKeySource();
  const writer = deps.releaseWriter ?? createReleaseWriter();
  return {
    admin: createCiAdmin(sql, requireAccess(deps)),

    /** Reads a Bearer that belongs to CI (an OIDC token or a CI token); null otherwise. */
    async principal(bearer: string | null): Promise<CiPrincipal | null> {
      if (!bearer || !isCiCredential(bearer)) return null;
      return authenticateCi(sql(), keys, bearer, deps.audiences ?? []);
    },

    register(input: RegisterInput): Promise<{ release: Release; created: boolean }> {
      return registerRelease({ sql: sql(), access: requireAccess(deps), writer }, input);
    },

    async checks(ctx: RequestContext, query: ListExternalChecksQuery): Promise<ExternalCheck[]> {
      await requireAccess(deps).authorizeAction(ctx, 'view', {});
      const [app] = await sql()<{ repository: string | null }[]>`
        select r.full_name as repository from pipeline_applications a
          left join pipeline_repositories r on r.id = a.repository_id
        where a.key = ${query.application}`;
      if (!app) throw new NotFoundError(`No application called "${query.application}"`);
      return app.repository ? externalChecksFor(sql(), app.repository, query.commit) : [];
    },

    /** Keeps GitHub check runs and workflow runs as they arrive. */
    listen(handlers: InboxHandlers, ownApp: string | null = null) {
      registerExternalChecks(handlers, sql, ownApp);
    },
  };
}

export type CiService = ReturnType<typeof createCiService>;
