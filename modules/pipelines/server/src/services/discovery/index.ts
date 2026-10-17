import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type {
  AcceptProposalsBody,
  AcceptProposalsResult,
  DismissProposalsBody,
  ListProposalsQuery,
  ProposalsPage,
  RepositoryInput,
} from '../../../../shared/catalog-writes.ts';
import type { ProposalRow } from '../../models/catalog-writes.ts';
import type { CatalogWritesService } from '../catalog-writes/index.ts';
import type { RepositoryTree } from '../code/repository-reader.ts';
import { requireAccess, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { acceptProposals } from './accept.ts';
import { PROPOSAL_FROM, PROPOSAL_SELECT, toProposal } from './present.ts';
import { scanRepository, type ScanResult } from './scan.ts';

/*
 * Discovery (architecture §9): a scan per repository proposes applications, a Platform
 * admin accepts them in bulk or dismisses them. Scans run from the job below (on install,
 * repository events and nightly, which the code host wiring enqueues) or on request.
 */

export const DISCOVERY_JOB = 'pipelines.discover-repository';

export type { ScanResult } from './scan.ts';
export { detectApplications, type DetectedApplication } from './detect.ts';

type RepositoryRef = Pick<RepositoryInput, 'fullName'> & Partial<RepositoryInput>;

export function createDiscoveryService(deps: PipelinesServiceDeps, writes: CatalogWritesService) {
  const sql = () => requireDatabase(deps);
  const access = requireAccess(deps);

  /** Scans one repository; `tree` given by tests and callers that already hold it. */
  async function discover(repository: RepositoryRef, tree?: RepositoryTree): Promise<ScanResult> {
    const read =
      tree ??
      (await writes.ports.repositories.tree(
        repository.fullName,
        repository.defaultBranch ?? 'main',
      ));
    if (!read) {
      throw new ProviderError(
        `Pipelines cannot read ${repository.fullName} yet. Connect the code host in Settings, then scan again.`,
      );
    }
    return scanRepository(sql(), repository, read);
  }

  return {
    discover,

    async scan(ctx: RequestContext, repository: RepositoryRef): Promise<ScanResult> {
      await access.authorizeAction(ctx, 'platform', {});
      return discover(repository);
    },

    async list(ctx: RequestContext, query: ListProposalsQuery): Promise<ProposalsPage> {
      await access.authorizeAction(ctx, 'view', {});
      const db = sql();
      const after = decodeCursor(query.cursor);
      const where = db`p.state = ${query.state}
        ${query.repository ? db`and lower(r.full_name) = ${query.repository.toLowerCase()}` : db``}`;
      const [rows, [count]] = await Promise.all([
        db<ProposalRow[]>`
          select ${db.unsafe(PROPOSAL_SELECT)} from ${db.unsafe(PROPOSAL_FROM)}
          where ${where}
            ${after ? db`and (lower(r.full_name), p.path, p.id) > (select lower(r2.full_name), p2.path, p2.id from pipeline_discovery_proposals p2 join pipeline_repositories r2 on r2.id = p2.repository_id where p2.id = ${after}::uuid)` : db``}
          order by lower(r.full_name), p.path, p.id
          limit ${query.limit + 1}`,
        db<{ total: number }[]>`
          select count(*)::int as total from ${db.unsafe(PROPOSAL_FROM)} where ${where}`,
      ]);
      const page = toPage(rows, query.limit);
      return {
        items: page.rows.map(toProposal),
        nextCursor: page.nextCursor,
        total: count?.total ?? 0,
      };
    },

    async accept(ctx: RequestContext, body: AcceptProposalsBody): Promise<AcceptProposalsResult> {
      await access.authorizeAction(ctx, 'platform', {});
      return acceptProposals(ctx, sql(), writes.applications, writes.ports.pullRequests, body);
    },

    async dismiss(ctx: RequestContext, body: DismissProposalsBody): Promise<{ dismissed: number }> {
      await access.authorizeAction(ctx, 'platform', {});
      const result = await sql()`
        update pipeline_discovery_proposals set state = 'dismissed', updated_at = now()
        where id = any(${body.ids}::uuid[]) and state = 'proposed'`;
      return { dismissed: result.count };
    },
  };
}

export type DiscoveryService = ReturnType<typeof createDiscoveryService>;
