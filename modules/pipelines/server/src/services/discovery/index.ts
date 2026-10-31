import { decodeCursor, toPage, type RequestContext, type SendJobOptions } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type {
  AcceptProposalsBody,
  AcceptProposalsResult,
  DismissProposalsBody,
  ListProposalsQuery,
  ProposalsPage,
} from '../../../../shared/catalog-writes.ts';
import type { DiscoveryStatus } from '../../../../shared/discovery.ts';
import type { ProposalRow } from '../../models/catalog-writes.ts';
import type { CatalogWritesService } from '../catalog-writes/index.ts';
import type { RepositoryTree } from '../code/repository-reader.ts';
import { requireAccess, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { acceptProposals } from './accept.ts';
import { PROPOSAL_FROM, PROPOSAL_SELECT, proposedRepositoryFiles, toProposal } from './present.ts';
import { scanRepository, type ScanResult } from './scan.ts';
import {
  discoveryStatus,
  recordScanFailure,
  sweepRepositories,
  type RepositoryRef,
  type SweepResult,
} from './sweep.ts';

/*
 * Discovery (architecture §9): a scan per repository proposes applications, a Platform
 * admin accepts them in bulk or dismisses them. A sweep finds the repositories by itself
 * (every few minutes for new ones, nightly for all, or when asked) and queues their scans
 * as the job below; repository events queue one too.
 */

export const DISCOVERY_JOB = 'pipelines.discover-repository';
export const DISCOVERY_SWEEP_JOB = 'pipelines.discovery-sweep';

export type { ScanResult } from './scan.ts';
export type { SweepResult } from './sweep.ts';
export { detectApplications, type DetectedApplication } from './detect.ts';

export interface DiscoveryDeps extends PipelinesServiceDeps {
  /** Queues scans and sweeps as jobs; without it (tests) they run in the call. */
  sendJob?: (
    name: string,
    payload: Record<string, unknown>,
    options?: SendJobOptions,
  ) => Promise<unknown>;
}

export function createDiscoveryService(deps: DiscoveryDeps, writes: CatalogWritesService) {
  const sql = () => requireDatabase(deps);
  const access = requireAccess(deps);

  /** Scans one repository; `tree` given by tests and callers that already hold it. */
  async function discover(repository: RepositoryRef, tree?: RepositoryTree): Promise<ScanResult> {
    try {
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
      return await scanRepository(sql(), repository, read);
    } catch (error) {
      await recordScanFailure(sql(), repository, error);
      throw error;
    }
  }

  /** Asks for each repository's scan: a job apiece, keyed by when it was asked for. */
  async function request(repositories: RepositoryRef[], requestedAt: Date): Promise<void> {
    for (const repository of repositories) {
      if (!deps.sendJob) {
        // A failure is kept on the repository's row, for the status; the others still scan.
        await discover(repository).catch(() => undefined);
        continue;
      }
      await deps.sendJob(
        DISCOVERY_JOB,
        { repository },
        {
          idempotencyKey: `discover:${repository.fullName.toLowerCase()}:${requestedAt.toISOString()}`,
        },
      );
    }
  }

  async function sweep(rescan: boolean): Promise<SweepResult> {
    return sweepRepositories(sql(), writes.ports.repositories, rescan, request);
  }

  return {
    discover,
    sweep,

    /** One repository's scan now, or with none a sweep of all of them again, queued. */
    async scan(
      ctx: RequestContext,
      repository: RepositoryRef | undefined,
    ): Promise<ScanResult | { queued: true }> {
      await access.authorizeAction(ctx, 'platform', {});
      if (repository) return discover(repository);
      if (deps.sendJob) {
        await deps.sendJob(
          DISCOVERY_SWEEP_JOB,
          { rescan: true },
          { idempotencyKey: `sweep:${Math.floor(Date.now() / 10_000)}` },
        );
      } else await sweep(true);
      return { queued: true };
    },

    async status(ctx: RequestContext): Promise<DiscoveryStatus> {
      await access.authorizeAction(ctx, 'view', {});
      return discoveryStatus(sql());
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
        repositoryFiles: await proposedRepositoryFiles(
          db,
          page.rows.map((row) => row.repository_id),
        ),
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
